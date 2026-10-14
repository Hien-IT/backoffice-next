// Ported from directus/app/src/views/private/components/overlay-item.test.ts (isSavable and the cancel dialog; the
// collab cases are gone with D-54), plus the drawer-item behaviour on the fixture snapshot: fetch, edit, junction
// rows, client-side validation before staging (FR-018), unsaved-changes confirm (FR-084), permissions, nesting.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { replaceQueue } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { type FixtureUser, loadSnapshot } from '../../test-utils/fixtures.ts';
import DrawerItem from './DrawerItem.vue';

enableAutoUnmount(afterEach);

const snapshot = loadSnapshot();
let fetch: ReturnType<typeof mockFixtureApi>;
let hydrateCalls = 0;

async function setup(user: FixtureUser = 'admin') {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(snapshot, { user });
	await useUserStore().hydrate();

	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);

	hydrateCalls = fetch.mock.calls.length;
}

beforeEach(async () => {
	Element.prototype.scrollIntoView = vi.fn();
	await setup();
});

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
	vi.restoreAllMocks();
});

/** Requests sent by the drawer (after the store hydration). */
const drawerCalls = () => calls(fetch).slice(hydrateCalls);

async function mountItem(props: Record<string, unknown> = {}) {
	const wrapper = mount(DrawerItem, {
		props: {
			collection: 'bo_rel_target',
			active: true,
			'onUpdate:active': (active: boolean) => wrapper.setProps({ active }),
			...props,
		},
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	await flushPromises();
	return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountItem>>;

const panel = () => document.querySelector<HTMLElement>('[role="dialog"]');
const saveButton = () => panel()!.querySelector<HTMLButtonElement>('header button[aria-label="Save"]')!;
const field = (name: string, form = 'main') =>
	panel()!.querySelector<HTMLElement>(`[data-form="${form}"] [data-field="${name}"]`);

async function type(name: string, value: string, form = 'main') {
	const input = field(name, form)!.querySelector<HTMLInputElement>('input')!;
	input.value = value;
	input.dispatchEvent(new Event('input'));
	await flushPromises();
}

async function save() {
	saveButton().click();
	await flushPromises();
}

const lastInput = (wrapper: Wrapper) => wrapper.emitted<[Record<string, unknown>]>('input')?.at(-1)?.[0];

describe('edit an existing item', () => {
	test('loads the item with GET <endpoint>/<pk>, emits nothing on mount, title from the display template', async () => {
		const wrapper = await mountItem({ primaryKey: 2 });

		expect(drawerCalls()).toEqual(
			expect.arrayContaining(['GET /items/bo_rel_target/2?fields=*', 'GET /items/bo_rel_target/2?fields=name']),
		);
		expect(drawerCalls()).toHaveLength(2);
		expect(wrapper.emitted('input')).toBeUndefined();
		expect(field('name')!.querySelector('input')!.value).toBe('Target two');
		expect(panel()!.querySelector('h2')!.textContent).toContain('Target two');
	});

	test('isSavable: disabled without edits, enabled with edits; save stages the edits with the key, no request', async () => {
		const wrapper = await mountItem({ primaryKey: 2 });
		const before = drawerCalls().length;

		expect(saveButton().disabled).toBe(true);

		await type('name', 'Renamed');
		expect(saveButton().disabled).toBe(false);

		await save();

		expect(lastInput(wrapper)).toEqual({ name: 'Renamed', id: 2 });
		expect(wrapper.emitted('update:active')).toEqual([[false]]);
		expect(drawerCalls()).toHaveLength(before);
	});

	test('enables save for an existing item with `edits` and starts from them', async () => {
		await mountItem({ primaryKey: 2, edits: { name: 'From parent' } });

		expect(saveButton().disabled).toBe(false);
		expect(field('name')!.querySelector('input')!.value).toBe('From parent');
	});

	test('Ctrl+Enter applies like the save button', async () => {
		const wrapper = await mountItem({ primaryKey: 2 });
		await type('name', 'Keyboard');

		panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({ name: 'Keyboard', id: 2 });
	});

	test('a failed fetch closes the drawer', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const wrapper = await mountItem({ primaryKey: 999 });

		expect(wrapper.emitted('update:active')).toEqual([[false]]);
		expect(warn).toHaveBeenCalled();
	});
});

describe('create', () => {
	test('enables save for a new item without edits; title "Creating Item in"', async () => {
		await mountItem({ primaryKey: '+' });

		expect(drawerCalls()).toEqual([]);
		expect(saveButton().disabled).toBe(false);
		expect(panel()!.querySelector('h2')!.textContent).toContain('Creating Item in');
	});

	test('disables save when the disabled prop is true even for new items', async () => {
		await mountItem({ primaryKey: '+', disabled: true });
		expect(saveButton().disabled).toBe(true);
	});

	test('validates on the client before staging (FR-018): required field, then the fixed edits are emitted', async () => {
		const wrapper = await mountItem({ collection: 'bo_groups', primaryKey: '+', selectedFields: ['title'] });

		await save();

		expect(wrapper.emitted('input')).toBeUndefined();
		expect(panel()!.textContent).toContain('Title');
		expect(field('title')!.querySelector('input')!.getAttribute('aria-invalid')).toBe('true');

		await type('title', 'Hello');
		await save();

		expect(lastInput(wrapper)).toEqual({ title: 'Hello' });
	});

	test('selectedFields only renders the chosen fields', async () => {
		await mountItem({ primaryKey: '+', selectedFields: ['name'] });

		expect(field('name')).not.toBeNull();
		expect(field('status')).toBeNull();
	});

	test('circularField is read only', async () => {
		await mountItem({ primaryKey: '+', circularField: 'name' });
		expect(field('name')!.querySelector('input')!.disabled).toBe(true);
	});
});

describe('junction rows', () => {
	const junction = { collection: 'bo_junction_m2m_table', junctionField: 'bo_rel_target_id' };

	test('loads the junction row with the related item and stages related edits with both keys', async () => {
		const wrapper = await mountItem({ ...junction, primaryKey: 1, relatedPrimaryKey: 2 });

		expect(drawerCalls()).toEqual(
			expect.arrayContaining([
				'GET /items/bo_junction_m2m_table/1?fields=*,bo_rel_target_id.*',
				'GET /items/bo_rel_target/2',
			]),
		);
		expect(field('name', 'junction')!.querySelector('input')!.value).toBe('Target two');

		await type('name', 'Via junction', 'junction');
		await save();

		expect(lastInput(wrapper)).toEqual({ bo_rel_target_id: { name: 'Via junction', id: 2 }, id: 1 });
	});

	test('a new junction row with an existing related item ("+" and a related key)', async () => {
		const wrapper = await mountItem({ ...junction, primaryKey: '+', relatedPrimaryKey: 3 });

		expect(drawerCalls()).toEqual(['GET /items/bo_rel_target/3', 'GET /items/bo_rel_target/3?fields=name']);

		await type('name', 'Changed', 'junction');
		await save();

		expect(lastInput(wrapper)).toEqual({ bo_rel_target_id: { name: 'Changed', id: 3 } });
	});

	test('junctionFieldLocation top puts the related form last in the DOM order reversed', async () => {
		await mountItem({ ...junction, primaryKey: '+', junctionFieldLocation: 'top' });
		expect(panel()!.querySelector('[data-form="junction"]')!.parentElement!.className).toContain('flex-col-reverse');
	});
});

describe('unsaved-changes dialog (FR-084)', () => {
	test('cancel with edits asks; keep editing keeps the drawer, discard closes it without input', async () => {
		const wrapper = await mountItem({ primaryKey: 2 });
		await type('name', 'Dirty');

		panel()!.querySelector<HTMLButtonElement>('header button[aria-label="Cancel"]')!.click();
		await flushPromises();

		const dialogs = () => document.querySelectorAll<HTMLElement>('[role="dialog"]');
		expect(dialogs()).toHaveLength(2);
		expect(dialogs()[1]!.textContent).toContain('Discard All Changes');

		[...dialogs()[1]!.querySelectorAll('button')].find((b) => b.textContent?.includes('Keep Editing'))!.click();
		await flushPromises();
		expect(dialogs()).toHaveLength(1);
		expect(wrapper.emitted('update:active')).toBeUndefined();

		panel()!.querySelector<HTMLButtonElement>('header button[aria-label="Cancel"]')!.click();
		await flushPromises();
		[...dialogs()[1]!.querySelectorAll('button')].find((b) => b.textContent?.includes('Discard Changes'))!.click();
		await flushPromises();

		expect(wrapper.emitted('update:active')).toEqual([[false]]);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('cancel without edits, or with preventCancelWithEdits false, closes at once', async () => {
		const wrapper = await mountItem({ primaryKey: 2 });
		panel()!.querySelector<HTMLButtonElement>('header button[aria-label="Cancel"]')!.click();
		await flushPromises();
		expect(wrapper.emitted('update:active')).toEqual([[false]]);

		const other = await mountItem({ primaryKey: 2, preventCancelWithEdits: false, edits: { name: 'x' } });
		(other.vm as unknown as { cancel: () => void }).cancel();
		await flushPromises();
		expect(other.emitted('update:active')).toEqual([[false]]);
	});
});

describe('permissions', () => {
	test('bo-viewer: fields read only and save disabled (no update permission)', async () => {
		await setup('bo-viewer');
		await mountItem({ primaryKey: 1 });

		expect(field('name')!.querySelector('input')!.disabled).toBe(true);
		expect(saveButton().disabled).toBe(true);
	});

	test('bo-editor: a field without read permission is not rendered', async () => {
		await setup('bo-editor');
		await mountItem({ primaryKey: 1 });

		expect(field('name')).not.toBeNull();
		expect(field('status')).toBeNull();
	});
});

test('nested drawers: a drawer opened from inside another one is one level deeper', async () => {
	const Host = defineComponent(
		() => () =>
			h(
				DrawerItem,
				{ collection: 'bo_rel_target', active: true, primaryKey: '+' },
				{
					actions: () => h(DrawerItem, { collection: 'bo_rel_target', active: true, primaryKey: '+' }),
				},
			),
	);

	mount(Host, { global: { plugins: [i18n] }, attachTo: document.body });
	await flushPromises();

	const depths = [...document.querySelectorAll('[role="dialog"]')].map((d) => d.getAttribute('data-depth'));
	expect(depths).toEqual(['0', '1']);
});
