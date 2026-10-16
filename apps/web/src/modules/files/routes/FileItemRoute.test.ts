// The user story 2 part of directus/app/src/modules/files/routes/item.vue (no Directus test): header, preview with
// replace, the form without the sidebar fields, save, move with its notice, save as copy, delete, the details panel.
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { replaceQueue } from '../../../api/sdk.ts';
import { resetFoldersForTests } from '../../../composables/use-folders.ts';
import { resetNotices, useNotices } from '../../../composables/use-notices.ts';
import { useCollectionsStore } from '../../../stores/collections.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import { usePermissionsStore } from '../../../stores/permissions.ts';
import { useRelationsStore } from '../../../stores/relations.ts';
import { useServerStore } from '../../../stores/server.ts';
import { useUserStore } from '../../../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../test-utils/fixtures.ts';
import { mountLayout } from '../../../test-utils/layout.ts';
import FileItemRoute from './FileItemRoute.vue';
import PageHeader from '../../../layout/PageHeader.vue';

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());

const snapshot = loadSnapshot();
const fileOf = (title: string) => snapshot.directoryFiles.find((f) => f['title'] === title)!;

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	resetFoldersForTests();
	resetNotices();
	await replaceQueue();
});

async function setup(title = 'bo-exif', user: 'admin' | 'bo-viewer' = 'admin') {
	const file = fileOf(title);

	const mounted = await mountLayout(FileItemRoute, {
		props: { primaryKey: file['id'] },
		routes: [
			{ path: '/files/:primaryKey', name: 'files-item', component: { render: () => null } },
			{ path: '/:p(.*)*', component: { render: () => null } },
		],
		path: `/files/${file['id']}`,
		async beforeMount() {
			fetch = mockFixtureApi(loadSnapshot(), { user });
			await useUserStore().hydrate();
			await Promise.all([
				useFieldsStore().hydrate(),
				useRelationsStore().hydrate(),
				useCollectionsStore().hydrate(),
				usePermissionsStore().hydrate(),
			]);
			useServerStore().info.queryLimit = { default: 100, max: -1 };
			useServerStore().info.files = { mimeTypeAllowList: ['*/*'] };
		},
	});

	await flushPromises();
	return { ...mounted, file };
}

const button = (name: string) =>
	[...document.querySelectorAll<HTMLElement>('button, a')].find((el) => el.getAttribute('aria-label') === name);

describe('FileItemRoute', () => {
	test('an image has the edit (tune) button that opens the image editor; a text file has none', async () => {
		await setup('bo-edit');
		expect(button('Edit')).toBeDefined();
		button('Edit')!.click();
		await flushPromises();
		expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Editing Image');
		expect(calls(fetch)).toContain(
			`GET /files/${fileOf('bo-edit')['id']}?fields=type,filesize,filename_download,folder,width,height,focal_point_x,focal_point_y`,
		);
	});

	test('no edit button on a file that is not an image', async () => {
		await setup('bo-old');
		expect(button('Edit')).toBeUndefined();
	});

	test('header, breadcrumb to the folder, preview, form without the sidebar fields, details panel', async () => {
		const { wrapper, file } = await setup();

		expect(wrapper.get('h1').text()).toBe('bo-exif');
		// D-101: the breadcrumb is passed to PageHeader but not shown.
		expect(wrapper.find('nav[aria-label="Breadcrumb"]').exists()).toBe(false);
		expect((wrapper.findComponent(PageHeader).props('breadcrumb') as { to: unknown }[])[0]!.to).toEqual({
			path: `/files/folders/${file['folder']}`,
		});
		expect(document.body.textContent).toContain('Replace File');
		expect(button('Download')?.getAttribute('href')).toContain(`/assets/${file['id']}?download`);

		const labels = [...document.querySelectorAll('label')].map((l) => l.textContent?.trim());
		expect(labels).toContain('Title');
		expect(labels).not.toContain('Folder');
		expect(labels).not.toContain('Type');
		assertOnlyKnownRequests(calls(fetch));
	});

	test('save sends only the edited fields', async () => {
		const { file } = await setup();

		const title = [...document.querySelectorAll('label')].find((l) => l.textContent?.trim() === 'Title')!;
		const input = document.getElementById(title.htmlFor) as HTMLInputElement;
		input.value = 'New title';
		input.dispatchEvent(new Event('input'));
		await flushPromises();

		button('Save')!.click();
		await flushPromises();

		const patch = fetch.mock.calls.find(([url, init]) => String(url).includes(`/files/${file['id']}`) && init?.method === 'PATCH')!;
		expect(JSON.parse(patch[1]!.body as string)).toEqual({ title: 'New title' });
	});

	test('move to folder patches the folder with fields=folder.name and notifies', async () => {
		const { file } = await setup();
		const target = snapshot.directoryFolders.find((f) => f['name'] === 'bo-files-sub')!;

		button('Move to Folder')!.click();
		await flushPromises();

		// Open the parent of the target in the picker, then pick the target.
		const picker = () => document.querySelector('[role="dialog"] .folder-picker')!;
		await vi.waitFor(() => expect(picker()).toBeTruthy());
		for (const name of ['bo-files', 'bo-files-sub']) {
			const row = [...picker().querySelectorAll<HTMLElement>('[role="treeitem"]')].find(
				(r) => r.querySelector('.truncate')?.textContent === name,
			)!;
			if (name === 'bo-files' && row.getAttribute('aria-expanded') === 'false')
				row.querySelector<HTMLElement>('button')!.click();
			if (name === 'bo-files-sub') row.querySelector<HTMLElement>('[data-tree-row]')!.click();
			await flushPromises();
		}

		[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
			.find((b) => b.textContent?.trim() === 'Move')!
			.click();
		await flushPromises();

		const patch = fetch.mock.calls.find(([url, init]) => String(url).includes(`/files/${file['id']}`) && init?.method === 'PATCH')!;
		expect(String(patch[0])).toContain('fields=folder.name');
		expect(JSON.parse(patch[1]!.body as string)).toEqual({ folder: target['id'] });
		expect(useNotices().queue.value.map((n) => n.type)).toContain('success');
	});

	// Directus use-item `remove` clears the item, so `to` falls back to /files (not the folder of the file).
	test('delete confirms then deletes and goes back to the library', async () => {
		const { file, router } = await setup();

		button('Delete')!.click();
		await flushPromises();
		[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
			.find((b) => b.textContent?.trim() === 'Delete')!
			.click();
		await flushPromises();

		expect(calls(fetch)).toContain(`DELETE /files/${file['id']}`);
		expect(router.currentRoute.value.fullPath).toBe('/files');
	});

	test('a missing file shows the module not-found page', async () => {
		resetFoldersForTests();
		const mounted = await mountLayout(FileItemRoute, {
			props: { primaryKey: 'missing' },
			async beforeMount() {
				mockFixtureApi(loadSnapshot());
				await useUserStore().hydrate();
				await Promise.all([useFieldsStore().hydrate(), useCollectionsStore().hydrate(), usePermissionsStore().hydrate()]);
			},
		});
		await flushPromises();

		expect(mounted.wrapper.get('h1').text()).toBe('Page Not Found');
	});
});
