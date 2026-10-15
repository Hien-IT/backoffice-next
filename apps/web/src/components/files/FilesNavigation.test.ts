// Directus has no test for files-navigation.vue / files-navigation-folder.vue: tree rows, special views, the active
// row, router targets or a custom handler, the folder row menu (rename, move, download, delete) and the tree keyboard.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import fileSaver from 'file-saver';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import { resetFoldersForTests } from '../../composables/use-folders.ts';
import { i18n } from '../../lang/index.ts';
import { assertOnlyKnownRequests, calls, mockApi } from '../../test-utils/fetch.ts';
import FilesNavigation from './FilesNavigation.vue';

vi.mock('file-saver', () => ({ default: { saveAs: vi.fn() } }));

enableAutoUnmount(afterEach);

const FOLDERS = [
	{ id: 'a', name: 'Alpha', parent: null },
	{ id: 'b', name: 'Beta', parent: 'a' },
	{ id: 'c', name: 'Gamma', parent: 'b' },
	{ id: 'd', name: 'Delta', parent: null },
];

beforeEach(async () => {
	setActivePinia(createPinia());
	resetFoldersForTests();
	await replaceQueue();
});

afterEach(() => {
	vi.mocked(fileSaver.saveAs).mockReset();
});

async function setup(props: Record<string, unknown> = {}, answers: Record<string, unknown> = {}) {
	const fetch = mockApi({ 'GET /folders': FOLDERS, ...answers } as never);

	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/files', name: 'files-collection', component: { render: () => null } },
			{ path: '/files/folders/:folder', name: 'folders-collection', component: { render: () => null } },
			{ path: '/:p(.*)*', component: { render: () => null } },
		],
	});

	await router.push('/files');
	const wrapper = mount(FilesNavigation, { props, global: { plugins: [i18n, router] }, attachTo: document.body });
	await flushPromises();

	return { wrapper, router, fetch };
}

const names = (wrapper: Awaited<ReturnType<typeof setup>>['wrapper']) =>
	wrapper.findAll('[role="treeitem"] [data-tree-row]').map((row) => row.text().replace(/^(folder_special|folder)/, ''));

test('library root open with its folders, then the three special views', async () => {
	const { wrapper, fetch } = await setup();

	expect(names(wrapper)).toEqual(['File Library', 'Alpha', 'Delta']);
	expect(wrapper.get('[data-key="root"]').attributes('aria-selected')).toBe('true');
	expect(wrapper.get('[data-key="root"] a').attributes('aria-current')).toBe('page');
	expect(wrapper.get('[data-key="a"] a').attributes('href')).toBe('/files/folders/a');
	expect(wrapper.find('[role="separator"]').exists()).toBe(true);

	const specials = wrapper.findAll('nav > ul:not([role]) a');
	expect(specials.map((link) => link.attributes('href'))).toEqual(['/files/all', '/files/mine', '/files/recent']);
	expect(calls(fetch)).toEqual(['GET /folders?sort=name&limit=-1']);
	assertOnlyKnownRequests(calls(fetch));
});

test('the current folder is active and its parents open; a special view is active', async () => {
	const { wrapper } = await setup({ currentFolder: 'c' });

	expect(names(wrapper)).toEqual(['File Library', 'Alpha', 'Beta', 'Gamma', 'Delta']);
	expect(wrapper.get('[data-key="c"]').attributes('aria-selected')).toBe('true');
	expect(wrapper.get('[data-key="root"]').attributes('aria-selected')).toBe('false');

	await wrapper.setProps({ currentFolder: undefined, currentSpecial: 'mine' });
	expect(wrapper.get('a[href="/files/mine"]').attributes('aria-current')).toBe('page');
});

test('a custom target handler gets the targets instead of the router', async () => {
	const handler = vi.fn();
	const { wrapper } = await setup({ customTargetHandler: handler, actionsDisabled: true });

	await wrapper.get('[data-key="a"] [data-tree-row]').trigger('click');
	await wrapper.get('[data-key="root"] [data-tree-row]').trigger('keydown', { key: 'Enter' });
	await wrapper.findAll('nav > ul:not([role]) button')[2]!.trigger('click');

	expect(handler.mock.calls).toEqual([[{ folder: 'a' }], [{}], [{ special: 'recent' }]]);
	expect(wrapper.find('[data-key="a"] [aria-haspopup="menu"]').exists()).toBe(false);
});

test('tree keyboard: Down moves, Right opens a folder, Left goes to the parent', async () => {
	const { wrapper } = await setup();
	const focused = () => document.activeElement?.closest('[role="treeitem"]')?.getAttribute('data-key');

	await wrapper.get('[data-key="root"] [data-tree-row]').trigger('keydown', { key: 'ArrowDown' });
	await flushPromises();
	expect(focused()).toBe('a');

	await wrapper.get('[data-key="a"] [data-tree-row]').trigger('keydown', { key: 'ArrowRight' });
	expect(names(wrapper)).toEqual(['File Library', 'Alpha', 'Beta', 'Delta']);

	await wrapper.get('[data-key="a"] [data-tree-row]').trigger('keydown', { key: 'ArrowLeft' });
	expect(names(wrapper)).toEqual(['File Library', 'Alpha', 'Delta']);

	await wrapper.get('[data-key="a"] [data-tree-row]').trigger('keydown', { key: 'ArrowLeft' });
	await flushPromises();
	expect(focused()).toBe('root');
});

test('rename sends PATCH /folders/:id with the name and reloads the folders', async () => {
	const { wrapper, fetch } = await setup({}, { 'PATCH /folders/a': { id: 'a', name: 'Renamed' } });

	(wrapper.vm as unknown as { openRename: (f: unknown) => void }).openRename(FOLDERS[0]);
	await flushPromises();

	const input = document.querySelector<HTMLInputElement>('#rename-folder-form input')!;
	input.value = 'Renamed';
	input.dispatchEvent(new Event('input'));
	document.querySelector<HTMLFormElement>('#rename-folder-form')!.requestSubmit();
	await flushPromises();

	expect(calls(fetch)).toEqual(['GET /folders?sort=name&limit=-1', 'PATCH /folders/a', 'GET /folders?sort=name&limit=-1']);
	expect(JSON.parse(fetch.mock.calls[1]![1]!.body as string)).toEqual({ name: 'Renamed' });
	expect(document.querySelector('#rename-folder-form')).toBeNull();
});

test('download posts /assets/folder/:id and saves the zip with its name', async () => {
	const { wrapper, fetch } = await setup(
		{},
		{
			'POST /assets/folder/a': () =>
				new Response('zip', { headers: { 'Content-Disposition': 'attachment; filename="Alpha.zip"' } }),
		},
	);

	await (wrapper.vm as unknown as { downloadFolder: (f: unknown) => Promise<void> }).downloadFolder(FOLDERS[0]);
	await flushPromises();

	expect(calls(fetch)).toContain('POST /assets/folder/a?download=');
	assertOnlyKnownRequests(calls(fetch));
	expect(vi.mocked(fileSaver.saveAs).mock.calls[0]![1]).toBe('Alpha.zip');
});

test('the folder row has a menu button named after the folder; the root has none', async () => {
	const { wrapper } = await setup();

	const trigger = wrapper.get('[data-key="a"] [aria-haspopup="menu"]');
	expect(trigger.attributes('aria-label')).toContain('Alpha');
	expect(wrapper.find('[data-key="root"] [aria-haspopup="menu"]').exists()).toBe(false);
});
