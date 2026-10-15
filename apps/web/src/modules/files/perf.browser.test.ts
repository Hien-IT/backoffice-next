// Feature 015 T097 (SC-007, FR-003, FR-012, FR-019): the Files module under load, in chromium with the production Vue
// build (runs with PERF=1 only, vitest.config.ts). Budgets hold on the reference machine and scale with
// machineFactor() elsewhere (test-utils/perf.ts); renders are mounted with createApp and timed to a settled frame
// (promises flushed, two animation frames), median of 3 warm runs.
// - the folder tree (FilesNavigation) with 500 folders on 3 levels, all open, renders in under 500 ms;
// - the cards layout with 100 file cards (1×1 PNG data-URL thumbnails, no network) and 20 folder cards in its `prepend`
//   slot (FolderSection, as the library route renders them) renders in under 1 s;
// - dropping 20 files of 1 MB on the library with `uploads.maxConcurrency` 5 keeps at most 5 uploads in flight and
//   reloads the list once at the end.
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { type App, createApp, h, type VNode } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import FilesNavigation from '../../components/files/FilesNavigation.vue';
import { resetFoldersForTests, useFolders } from '../../composables/use-folders.ts';
import { i18n } from '../../lang/index.ts';
import Cards from '../../layouts/cards/Cards.vue';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { usePresetsStore } from '../../stores/presets.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useServerStore } from '../../stores/server.ts';
import { useUserStore } from '../../stores/user.ts';
import '../../styles/index.css';
import { calls, json, mockApi, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import { mountLayout } from '../../test-utils/layout.ts';
import { machineFactor } from '../../test-utils/perf.ts';
import FolderSection from './components/FolderSection.vue';
import FilesCollectionRoute from './routes/FilesCollectionRoute.vue';

// 1×1 transparent PNG: card thumbnails load without a request.
const PIXEL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

vi.mock('../../utils/get-asset-url.ts', () => ({ getAssetUrl: () => PIXEL }));

const RUNS = 3;
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

enableAutoUnmount(afterEach);

let app: App | null = null;

afterEach(() => {
	app?.unmount();
	app = null;
	vi.unstubAllGlobals();
});

beforeEach(async () => {
	resetFoldersForTests();
	localStorage.clear();
	await replaceQueue();
	setActivePinia(createPinia());
});

/** Mounts `render` with createApp (not @vue/test-utils mount: its per-component hooks add time) and times it. */
async function timeRender(router: Router, render: () => VNode): Promise<number> {
	const start = performance.now();
	app = createApp({ render }).use(i18n).use(router);
	app.mount(document.body.appendChild(document.createElement('div')));
	await flushPromises();
	await frame();
	await frame();
	return performance.now() - start;
}

function report(name: string, timings: number[], budget: number) {
	const factor = machineFactor();
	// eslint-disable-next-line no-console
	console.log(
		`SC-007 ${name}: ${timings.map((t) => t.toFixed(0)).join(', ')} ms (median ${median(timings).toFixed(0)}, budget ${(budget * factor).toFixed(0)}, machine factor ${factor.toFixed(2)})`,
	);
	expect(median(timings)).toBeLessThan(budget * factor);
}

test('the folder tree with 500 folders on 3 levels, all open, renders in under 500 ms', async () => {
	// 20 top folders × 4 children × 5 grandchildren = 20 + 80 + 400.
	const folders: { id: string; name: string; parent: string | null }[] = [];

	for (let a = 0; a < 20; a++) {
		folders.push({ id: `f${a}`, name: `Folder ${a}`, parent: null });
		for (let b = 0; b < 4; b++) {
			folders.push({ id: `f${a}-${b}`, name: `Folder ${a}.${b}`, parent: `f${a}` });
			for (let c = 0; c < 5; c++)
				folders.push({ id: `f${a}-${b}-${c}`, name: `Folder ${a}.${b}.${c}`, parent: `f${a}-${b}` });
		}
	}

	expect(folders).toHaveLength(500);
	mockApi({ 'GET /folders': folders });

	// The folders load once per app session (SC-007): time the render with them loaded and every folder open.
	const { fetchFolders, openFolders } = useFolders();
	await fetchFolders();
	openFolders.value = ['root', ...folders.map((f) => f.id)];

	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });
	await router.push('/files');

	const render = () => h(FilesNavigation);

	// Warm-up: the first mount loads the lazy code the dev server transforms on demand.
	await timeRender(router, render);
	app!.unmount();

	const timings: number[] = [];

	for (let run = 0; run < RUNS; run++) {
		timings.push(await timeRender(router, render));
		expect(document.querySelectorAll('[role="treeitem"]')).toHaveLength(501);
		app!.unmount();
		app = null;
	}

	report('folder tree 500 folders', timings, 500);
});

test('the cards layout with 100 file cards and 20 folder cards renders in under 1 s', async () => {
	mockFixtureApi(loadSnapshot());
	await useUserStore().hydrate();
	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);

	const files = Array.from({ length: 100 }, (_, index) => {
		const file = {
			id: `file-${index}`,
			title: `Image ${index}`,
			type: 'image/png',
			filesize: 1000 + index,
			modified_on: '2026-10-01T00:00:00.000Z',
		};
		return { ...file, $thumbnail: file };
	});

	const subfolders = Array.from({ length: 20 }, (_, index) => ({
		id: `folder-${index}`,
		name: `Folder ${index}`,
		parent: null,
	}));

	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });
	await router.push('/files');

	// The props the cards wrapper gives the layout for directus_files (presets store system default: title, subtitle,
	// size 4, crop, image source `$thumbnail`), as FilesCollectionRoute binds them.
	const render = (count: number) => () =>
		h(
			Cards,
			{
				collection: 'directus_files',
				items: files.slice(0, count),
				selection: [],
				selectMode: false,
				readonly: false,
				limit: 100,
				size: 4,
				icon: 'insert_drive_file',
				imageFit: 'crop',
				isSingleRow: false,
				width: 1200,
				totalPages: 1,
				page: 1,
				toPage: () => undefined,
				getLinkForItem: (item: Record<string, any>) => `/files/${item['id']}`,
				fieldsInCollection: [],
				selectAll: () => undefined,
				resetPresetAndRefresh: async () => undefined,
				sort: ['-uploaded_on'],
				loading: false,
				loadingItemCount: false,
				itemCount: 100,
				totalCount: 100,
				primaryKeyField: { field: 'id' } as never,
				imageSource: '$thumbnail',
				title: '{{ title }}',
				subtitle: '{{ type }} • {{ filesize }}',
				extraSelection: [],
				hasPrependContent: true,
			},
			{ prepend: () => h(FolderSection, { subfolders, selection: [] }) },
		);

	await timeRender(router, render(10));
	app!.unmount();

	const timings: number[] = [];

	for (let run = 0; run < RUNS; run++) {
		timings.push(await timeRender(router, render(100)));
		expect(document.querySelectorAll('a[href^="/files/folders/"]')).toHaveLength(20);
		expect(document.querySelectorAll('a[href^="/files/file-"]')).toHaveLength(100);
		app!.unmount();
		app = null;
	}

	report('cards 100 files + 20 folders', timings, 1000);
});

describe('dropping 20 files on the library', () => {
	test('at most maxConcurrency (5) uploads in flight; the list reloads once at the end', async () => {
		let inFlight = 0;
		let maxInFlight = 0;
		let uploaded = 0;
		let fetch!: ReturnType<typeof mockFixtureApi>;

		await mountLayout(FilesCollectionRoute, {
			path: '/files',
			async beforeMount() {
				fetch = mockFixtureApi(loadSnapshot(), {
					answers: {
						'POST /files': async () => {
							inFlight++;
							maxInFlight = Math.max(maxInFlight, inFlight);
							await new Promise((resolve) => setTimeout(resolve, 20));
							inFlight--;
							return json({ data: { id: `upload-${++uploaded}` } });
						},
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
				useServerStore().info.uploads = { maxConcurrency: 5 };
			},
		});

		await vi.waitFor(() => expect(document.querySelector('a[href^="/files/folders/"]')).not.toBeNull());
		await flushPromises();
		const before = calls(fetch).length;

		const files = Array.from(
			{ length: 20 },
			(_, index) => new File([new Uint8Array(1_000_000)], `drop-${index}.txt`, { type: 'text/plain' }),
		);
		const drop = new Event('drop', { bubbles: true, cancelable: true });
		Object.defineProperty(drop, 'dataTransfer', { value: { types: ['Files'], files } });
		window.dispatchEvent(drop);

		await vi.waitFor(() => expect(uploaded).toBe(20), { timeout: 10_000 });
		await vi.waitFor(() => expect(document.body.textContent).not.toContain('/20'));
		await flushPromises();
		await frame();
		await flushPromises();

		const after = calls(fetch).slice(before);
		const lists = after.filter((call) => call.startsWith('GET /files?') && !call.includes('aggregate'));
		const counts = after.filter((call) => call.startsWith('GET /files?') && call.includes('aggregate'));

		// eslint-disable-next-line no-console
		console.log(
			`SC-007 drop 20 files: max ${maxInFlight} in flight; after: ${lists.length} list, ${counts.length} count`,
		);
		expect(after.filter((call) => call === 'POST /files')).toHaveLength(20);
		expect(maxInFlight).toBe(5);
		expect(lists).toHaveLength(1);
		// SC-007 says "1 list + 1 count"; the counts go through use-items' memoized fetchAggregate (useMemoize, as
		// directus/packages/composables/src/use-items.ts), so the same filter answers from memory: no count request.
		expect(counts).toHaveLength(0);
	});
});
