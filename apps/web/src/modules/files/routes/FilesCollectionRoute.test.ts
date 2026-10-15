// The user stories 1 and 2 parts of directus/app/src/modules/files/routes/collection.vue (no Directus test): title and
// breadcrumb by folder or special view, the folder filter, folder cards in the layout `prepend` slot with
// `extraSelection`, the buttons shown by the selection and permissions, batch move and delete, downloads, the drop
// zone and the upload progress.
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import fileSaver from 'file-saver';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { replaceQueue } from '../../../api/sdk.ts';
import { resetFoldersForTests } from '../../../composables/use-folders.ts';
import { resetNotices } from '../../../composables/use-notices.ts';
import { useCollectionsStore } from '../../../stores/collections.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import { usePermissionsStore } from '../../../stores/permissions.ts';
import { usePresetsStore } from '../../../stores/presets.ts';
import { useRelationsStore } from '../../../stores/relations.ts';
import { useServerStore } from '../../../stores/server.ts';
import { useUserStore } from '../../../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../test-utils/fixtures.ts';
import { mountLayout } from '../../../test-utils/layout.ts';
import FilesCollectionRoute from './FilesCollectionRoute.vue';

vi.mock('file-saver', () => ({ default: { saveAs: vi.fn() } }));

vi.mock('../../../layouts/index.ts', () => {
	const slot = (name: string) =>
		defineComponent({ inheritAttrs: false, setup: () => () => h('div', { [`data-${name}`]: '' }, name) });

	// A cards stand-in: shows the system filter, renders the prepend slot, and lets the test select files or fire
	// select-all through the layout state handlers.
	const component = defineComponent({
		inheritAttrs: false,
		setup:
			(_, { attrs, slots }) =>
			() =>
				h(
					'div',
					{
						'data-layout': '',
						'data-filter-system': JSON.stringify(attrs['filterSystem'] ?? null),
						'data-filter': JSON.stringify(attrs['filter'] ?? null),
						'data-search': String(attrs['search'] ?? ''),
						'data-has-prepend': String(attrs['has-prepend-content'] ?? attrs['hasPrependContent']),
						'data-extra': JSON.stringify(attrs['extra-selection'] ?? attrs['extraSelection'] ?? []),
					},
					[
						h('button', {
							'data-test': 'select-files',
							onClick: () => (attrs['onUpdate:selection'] as (v: unknown) => void)(['file-1', 'file-2']),
						}),
						h('button', { 'data-test': 'select-one', onClick: () => (attrs['onUpdate:selection'] as (v: unknown) => void)(['file-1']) }),
						h('button', { 'data-test': 'select-all', onClick: () => (attrs['onSelectAll'] as () => void)() }),
						h('div', { 'data-prepend': '' }, slots['prepend']?.()),
						slots['no-items']?.(),
					],
				),
	});

	const cards = {
		id: 'cards',
		name: 'Cards',
		icon: 'grid_view',
		component,
		slots: { options: slot('options'), sidebar: slot('sidebar'), actions: slot('actions') },
		setup: () => ({}),
	};

	return { getLayouts: () => [cards], getLayout: (id: string) => (id === 'cards' ? cards : undefined) };
});

enableAutoUnmount(afterEach);
afterEach(() => {
	vi.unstubAllGlobals();
	vi.mocked(fileSaver.saveAs).mockReset();
});

const snapshot = loadSnapshot();
const folderId = (name: string) => snapshot.directoryFolders.find((f) => f['name'] === name)!['id'] as string;

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	resetFoldersForTests();
	resetNotices();
	localStorage.clear();
	await replaceQueue();
});

async function setup(props: Record<string, unknown> = {}, user: 'admin' | 'bo-viewer' = 'admin') {
	const mounted = await mountLayout(FilesCollectionRoute, {
		props,
		path: props['folder'] ? `/files/folders/${props['folder']}` : '/files',
		async beforeMount() {
			fetch = mockFixtureApi(loadSnapshot(), {
				user,
				answers: {
					'POST /assets/files': () =>
						new Response('zip', { headers: { 'Content-Disposition': 'attachment; filename="files.zip"' } }),
				},
			});
			await useUserStore().hydrate();
			await Promise.all([
				useFieldsStore().hydrate(),
				useRelationsStore().hydrate(),
				useCollectionsStore().hydrate(),
				usePermissionsStore().hydrate(),
				usePresetsStore().hydrate(),
			]);
			useServerStore().info.queryLimit = { default: 100, max: -1 };
			useServerStore().info.files = { mimeTypeAllowList: ['*/*'] };
		},
	});

	await flushPromises();
	return mounted;
}

const layout = () => document.querySelector<HTMLElement>('[data-layout]')!;
const buttonNamed = (name: string) =>
	[...document.querySelectorAll<HTMLElement>('button, a')].find((el) => el.getAttribute('aria-label') === name);
const folderCards = () =>
	[...document.querySelectorAll('[data-prepend] a')].map((a) => a.textContent?.trim().replace(/^folder/, ''));

describe('library views', () => {
	test('root: File Library, no breadcrumb, files without folder, the root folders as cards', async () => {
		const { wrapper } = await setup();

		expect(wrapper.get('h1').text()).toBe('File Library');
		expect(wrapper.find('nav[aria-label="Breadcrumb"]').exists()).toBe(false);
		expect(JSON.parse(layout().dataset['filterSystem']!)).toEqual({
			_and: [{ type: { _nnull: true } }, { folder: { _null: true } }],
		});
		expect(layout().dataset['hasPrepend']).toBe('true');
		expect(folderCards()).toEqual(expect.arrayContaining(['bo-files', 'bo-fixtures']));
		assertOnlyKnownRequests(calls(fetch));
	});

	test('a folder: its name, the library breadcrumb, its files and its sub folders', async () => {
		const { wrapper } = await setup({ folder: folderId('bo-files') });

		expect(wrapper.get('h1').text()).toBe('bo-files');
		expect(wrapper.get('nav[aria-label="Breadcrumb"] a').text()).toBe('File Library');
		expect(JSON.parse(layout().dataset['filterSystem']!)._and[1]).toEqual({ folder: { _eq: folderId('bo-files') } });
		expect(folderCards()).toEqual(['bo-files-sub']);
	});

	test('my files: uploaded by me, no folder cards', async () => {
		const { wrapper } = await setup({ special: 'mine' });

		expect(wrapper.get('h1').text()).toBe('My Files');
		const me = snapshot.users.admin.me.id;
		expect(JSON.parse(layout().dataset['filterSystem']!)).toEqual({
			_and: [{ type: { _nnull: true } }, { uploaded_by: { _eq: me } }],
		});
		expect(document.querySelector('[data-prepend] a')).toBeNull();
	});
});

describe('selection and batch actions', () => {
	test('files selected: move, delete, edit and download; select all picks the sub folders', async () => {
		await setup({ folder: folderId('bo-files') });

		expect(buttonNamed('Move to Folder')).toBeUndefined();
		(document.querySelector('[data-test="select-files"]') as HTMLElement).click();
		await flushPromises();

		expect(buttonNamed('Move to Folder')).toBeDefined();
		expect(buttonNamed('Download')).toBeDefined();
		expect(buttonNamed('Edit')).toBeDefined();

		(document.querySelector('[data-test="select-all"]') as HTMLElement).click();
		await flushPromises();
		expect(JSON.parse(layout().dataset['extra']!)).toEqual([folderId('bo-files-sub')]);
		// With folders in the selection only delete stays (Directus).
		expect(buttonNamed('Move to Folder')).toBeUndefined();
		expect(buttonNamed('Delete')).toBeDefined();
	});

	test('download of several files posts /assets/files and saves the zip', async () => {
		await setup();

		(document.querySelector('[data-test="select-files"]') as HTMLElement).click();
		await flushPromises();
		buttonNamed('Download')!.click();
		await flushPromises();

		expect(calls(fetch)).toContain('POST /assets/files?download=');
		expect(JSON.parse(fetch.mock.calls.find(([url]) => String(url).includes('/assets/files'))![1]!.body as string)).toEqual({
			ids: ['file-1', 'file-2'],
		});
		expect(vi.mocked(fileSaver.saveAs).mock.calls[0]![1]).toBe('files.zip');
		assertOnlyKnownRequests(calls(fetch));
	});

	test('batch delete of files sends DELETE /files with the keys after the confirmation', async () => {
		await setup();

		(document.querySelector('[data-test="select-one"]') as HTMLElement).click();
		await flushPromises();
		buttonNamed('Delete')!.click();
		await flushPromises();

		const confirm = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
			(b) => b.textContent?.trim() === 'Delete',
		)!;
		confirm.click();
		await flushPromises();

		const call = fetch.mock.calls.find(([url, init]) => String(url).endsWith('/files') && init?.method === 'DELETE')!;
		expect(JSON.parse(call[1]!.body as string)).toEqual(['file-1']);
	});

	test('a viewer without create or delete rights sees the upload button disabled', async () => {
		await setup({}, 'bo-viewer');

		const add = buttonNamed('Not Allowed');
		expect(add).toBeDefined();
		expect(add!.hasAttribute('disabled')).toBe(true);
	});
});

describe('drop zone', () => {
	function dragEvent(type: string, files: globalThis.File[] = []) {
		const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
		Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files } });
		return event;
	}

	test('dragging files shows the drop notice and the border; dropping uploads into the folder and shows progress', async () => {
		await setup({ folder: folderId('bo-files') });

		window.dispatchEvent(dragEvent('dragenter'));
		await flushPromises();
		expect(document.body.textContent).toContain('Drop to Upload');
		expect(document.querySelectorAll('[aria-hidden="true"].fixed').length).toBe(4);

		let resolve!: (r: Response) => void;
		const pending = new Promise<Response>((r) => (resolve = r));
		const realFetch = globalThis.fetch;
		vi.stubGlobal('fetch', (input: RequestInfo, init?: RequestInit) =>
			String(input).endsWith('/files') && init?.method === 'POST' ? pending : realFetch(input, init),
		);

		window.dispatchEvent(dragEvent('drop', [new File(['a'], 'a.txt', { type: 'text/plain' })]));
		await flushPromises();

		expect(document.querySelectorAll('[aria-hidden="true"].fixed').length).toBe(0);
		expect(document.body.textContent).toContain('0/1');

		resolve(new Response(JSON.stringify({ data: { id: 'up-1' } }), { headers: { 'Content-Type': 'application/json' } }));
		await flushPromises();
		expect(document.body.textContent).not.toContain('0/1');
	});
});

describe('search, filter and preset (FR-015, FR-018, US6-1)', () => {
	test('a search goes to the layout with the folder filter merged; the preset saves search and filter after 450 ms', async () => {
		const folder = folderId('bo-files');
		await setup({ folder });
		fetch.mockClear();

		const search = document.querySelector<HTMLInputElement>('input[type="search"]')!;
		search.value = 'logo';
		search.dispatchEvent(new Event('input'));
		await flushPromises();

		expect(layout().dataset['search']).toBe('logo');
		expect(JSON.parse(layout().dataset['filterSystem']!)._and).toContainEqual({ folder: { _eq: folder } });

		await new Promise((resolve) => setTimeout(resolve, 600));
		await flushPromises();
		const write = fetch.mock.calls.find(([url, init]) => String(url).includes('/presets') && init?.method !== 'GET');
		expect(write).toBeDefined();
		const body = JSON.parse(String(write![1]!.body));
		expect(body).toMatchObject({ collection: 'directus_files', search: 'logo' });
		// The system (folder) filter is not part of the preset.
		expect(JSON.stringify(body.filter ?? null)).not.toContain(folder);
	});
});

