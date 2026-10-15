// Ported from directus/app/src/modules/content/components/version-menu.test.ts
// Backoffice: the real Reka menu and BoDialogs are used (opened with the keyboard, read from document.body) in place of
// the VMenu/VList/VDialog stubs; the SDK client is mocked in place of `@/api`. The tests after "reserved version key"
// (create, rename, delete, switch) are Backoffice ones.
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { i18n } from '../../../lang/index.ts';
import type { ContentVersionMaybeNew, ContentVersionWithType, NewContentVersion } from '../../../types/versions.ts';
import VersionMenu from './VersionMenu.vue';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('../../../api/sdk.ts', () => ({
	sdk: { request: (command: () => unknown) => request(command()) },
	requestEndpoint:
		(path: string, options: object = {}) =>
		() => ({ path, ...options }),
}));

vi.mock('../../../composables/use-permissions/index.ts', () => ({
	useCollectionPermissions: vi.fn(() => ({
		createAllowed: ref(true),
		readAllowed: ref(true),
		updateAllowed: ref(true),
		deleteAllowed: ref(true),
	})),
}));

vi.mock('../../../composables/use-notices.ts', () => ({ showUnexpectedError: vi.fn() }));

vi.mock('../../../components/comparison/ComparisonModal.vue', async () => {
	const { defineComponent, h } = await import('vue');

	return {
		__esModule: true,
		default: defineComponent({
			name: 'ComparisonModal',
			props: { modelValue: Boolean, mode: { type: String, default: null } },
			setup: (props) => () =>
				h('div', { class: 'comparison-modal', 'data-open': String(props.modelValue), 'data-mode': props.mode }),
		}),
	};
});

beforeEach(() => {
	request.mockResolvedValue(null);
});

afterEach(() => {
	vi.clearAllMocks();
	document.body.innerHTML = '';
});

function createMockVersion(overrides: Partial<ContentVersionWithType>): ContentVersionWithType {
	return {
		id: 'version-id',
		key: 'version-key',
		name: 'Version Name',
		collection: 'test_collection',
		item: '1',
		hash: 'abc123',
		date_created: '2024-01-01',
		date_updated: '2024-01-02',
		user_created: 'user-1',
		user_updated: 'user-1',
		delta: null,
		type: 'local',
		...overrides,
	};
}

function createNewVersion(overrides: Partial<NewContentVersion> = {}): NewContentVersion {
	return {
		id: '+',
		key: 'draft',
		name: null,
		type: 'global',
		...overrides,
	};
}

const baseProps = {
	collection: 'test_collection',
	primaryKey: '1',
	updateAllowed: true,
	hasEdits: false,
	currentVersion: null as ContentVersionMaybeNew | null,
	versions: [] as ContentVersionMaybeNew[],
};

const t = (key: string) => i18n.global.t(key);

async function key(el: Element, name: string) {
	el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
	await flushPromises();
}

/** Mounts the menu and opens it; `items` are the menu items, `item(text)` the one containing `text`. */
async function open(props: Partial<typeof baseProps> = {}) {
	const wrapper = mount(VersionMenu, {
		props: { ...baseProps, ...props },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	const trigger = wrapper.get('button.version-button').element as HTMLElement;
	trigger.focus();
	await key(trigger, 'Enter');

	const items = [...document.body.querySelectorAll('[role^="menuitem"]')] as HTMLElement[];
	const item = (text: string) => items.find((el) => el.textContent?.includes(text));

	return { wrapper, trigger, items, item };
}

async function select(el: HTMLElement | undefined) {
	el!.focus();
	await key(el!, 'Enter');
}

function dialog() {
	return document.body.querySelector('[role="dialog"]') as HTMLElement;
}

async function setValue(input: HTMLInputElement, value: string) {
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	await flushPromises();
}

function saveButton() {
	return [...dialog().querySelectorAll('button')].find((btn) => btn.textContent?.includes(t('save')))!;
}

describe('VersionMenu', () => {
	describe('version list rendering', () => {
		it('should always show the global draft version in the menu', async () => {
			const draftVersion = createNewVersion({ key: 'draft', type: 'global' });

			const { wrapper, item } = await open({ versions: [draftVersion] });

			expect(item(t('draft'))).toBeDefined();
			wrapper.unmount();
		});

		it('should show edit dot for versions with content changes in it', async () => {
			const versionWithEdits = createMockVersion({
				key: 'edited-version',
				type: 'local',
				delta: { title: 'changed' },
			});

			const { wrapper, item } = await open({ versions: [versionWithEdits], currentVersion: null });

			expect(document.body.querySelector('.edit-dot')).not.toBeNull();
			expect(item('Version Name')!.querySelector('.edit-dot')).not.toBeNull();
			wrapper.unmount();
		});

		it('should not show edit dot for versions without content changes', async () => {
			const versionWithoutEdits = createMockVersion({
				key: 'clean-version',
				type: 'local',
				delta: null,
			});

			const { wrapper, item } = await open({ versions: [versionWithoutEdits], currentVersion: null });

			expect(item('Version Name')!.querySelector('.edit-dot')).toBeNull();
			wrapper.unmount();
		});

		it('shows the current version name on the button and checks it in the menu (Backoffice)', async () => {
			const localVersion = createMockVersion({ id: 'local-id', key: 'my-version', type: 'local' });

			const { wrapper, trigger, item } = await open({ versions: [localVersion], currentVersion: localVersion });

			expect(trigger.textContent).toContain('Version Name');
			expect(trigger.getAttribute('aria-label')).toBe(`${t('version')}: Version Name`);
			expect(item('Version Name')!.getAttribute('aria-checked')).toBe('true');
			expect(item(t('main_version'))!.getAttribute('aria-checked')).toBe('false');
			wrapper.unmount();
		});
	});

	describe('global version behavior', () => {
		it('should show discard changes option instead of delete version for global versions', async () => {
			const globalVersion = createMockVersion({ id: 'global-id', key: 'draft', type: 'global' });

			const { wrapper, item } = await open({ versions: [globalVersion], currentVersion: globalVersion });

			expect(item(t('discard_changes'))).toBeDefined();
			expect(item(t('delete_version'))).toBeUndefined();
			wrapper.unmount();
		});

		it('should show delete version option for local versions', async () => {
			const localVersion = createMockVersion({ id: 'local-id', key: 'my-version', type: 'local' });

			const { wrapper, item } = await open({ versions: [localVersion], currentVersion: localVersion });

			expect(item(t('delete_version'))).toBeDefined();
			expect(item(t('discard_changes'))).toBeUndefined();
			wrapper.unmount();
		});

		it('should not show rename option for global versions', async () => {
			const globalVersion = createMockVersion({ id: 'global-id', key: 'draft', type: 'global' });

			const { wrapper, item } = await open({ versions: [globalVersion], currentVersion: globalVersion });

			expect(item(t('rename_version'))).toBeUndefined();
			wrapper.unmount();
		});

		it('should show rename option for local versions', async () => {
			const localVersion = createMockVersion({ id: 'local-id', key: 'my-version', type: 'local' });

			const { wrapper, item } = await open({ versions: [localVersion], currentVersion: localVersion });

			expect(item(t('rename_version'))).toBeDefined();
			wrapper.unmount();
		});
	});

	describe('reserved version key', () => {
		const draftGlobalVersion = createMockVersion({ id: 'draft-id', key: 'draft', type: 'global' });

		it('should disable create save button when version key matches a global version key', async () => {
			const { wrapper, item } = await open({ versions: [draftGlobalVersion] });

			await select(item(t('create_version')));

			const inputs = dialog().querySelectorAll('input');
			await setValue(inputs[1]!, 'draft');

			expect(saveButton().hasAttribute('disabled')).toBe(true);
			// Backoffice: the reserved key is also the key field error.
			expect(dialog().textContent).toContain('The version key "draft" is reserved and cannot be used.');
			wrapper.unmount();
		});

		it('should disable rename save button when version key is changed to a global version key', async () => {
			const localVersion = createMockVersion({
				id: 'local-id',
				key: 'my-version',
				name: 'My Version',
				type: 'local',
			});

			const { wrapper, item } = await open({
				versions: [draftGlobalVersion, localVersion],
				currentVersion: localVersion,
			});

			await select(item(t('rename_version')));

			const inputs = dialog().querySelectorAll('input');
			await setValue(inputs[1]!, 'draft');

			expect(saveButton().hasAttribute('disabled')).toBe(true);
			wrapper.unmount();
		});
	});

	describe('new version behavior', () => {
		it('should disable promote and discard for new (virtual) versions', async () => {
			const newVersion = createNewVersion({ key: 'draft', type: 'global' });

			const { wrapper, item } = await open({ versions: [newVersion], currentVersion: newVersion });

			expect(item(t('promote_version'))!.hasAttribute('data-disabled')).toBe(true);
			expect(item(t('discard_changes'))!.hasAttribute('data-disabled')).toBe(true);
			wrapper.unmount();
		});
	});

	describe('actions (Backoffice)', () => {
		it('creates a version with a key slugified from the name and emits add', async () => {
			const created = createMockVersion({ id: 'new-id', key: 'my-new-version', name: 'My New Version' });
			request.mockResolvedValueOnce(created);

			const { wrapper, item } = await open({ versions: [createNewVersion()] });

			await select(item(t('create_version')));

			const inputs = dialog().querySelectorAll('input');
			await setValue(inputs[0]!, 'My New Version');

			expect(inputs[1]!.value).toBe('my-new-version');

			saveButton().click();
			await flushPromises();

			expect(request).toHaveBeenCalledWith({
				path: '/versions',
				method: 'POST',
				body: { key: 'my-new-version', name: 'My New Version', collection: 'test_collection', item: '1' },
			});

			expect(wrapper.emitted('add')).toEqual([[created]]);
			expect(dialog()).toBeNull();
			wrapper.unmount();
		});

		it('renames the current version and emits update', async () => {
			const localVersion = createMockVersion({ id: 'local-id', key: 'my-version', name: 'My Version' });

			const { wrapper, item } = await open({ versions: [localVersion], currentVersion: localVersion });

			await select(item(t('rename_version')));

			const inputs = dialog().querySelectorAll('input');
			expect(inputs[0]!.value).toBe('My Version');
			await setValue(inputs[1]!, 'Other Key');

			saveButton().click();
			await flushPromises();

			expect(request).toHaveBeenCalledWith({
				path: '/versions/local-id',
				method: 'PATCH',
				body: { key: 'other-key', name: 'My Version' },
			});

			expect(wrapper.emitted('update')).toEqual([[{ key: 'other-key', name: 'My Version' }]]);
			wrapper.unmount();
		});

		it('deletes the current version after confirmation and emits delete', async () => {
			const localVersion = createMockVersion({ id: 'local-id', key: 'my-version' });

			const { wrapper, item } = await open({ versions: [localVersion], currentVersion: localVersion });

			await select(item(t('delete_version')));

			expect(dialog().textContent).toContain('Are you sure you want to delete the "Version Name" version?');

			[...dialog().querySelectorAll('button')].find((btn) => btn.textContent?.includes(t('delete_label')))!.click();
			await flushPromises();

			expect(request).toHaveBeenCalledWith({ path: '/versions/local-id', method: 'DELETE' });
			expect(wrapper.emitted('delete')).toEqual([[false]]);
			wrapper.unmount();
		});

		it('opens the comparison modal in version mode from promote', async () => {
			const localVersion = createMockVersion({ id: 'local-id', key: 'my-version' });

			const { wrapper, item } = await open({ versions: [localVersion], currentVersion: localVersion });

			await select(item(t('promote_version')));
			await vi.waitFor(() => expect(wrapper.find('.comparison-modal').attributes('data-open')).toBe('true'));

			expect(wrapper.find('.comparison-modal').attributes('data-mode')).toBe('version');
			wrapper.unmount();
		});

		it('switches at once without edits', async () => {
			const localVersion = createMockVersion({ id: 'local-id', key: 'my-version' });

			const { wrapper, item } = await open({ versions: [localVersion] });

			await select(item('Version Name'));

			expect(wrapper.emitted('switch')).toEqual([[localVersion]]);
			expect(dialog()).toBeNull();
			wrapper.unmount();
		});

		it('asks before switching when there are edits', async () => {
			const localVersion = createMockVersion({ id: 'local-id', key: 'my-version' });

			const { wrapper, item } = await open({ versions: [localVersion], hasEdits: true });

			await select(item('Version Name'));

			expect(wrapper.emitted('switch')).toBeUndefined();
			expect(dialog().textContent).toContain(t('unsaved_changes'));

			[...dialog().querySelectorAll('button')].find((btn) => btn.textContent?.includes(t('switch_version')))!.click();
			await flushPromises();

			expect(wrapper.emitted('switch')).toEqual([[localVersion]]);
			wrapper.unmount();
		});
	});
});
