// Directus has no test for navigation-bookmark.vue: the row menu (personal edit dialog and delete confirmation, role and
// global bookmarks edited in Settings, lock without permission) and the focus after deleting the open bookmark
// (FR-115c).
import type { Preset } from '@directus/types';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../../../lang/index.ts';
import { type Collection, useCollectionsStore } from '../../../stores/collections.ts';
import { usePresetsStore } from '../../../stores/presets.ts';
import { useUserStore } from '../../../stores/user.ts';
import { useNavigation } from '../composables/use-navigation.ts';
import ContentNavigation from './ContentNavigation.vue';

vi.mock('../../../utils/fetch-all.ts', () => ({ fetchAll: vi.fn(async () => []) }));

enableAutoUnmount(afterEach);

afterEach(() => {
	vi.restoreAllMocks();
	document.querySelector('main')?.remove();
});

const ARTICLES = {
	collection: 'articles',
	name: 'Articles',
	icon: 'database',
	color: null,
	type: 'table',
	meta: { collection: 'articles', group: null, hidden: false, sort: 1, collapse: 'open' },
	schema: { name: 'articles' },
} as unknown as Collection;

function bookmark(id: number, extra: Partial<Preset> = {}): Preset {
	return {
		id,
		collection: 'articles',
		bookmark: 'My view',
		user: 'me',
		role: null,
		icon: 'star',
		color: '#FF0000',
		...extra,
	} as Preset;
}

async function setup({ bookmarks = [bookmark(1)], admin = false, path = '/content/articles' } = {}) {
	setActivePinia(createPinia());
	useCollectionsStore().collections = [ARTICLES];
	usePresetsStore().collectionPresets = bookmarks;
	useUserStore().currentUser = { id: 'me', admin_access: admin, language: 'en-US' } as never;
	useNavigation().activeGroups.value = ['articles'];

	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/content/:collection/:primaryKey?', component: { render: () => null } },
			{ path: '/:p(.*)*', component: { render: () => null } },
		],
	});
	await router.push(path);

	const wrapper = mount(ContentNavigation, { global: { plugins: [i18n, router] }, attachTo: document.body });
	await flushPromises();
	return { wrapper, router };
}

type Wrapper = Awaited<ReturnType<typeof setup>>['wrapper'];

const bookmarkRow = (wrapper: Wrapper, id: number) =>
	wrapper.get(`[data-key="articles"] [role="group"] li:nth-child(${id})`);
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const menuItems = () => [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')];
const dialogButton = (text: string) =>
	[...dialog()!.querySelectorAll<HTMLButtonElement>('button')].find((el) => el.textContent?.trim() === text)!;

async function openMenu(wrapper: Wrapper, id = 1) {
	const trigger = bookmarkRow(wrapper, id).get('button').element;
	trigger.focus();
	trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
	await flushPromises();
	return menuItems();
}

async function select(item: HTMLElement) {
	item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
	await flushPromises();
}

describe('NavigationBookmark', () => {
	test('a personal bookmark has a labelled row menu that follows the row tab stop', async () => {
		const { wrapper } = await setup();

		const row = bookmarkRow(wrapper, 1);
		expect(row.get('a').attributes('href')).toBe('/content/articles?bookmark=1');
		const trigger = row.get('button');
		expect(trigger.attributes('aria-label')).toBe('Options for My view');
		expect(trigger.attributes('tabindex')).toBe(row.get('a').attributes('tabindex'));

		const items = await openMenu(wrapper);
		expect(items.map((item) => item.textContent?.trim())).toEqual([
			'editEdit Personal Bookmark',
			'deleteDelete Personal Bookmark',
		]);
	});

	test('edit: the dialog saves name, icon and color through the presets store', async () => {
		const { wrapper } = await setup();
		const savePreset = vi.spyOn(usePresetsStore(), 'savePreset').mockResolvedValue({} as Preset);

		await select((await openMenu(wrapper))[0]!);
		expect(dialog()!.textContent).toContain('Edit Personal Bookmark');

		const name = dialog()!.querySelector<HTMLInputElement>('input')!;
		expect(name.value).toBe('My view');
		name.value = 'Renamed';
		name.dispatchEvent(new Event('input'));
		await flushPromises();

		dialog()!.querySelector('form')!.dispatchEvent(new Event('submit'));
		await flushPromises();

		expect(savePreset).toHaveBeenCalledWith({ ...bookmark(1), bookmark: 'Renamed', icon: 'star', color: '#FF0000' });
		expect(dialog()).toBeNull();
	});

	test('edit: Cancel resets the values; an emptied name cannot be saved', async () => {
		const { wrapper } = await setup();
		const savePreset = vi.spyOn(usePresetsStore(), 'savePreset');

		await select((await openMenu(wrapper))[0]!);
		const name = dialog()!.querySelector<HTMLInputElement>('input')!;
		name.value = '';
		name.dispatchEvent(new Event('input'));
		await flushPromises();
		expect(dialogButton('Save').disabled).toBe(true);
		dialog()!.querySelector('form')!.dispatchEvent(new Event('submit'));
		expect(savePreset).not.toHaveBeenCalled();

		dialogButton('Cancel').click();
		await flushPromises();
		expect(dialog()).toBeNull();

		await select((await openMenu(wrapper))[0]!);
		expect(dialog()!.querySelector<HTMLInputElement>('input')!.value).toBe('My view');
	});

	test('delete: confirmation, then the open bookmark routes to the collection and focuses the page title', async () => {
		const { wrapper, router } = await setup({ path: '/content/articles?bookmark=1' });
		document.body.insertAdjacentHTML('beforeend', '<main><h1>Articles</h1></main>');

		const presetsStore = usePresetsStore();
		const remove = vi.spyOn(presetsStore, 'delete').mockImplementation(async (ids) => {
			presetsStore.collectionPresets = presetsStore.collectionPresets.filter((preset) => !ids.includes(preset.id!));
		});

		await select((await openMenu(wrapper))[1]!);
		expect(dialog()!.textContent).toContain('Delete Personal Bookmark');
		const description = document.getElementById(dialog()!.getAttribute('aria-describedby')!)!;
		expect(description.textContent).toContain('Are you sure you want to delete the "My view" bookmark?');
		// Cancel comes first (FR-115d).
		expect([...dialog()!.querySelectorAll('button')].map((el) => el.textContent?.trim())).toEqual(['Cancel', 'Delete']);

		dialogButton('Delete').click();
		await flushPromises();

		expect(remove).toHaveBeenCalledWith([1]);
		expect(router.currentRoute.value.fullPath).toBe('/content/articles');
		await vi.waitFor(() => expect(document.activeElement).toBe(document.querySelector('main h1')));
	});

	test('delete of another bookmark keeps the route', async () => {
		const { wrapper, router } = await setup({
			bookmarks: [bookmark(1), bookmark(2, { bookmark: 'Other' })],
			path: '/content/articles?bookmark=2',
		});
		const remove = vi.spyOn(usePresetsStore(), 'delete').mockResolvedValue();

		await select((await openMenu(wrapper))[1]!);
		dialogButton('Delete').click();
		await flushPromises();

		expect(remove).toHaveBeenCalledWith([1]);
		expect(router.currentRoute.value.fullPath).toBe('/content/articles?bookmark=2');
	});

	test('role and global bookmarks: a lock with the cannot-edit label without permission', async () => {
		const { wrapper } = await setup({
			bookmarks: [bookmark(1, { user: null, role: 'editors' }), bookmark(2, { user: null, role: null })],
		});

		expect(bookmarkRow(wrapper, 1).find('button').exists()).toBe(false);
		expect(bookmarkRow(wrapper, 1).get('[role="img"]').attributes('aria-label')).toBe("Can't Edit Role Bookmarks");
		expect(bookmarkRow(wrapper, 2).get('[role="img"]').attributes('aria-label')).toBe("Can't Edit Global Bookmarks");
	});

	test('admins: the edit item of a role bookmark links to its Settings page (D-71)', async () => {
		const { wrapper } = await setup({ bookmarks: [bookmark(7, { user: null, role: 'editors' })], admin: true });

		const items = await openMenu(wrapper);
		expect(items[0]!.textContent).toContain('Edit Role Bookmark');
		expect(items[0]!.getAttribute('href')).toBe('/settings/presets/7');
		expect(items[1]!.textContent).toContain('Delete Role Bookmark');
	});
});
