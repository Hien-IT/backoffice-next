// DR has no test for collections.vue: the tree of roots and children, the search that keeps the parents, the
// tables without meta, the system collections, the sort saved as onSort (PATCH /collections with the whole list, not
// awaited), the D-96 menu moves, the collection options, the delete dialog with peer dependencies, the folder dialog,
// the snapshot download and the empty state (spec 016 US1, FR-010 to FR-019); backoffice_migrations left out (022).
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { saveAs } from 'file-saver';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { replaceQueue } from '../../../../api/sdk.ts';
import { i18n } from '../../../../lang/index.ts';
import { useSidebarStore } from '../../../../layout/stores/sidebar.ts';
import { useCollectionsStore } from '../../../../stores/collections.ts';
import { useRelationsStore } from '../../../../stores/relations.ts';
import { calls, json, mockApi } from '../../../../test-utils/fetch.ts';
import { mountLayout } from '../../../../test-utils/layout.ts';
import CollectionsRoute from './CollectionsRoute.vue';
import SnapshotSidebarDetail from './components/SnapshotSidebarDetail.vue';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

enableAutoUnmount(afterEach);
afterEach(() => {
	vi.unstubAllGlobals();
	vi.mocked(saveAs).mockReset();
	localStorage.clear();
});
beforeEach(() => replaceQueue());

const t = (key: string, ...args: unknown[]) => (i18n.global.t as (...a: unknown[]) => string)(key, ...args);

const meta = (sort: number, group: string | null = null, extra: Record<string, unknown> = {}) => ({
	sort,
	group,
	hidden: false,
	collapse: 'open',
	note: null,
	translations: null,
	...extra,
});

const RAW = [
	{ collection: 'a_folder', schema: null, meta: meta(1) },
	{ collection: 'child_one', schema: { name: 'child_one' }, meta: meta(1, 'a_folder') },
	{ collection: 'child_two', schema: { name: 'child_two' }, meta: meta(2, 'a_folder') },
	{ collection: 'b_col', schema: { name: 'b_col' }, meta: meta(2, null, { note: 'B note' }) },
	{ collection: 'raw_table', schema: { name: 'raw_table' }, meta: null },
	{ collection: 'directus_users', schema: { name: 'directus_users' }, meta: meta(1, null, { system: true }) },
];

const RELATIONS = [
	{
		collection: 'child_one',
		field: 'b_ref',
		related_collection: 'b_col',
		schema: null,
		meta: { many_collection: 'child_one', many_field: 'b_ref', one_collection: 'b_col', one_field: null },
	},
];

const routes = [
	{ path: '/settings/data-model', name: 'settings-collections', component: CollectionsRoute },
	{ path: '/settings/data-model/+', name: 'settings-add-new', component: { render: () => null } },
	{ path: '/settings/data-model/:collection', name: 'settings-fields', component: { render: () => null } },
	{ path: '/:p(.*)*', component: { render: () => null } },
];

async function mountRoute(raw = RAW, answers: Record<string, unknown> = {}) {
	const fetch = mockApi({
		'GET /collections': raw,
		'GET /relations': RELATIONS,
		'GET /fields': [],
		'PATCH /collections': [],
		...answers,
	});

	const mounted = await mountLayout(CollectionsRoute, {
		routes,
		path: '/settings/data-model',
		beforeMount() {
			const store = useCollectionsStore();
			store.collections = raw.map((c) => store.prepareCollectionForApp(c as never));
			useRelationsStore().relations = RELATIONS as never;
		},
	});

	return { fetch, ...mounted };
}

const tree = () => document.querySelector(`section[aria-label="${t('settings_data_model')}"]`)!;
const rowNames = (root: ParentNode = tree()) =>
	[...root.querySelectorAll('span.font-mono')].map((span) => span.textContent!.trim());

async function openRowMenu(name: string) {
	const trigger = document.querySelector<HTMLElement>(
		`button.row-menu[aria-label="${t('item_options', { item: name })}"]`,
	)!;
	trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
	await flushPromises();
	return [...document.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
}

/** A menu item by its text (an icon ligature comes before it, a check after an active one). */
const byText = (items: HTMLElement[], text: string) => items.find((i) => i.textContent!.includes(text));

async function select(items: HTMLElement[], text: string) {
	const item = byText(items, text)!;
	item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
	await flushPromises();
}

const patchBodies = (fetch: ReturnType<typeof mockApi>) =>
	fetch.mock.calls
		.filter(([input, init]) => init?.method === 'PATCH' && new URL(String(input)).pathname === '/collections')
		.map(([, init]) => JSON.parse(String(init!.body)));

test('the tree shows roots with nested children, tables without meta and the system collections', async () => {
	await mountRoute();

	expect(rowNames()).toEqual(['a_folder', 'child_one', 'child_two', 'b_col']);
	expect(document.body.textContent).toContain('B note');

	const folder = tree().querySelector('li')!;
	expect(rowNames(folder)).toEqual(['a_folder', 'child_one', 'child_two']);
	// A folder opens the folder dialog, a table goes to its collection page.
	expect(folder.querySelector('button.flex-1')).not.toBeNull();
	expect(document.querySelector('a[href="/settings/data-model/b_col"]')).not.toBeNull();

	const raw = document.querySelector(`section[aria-label="${t('db_only_click_to_configure')}"]`)!;
	expect(raw.querySelector('a')!.getAttribute('href')).toBe('/settings/data-model/raw_table');

	[...document.querySelectorAll('button')].find((b) => b.textContent?.includes(t('system_collections')))!.click();
	await flushPromises();
	expect(document.querySelector('a[href="/settings/data-model/directus_users"]')).not.toBeNull();
});

test('spec 022 (D-181): backoffice_migrations is not listed, its D-118 key repeats directus_migrations', async () => {
	await mountRoute([
		...RAW,
		{
			collection: 'directus_migrations',
			schema: { name: 'directus_migrations' },
			meta: meta(1, null, { system: true }),
		},
		{
			collection: 'backoffice_migrations',
			schema: { name: 'backoffice_migrations' },
			meta: meta(1, null, { system: true, hidden: true }),
		},
		// Spec 025 (D-189.5): the same for backoffice_permissions.
		{
			collection: 'backoffice_permissions',
			schema: { name: 'backoffice_permissions' },
			meta: meta(1, null, { system: true, hidden: true }),
		},
	]);

	[...document.querySelectorAll('button')].find((b) => b.textContent?.includes(t('system_collections')))!.click();
	await flushPromises();
	expect(document.querySelector('a[href="/settings/data-model/directus_migrations"]')).not.toBeNull();
	expect(document.querySelector('a[href="/settings/data-model/backoffice_migrations"]')).toBeNull();
	expect(document.querySelector('a[href="/settings/data-model/backoffice_permissions"]')).toBeNull();
});

test('a folder row stands out; an empty folder shows a drop area, an empty table none (owner 2026-10-21)', async () => {
	await mountRoute([...RAW, { collection: 'empty_folder', schema: null, meta: meta(3) }]);

	const row = (key: string) => document.querySelector(`[data-row-key="${key}"]`)!;
	expect(row('a_folder').className).toContain('border-dashed!');
	expect(row('b_col').className).not.toContain('border-dashed!');
	expect(row('empty_folder').textContent).toContain(t('drop_collections_here'));
	expect(row('empty_folder').querySelector('.min-h-10')).not.toBeNull();
	expect(row('a_folder').textContent).not.toContain(t('drop_collections_here'));
	expect(row('b_col').textContent).not.toContain(t('drop_collections_here'));
});

test('the collapse button hides the children and is kept in localStorage', async () => {
	await mountRoute();

	const toggle = document.querySelector<HTMLButtonElement>(`button[aria-label="${t('collapse')} a_folder"]`)!;
	expect(toggle.getAttribute('aria-expanded')).toBe('true');
	toggle.click();
	await flushPromises();

	expect(toggle.getAttribute('aria-expanded')).toBe('false');
	expect(rowNames()).toEqual(['a_folder', 'b_col']);
	expect(JSON.parse(localStorage.getItem('backoffice-collapsed-collection-ids')!)).toEqual(['a_folder']);
});

test('the search keeps the parents of a match and turns dragging off', async () => {
	const { wrapper } = await mountRoute();

	const input = document.querySelector<HTMLInputElement>('input[type="search"], input[placeholder]')!;
	input.value = 'one';
	input.dispatchEvent(new Event('input'));
	await flushPromises();
	await new Promise((r) => setTimeout(r, 400));
	await flushPromises();

	expect(rowNames()).toEqual(['a_folder', 'child_one']);
	expect(document.querySelector('mark')!.textContent).toBe('one');
	expect(document.querySelector('li.draggable .drag-handle')).toBeNull();
	expect(wrapper.text()).not.toContain('raw_table');
});

test('Move down saves the order of the whole list with PATCH /collections, the store first', async () => {
	const { fetch } = await mountRoute(RAW, { 'PATCH /collections': () => new Promise(() => undefined) });

	await select(await openRowMenu('a_folder'), t('move_down'));

	expect(patchBodies(fetch)).toEqual([
		[
			{ collection: 'b_col', meta: { sort: 1, group: null } },
			{ collection: 'a_folder', meta: { sort: 2, group: null } },
		],
	]);
	// The answer never comes: the store already has the new order.
	expect(rowNames().filter((n) => n === 'a_folder' || n === 'b_col')).toEqual(['b_col', 'a_folder']);
});

test('Indent moves a root into the collection above, Outdent moves a child out after its parent', async () => {
	const { fetch } = await mountRoute();

	await select(await openRowMenu('b_col'), t('indent_item'));
	expect(patchBodies(fetch).at(-1)).toEqual([
		{ collection: 'child_one', meta: { sort: 1, group: 'a_folder' } },
		{ collection: 'child_two', meta: { sort: 2, group: 'a_folder' } },
		{ collection: 'b_col', meta: { sort: 3, group: 'a_folder' } },
	]);

	await select(await openRowMenu('child_one'), t('outdent_item'));
	expect(patchBodies(fetch).at(-1)).toEqual([
		{ collection: 'a_folder', meta: { sort: 1, group: null } },
		{ collection: 'child_one', meta: { sort: 2, group: null } },
	]);
});

test('a failed sort is not shown', async () => {
	const { fetch } = await mountRoute(RAW, {
		'PATCH /collections': () => json({ errors: [{ message: 'no', extensions: { code: 'FORBIDDEN' } }] }, 403),
	});

	await select(await openRowMenu('a_folder'), t('move_down'));

	expect(patchBodies(fetch)).toHaveLength(1);
	expect(document.querySelector('[role="alertdialog"]')).toBeNull();
});

test('the options of a folder: visibility and the three collapse modes; system rows have none', async () => {
	const { fetch } = await mountRoute(RAW, { 'PATCH /collections/a_folder': {} });

	const items = await openRowMenu('a_folder');
	for (const text of ['make_folder_hidden', 'start_open', 'start_collapsed', 'always_open', 'delete_folder'])
		expect(byText(items, t(text))).toBeDefined();
	expect(byText(items, t('start_open'))!.getAttribute('aria-checked')).toBe('true');
	expect(byText(items, t('goto_collection_content'))).toBeUndefined();

	await select(items, t('start_collapsed'));

	const patch = fetch.mock.calls.find(([input]) => String(input).endsWith('/collections/a_folder'))!;
	expect(JSON.parse(String(patch[1]!.body))).toEqual({ meta: { collapse: 'closed' } });
	expect(calls(fetch)).toContain('GET /collections');
	expect(document.querySelector('button.row-menu[aria-label*="directus_users"]')).toBeNull();
});

test('a collection hides with PATCH meta.hidden and links to its content', async () => {
	const { fetch } = await mountRoute(RAW, { 'PATCH /collections/b_col': {} });

	const items = await openRowMenu('b_col');
	expect(byText(items, t('goto_collection_content'))).toBeDefined();

	await select(items, t('make_collection_hidden'));

	const patch = fetch.mock.calls.find(([input]) => String(input).endsWith('/collections/b_col'))!;
	expect(JSON.parse(String(patch[1]!.body))).toEqual({ meta: { hidden: true } });
});

test('delete lists the peer dependencies and deletes their fields before the collection', async () => {
	const { fetch } = await mountRoute(RAW, {
		'DELETE /fields/child_one/b_ref': () => new Response(null, { status: 204 }),
		'DELETE /collections/b_col': () => new Response(null, { status: 204 }),
	});

	await select(await openRowMenu('b_col'), t('delete_collection'));

	const dialog = document.querySelector('[role="dialog"]')!;
	expect(dialog.textContent).toContain('b_ref (child_one)');

	[...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === t('delete_collection'))!.click();
	await flushPromises();

	const deletes = calls(fetch).filter((c) => c.startsWith('DELETE'));
	expect(deletes).toEqual(['DELETE /fields/child_one/b_ref', 'DELETE /collections/b_col']);
});

test('the folder dialog creates a folder with POST /collections', async () => {
	const { fetch } = await mountRoute(RAW, { 'POST /collections': { collection: 'new_folder' } });

	document.querySelector<HTMLButtonElement>(`button[aria-label="${t('create_folder')}"]`)!.click();
	await flushPromises();

	const key = document.querySelector<HTMLInputElement>(`[role="dialog"] input[aria-label="${t('folder_key')}"]`)!;
	key.value = 'new_folder';
	key.dispatchEvent(new Event('input'));
	await flushPromises();

	document.querySelector<HTMLFormElement>('#collection-dialog-form')!.requestSubmit();
	await flushPromises();

	const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!;
	expect(JSON.parse(String(post[1]!.body))).toMatchObject({
		collection: 'new_folder',
		meta: { collection: 'new_folder', icon: 'folder', note: null, color: null, translations: null },
	});
	expect(calls(fetch).at(-1)).toBe('GET /collections');
});

test('the snapshot detail saves the whole answer body as snapshot.json', async () => {
	// The detail panel is a closed drawer below xl: the section is mounted alone, open.
	mockApi({ 'GET /schema/snapshot': { version: 1, collections: [] } });
	await mountLayout(SnapshotSidebarDetail, {
		beforeMount: () => void (useSidebarStore().activeAccordionItem = 'download-snapshot'),
	});

	const button = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === t('snapshot.download'));
	button!.click();
	await flushPromises();

	const [blob, name] = vi.mocked(saveAs).mock.calls[0]! as [Blob, string];
	expect(name).toBe('snapshot.json');
	expect(await blob.text()).toBe(JSON.stringify({ data: { version: 1, collections: [] } }, null, 2));
});

test('without collections the empty state links to the new collection drawer', async () => {
	await mountRoute([RAW[5]!]);

	expect(document.body.textContent).toContain(t('no_collections'));
	expect(document.querySelectorAll('a[href="/settings/data-model/+"]').length).toBeGreaterThan(0);
});
