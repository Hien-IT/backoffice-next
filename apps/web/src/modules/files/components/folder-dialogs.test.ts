// Directus has no tests for add-folder.vue, delete-folder-dialog.vue and folder-section.vue: the create request and
// navigation, the delete modes and their requests, and the folder cards with their selection.
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { replaceQueue } from '../../../api/sdk.ts';
import { resetFoldersForTests } from '../../../composables/use-folders.ts';
import { calls, mockApi } from '../../../test-utils/fetch.ts';
import { mountLayout } from '../../../test-utils/layout.ts';
import AddFolder from './AddFolder.vue';
import DeleteFolderDialog from './DeleteFolderDialog.vue';
import FolderSection from './FolderSection.vue';

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());

beforeEach(async () => {
	resetFoldersForTests();
	await replaceQueue();
});

const dialogButton = (text: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((b) => b.textContent?.trim() === text)!;

test('AddFolder posts the name with the parent, reloads the folders and opens the new folder', async () => {
	const fetch = mockApi({ 'GET /folders': [], 'POST /folders': { id: 'new-id', name: 'Docs' } });
	const { wrapper, router } = await mountLayout(AddFolder, {
		props: { parent: 'p1' },
		routes: [
			{ path: '/files/folders/:folder', name: 'folders-collection', component: { render: () => null } },
			{ path: '/:p(.*)*', component: { render: () => null } },
		],
	});

	await wrapper.get('button[aria-label="Create Folder"]').trigger('click');
	await flushPromises();

	const input = document.querySelector<HTMLInputElement>('#add-folder-form input')!;
	input.value = 'Docs';
	input.dispatchEvent(new Event('input'));
	await flushPromises();
	document.querySelector<HTMLFormElement>('#add-folder-form')!.requestSubmit();
	await flushPromises();

	const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!;
	expect(JSON.parse(post[1]!.body as string)).toEqual({ name: 'Docs', parent: 'p1' });
	expect(calls(fetch).filter((c) => c.startsWith('GET /folders'))).toHaveLength(2);
	expect(router.currentRoute.value.fullPath).toBe('/files/folders/new-id');
});

test('AddFolder is disabled without permission; the root parent is null', async () => {
	mockApi({ 'GET /folders': [] });
	const { wrapper } = await mountLayout(AddFolder, { props: { disabled: true } });

	expect(wrapper.get('button[aria-label="Not Allowed"]').attributes('disabled')).toBeDefined();
});

test('DeleteFolderDialog moves the content up by default, or deletes it all', async () => {
	const fetch = mockApi({
		'GET /folders': [{ id: 'child' }],
		'GET /files': [{ id: 'f1' }],
		'PATCH /folders': null,
		'PATCH /files': null,
		'DELETE /folders': () => new Response(null, { status: 204 }),
		'DELETE /files': () => new Response(null, { status: 204 }),
	});
	const folder = { id: 'a', name: 'A', parent: 'up' };
	const { wrapper } = await mountLayout(DeleteFolderDialog, {
		props: { modelValue: true, folders: [folder], allFolders: [folder, { id: 'child', name: 'C', parent: 'a' }] },
	});

	expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Delete Folder');
	dialogButton('Delete').click();
	await flushPromises();

	expect(calls(fetch)).toContain('PATCH /folders');
	expect(calls(fetch)).toContain('PATCH /files');
	expect(calls(fetch).at(-1)).toBe('DELETE /folders');
	expect(wrapper.emitted('done')).toHaveLength(1);
	expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
});

test('FolderSection renders a card per folder with its link; selecting one updates the selection', async () => {
	const { wrapper } = await mountLayout(FolderSection, {
		props: {
			subfolders: [
				{ id: 'a', name: 'Alpha', parent: null },
				{ id: 'b', name: 'Beta', parent: null },
			],
			selection: [],
			'onUpdate:selection': (value: unknown) => wrapper.setProps({ selection: value as string[] }),
		},
	});

	expect(wrapper.findAll('a').map((a) => a.attributes('href'))).toEqual(['/files/folders/a', '/files/folders/b']);
	expect(wrapper.text()).toContain('Alpha');

	await wrapper.get('[role="checkbox"]').trigger('click');
	await flushPromises();
	expect(wrapper.props('selection')).toEqual(['a']);
});
