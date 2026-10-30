import type { Preset } from '@directus/types';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, describe, expect, test } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../../../lang/index.ts';
import { type Collection, useCollectionsStore } from '../../../stores/collections.ts';
import { usePresetsStore } from '../../../stores/presets.ts';
import { useUserStore } from '../../../stores/user.ts';
import { useNavigation } from '../composables/use-navigation.ts';
import ContentNavigation from './ContentNavigation.vue';

enableAutoUnmount(afterEach);

function collection(name: string, meta: Record<string, unknown> | null = {}, schema = true): Collection {
	return {
		collection: name,
		name: name.toUpperCase(),
		icon: 'database',
		color: meta?.['color'] ?? null,
		type: schema ? 'table' : 'alias',
		meta:
			meta === null ? null : { collection: name, group: null, hidden: false, sort: null, collapse: 'open', ...meta },
		schema: schema ? { name } : null,
	} as unknown as Collection;
}

function bookmark(id: number, collectionName: string, name: string, extra: Partial<Preset> = {}): Preset {
	return {
		id,
		collection: collectionName,
		bookmark: name,
		user: 'me',
		role: null,
		icon: 'bookmark',
		...extra,
	} as Preset;
}

const BASE = [
	collection('articles', { sort: 1, color: '#FF0000' }),
	collection('folder', { sort: 2 }, false),
	collection('pages', { group: 'folder' }),
	collection('locked', { sort: 3, collapse: 'locked' }),
	collection('child', { group: 'locked' }),
	collection('secret', { sort: 4, hidden: true }),
];

async function setup({
	collections = BASE,
	bookmarks = [] as Preset[],
	path = '/content',
	admin = true,
	activeGroups = [] as string[],
	props = {},
} = {}) {
	setActivePinia(createPinia());
	useCollectionsStore().collections = collections;
	usePresetsStore().collectionPresets = bookmarks;
	useUserStore().currentUser = { id: 'me', admin_access: admin } as never;

	const navigation = useNavigation();
	navigation.activeGroups.value = activeGroups;
	navigation.showHidden.value = false;

	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/content/:collection/:primaryKey?', component: { render: () => null } },
			{ path: '/:p(.*)*', component: { render: () => null } },
		],
	});

	await router.push(path);

	const wrapper = mount(ContentNavigation, {
		props,
		global: { plugins: [i18n, router] },
		attachTo: document.body,
	});

	await flushPromises();
	return { wrapper, navigation, router };
}

type Wrapper = Awaited<ReturnType<typeof setup>>['wrapper'];

const row = (wrapper: Wrapper, key: string) => wrapper.find(`[data-key="${key}"]`);
const rowKeys = (wrapper: Wrapper) => wrapper.findAll('[role="treeitem"]').map((item) => item.attributes('data-key'));

describe('ContentNavigation', () => {
	test('renders the root collections as a tree with links, groups and folders', async () => {
		const { wrapper } = await setup();

		const tree = wrapper.get('[role="tree"]');
		expect(tree.attributes('aria-label')).toBe('Collections');
		expect(rowKeys(wrapper)).toEqual(['articles', 'folder', 'locked', 'child']);

		expect(row(wrapper, 'articles').get('a').attributes('href')).toBe('/content/articles');
		expect(row(wrapper, 'articles').attributes('aria-level')).toBe('1');
		expect(row(wrapper, 'articles').attributes('aria-expanded')).toBeUndefined();
		expect(row(wrapper, 'articles').get('.material-symbols-rounded').attributes('style')).toContain('color: #FF0000');

		// Folder (no schema): a group with a toggle, its label is not a link.
		const folder = row(wrapper, 'folder');
		expect(folder.find('a').exists()).toBe(false);
		expect(folder.attributes('aria-expanded')).toBe('false');
		expect(folder.get('button').attributes('aria-label')).toBe('Expand FOLDER');
		// D-129 (owner 2026-10-21): the toggle is the last control of the row, so siblings stay aligned.
		expect(folder.element.firstElementChild!.lastElementChild).toBe(folder.get('button').element);
		expect(folder.get('button').text()).toContain('expand_more');

		// Locked: open, no toggle, child at level 2.
		const locked = row(wrapper, 'locked');
		expect(locked.attributes('aria-expanded')).toBe('true');
		expect(locked.find('button').exists()).toBe(false);
		expect(row(wrapper, 'child').attributes('aria-level')).toBe('2');

		// One tab stop.
		expect(wrapper.findAll('[data-nav-row]').map((el) => el.attributes('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
	});

	test('the toggle opens a group through the shared activeGroups; the folder label toggles too', async () => {
		const { wrapper, navigation } = await setup();

		await row(wrapper, 'folder').get('button').trigger('click');
		expect(navigation.activeGroups.value).toEqual(['folder']);
		expect(row(wrapper, 'folder').attributes('aria-expanded')).toBe('true');
		expect(row(wrapper, 'pages').exists()).toBe(true);
		expect(row(wrapper, 'folder').get('button').attributes('aria-label')).toBe('Collapse FOLDER');

		await row(wrapper, 'folder').get('[data-nav-row]').trigger('click');
		expect(navigation.activeGroups.value).toEqual([]);
		expect(row(wrapper, 'pages').exists()).toBe(false);
	});

	test('D-202: a group title hangs its children on a guide line, the next root row has a divider above it', async () => {
		const { wrapper } = await setup({ activeGroups: ['folder', 'locked'] });

		expect(row(wrapper, 'folder').attributes('data-nav-heading')).toBe('true');
		expect(row(wrapper, 'folder').get('ul[role="group"]').classes()).toEqual(
			expect.arrayContaining(['border-s', 'ms-3', 'ps-1']),
		);
		expect(row(wrapper, 'locked').get('ul[role="group"]').classes()).toContain('ps-4');
		// The divider is a sibling selector: it draws on the root row right after the group title only.
		expect(row(wrapper, 'locked').classes()).toContain('[[data-nav-heading]+&]:border-t');
		expect(document.querySelector('[data-nav-heading] + li')?.getAttribute('data-key')).toBe('locked');
		expect(row(wrapper, 'pages').classes()).not.toContain('[[data-nav-heading]+&]:border-t');
	});

	test('opens the parent groups of the current collection', async () => {
		const { wrapper } = await setup({ props: { currentCollection: 'pages' }, path: '/content/pages' });

		expect(row(wrapper, 'folder').attributes('aria-expanded')).toBe('true');
		expect(row(wrapper, 'pages').attributes('aria-selected')).toBe('true');
		expect(row(wrapper, 'pages').get('a').attributes('aria-current')).toBe('page');
		expect(row(wrapper, 'pages').get('[data-nav-row]').attributes('tabindex')).toBe('0');
	});

	test('hidden collections: button with aria-pressed shows them, marked hidden', async () => {
		const { wrapper, navigation } = await setup();

		expect(row(wrapper, 'secret').exists()).toBe(false);

		const toggle = wrapper.get('button[aria-label="Show Hidden Collections"]');
		expect(toggle.attributes('aria-pressed')).toBe('false');

		await toggle.trigger('click');
		expect(navigation.showHidden.value).toBe(true);
		expect(toggle.attributes('aria-pressed')).toBe('true');
		expect(row(wrapper, 'secret').text()).toContain('(Hidden)');
		expect(row(wrapper, 'secret').get('div').classes()).toContain('text-gray-500');
	});

	test('no hidden toggle without hidden collections; dense above 5 visible collections', async () => {
		const few = await setup({ collections: [collection('a'), collection('b')] });
		expect(few.wrapper.find('button[aria-pressed]').exists()).toBe(false);
		expect(row(few.wrapper, 'a').get('div').classes()).toContain('min-h-9');
		few.wrapper.unmount();

		const many = await setup({ collections: ['a', 'b', 'c', 'd', 'e', 'f'].map((name) => collection(name)) });
		expect(row(many.wrapper, 'a').get('div').classes()).toContain('min-h-8');
	});

	test('search shows above 20 visible collections and filters from 3 characters', async () => {
		const collections = Array.from({ length: 21 }, (_, i) => collection(`c${String(i).padStart(2, '0')}`));
		collections.push(collection('special'));

		const { wrapper } = await setup({ collections });
		const input = wrapper.get('input[type="search"]');
		expect(input.attributes('placeholder')).toBe('Search Collection...');

		await input.setValue('sp');
		expect(rowKeys(wrapper)).toHaveLength(22);

		await input.setValue('spe');
		expect(rowKeys(wrapper)).toEqual(['special']);
		expect(wrapper.get('[role="status"]').text()).toBe('');

		await input.setValue('nothing');
		expect(wrapper.find('[role="tree"]').exists()).toBe(false);
		expect(wrapper.get('[role="status"]').text()).toBe('No Results');
	});

	test('no search input with 20 visible collections or fewer', async () => {
		const { wrapper } = await setup();
		expect(wrapper.find('input[type="search"]').exists()).toBe(false);
	});

	test('bookmarks are child rows linking to ?bookmark=<id>, active on that query', async () => {
		const bookmarks = [
			bookmark(3, 'articles', 'Published', { color: '#00FF00', icon: 'star' }),
			bookmark(4, 'articles', '$t:global'),
		];
		const { wrapper, router } = await setup({
			bookmarks,
			path: '/content/articles?bookmark=3',
			activeGroups: ['articles'],
		});

		const articles = row(wrapper, 'articles');
		expect(articles.attributes('aria-expanded')).toBe('true');
		expect(articles.attributes('aria-selected')).toBe('false');

		const published = row(wrapper, 'bookmark:3');
		expect(published.attributes('aria-level')).toBe('2');
		expect(published.get('a').attributes('href')).toBe('/content/articles?bookmark=3');
		expect(published.attributes('aria-selected')).toBe('true');
		expect(published.get('a').attributes('aria-current')).toBe('page');
		expect(published.text()).toContain('star');
		expect(published.text()).toContain('Published');
		expect(row(wrapper, 'bookmark:4').text()).toContain('Global');
		expect(row(wrapper, 'bookmark:4').attributes('aria-selected')).toBe('false');

		await router.push('/content/articles');
		await flushPromises();
		expect(row(wrapper, 'articles').attributes('aria-selected')).toBe('true');
		expect(row(wrapper, 'bookmark:3').attributes('aria-selected')).toBe('false');
	});

	test('admin without collections gets the create collection button, others nothing', async () => {
		const admin = await setup({ collections: [] });
		const link = admin.wrapper.get('a');
		expect(link.text()).toBe('Create Collection');
		expect(link.attributes('href')).toBe('/settings/data-model/+');
		admin.wrapper.unmount();

		const user = await setup({ collections: [], admin: false });
		expect(user.wrapper.find('a').exists()).toBe(false);
	});

	test('context menu: edit collection on a table row for admins, hidden toggle elsewhere', async () => {
		const { wrapper, navigation } = await setup();

		await row(wrapper, 'articles').get('a').trigger('contextmenu');
		await flushPromises();
		const edit = document.body.querySelector<HTMLAnchorElement>('[role="menuitem"]');
		expect(edit?.textContent).toContain('Edit Collection');
		expect(edit?.getAttribute('href')).toBe('/settings/data-model/articles');
		document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		await flushPromises();

		await row(wrapper, 'folder').get('[data-nav-row]').trigger('contextmenu');
		await flushPromises();
		const items = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')];
		const toggle = items.find((item) => item.textContent?.includes('Show Hidden Collections'));
		expect(toggle).toBeDefined();
		toggle!.click();
		await flushPromises();
		expect(navigation.showHidden.value).toBe(true);
	});
});
