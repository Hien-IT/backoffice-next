// T073 (contracts/tests.md §5, SC-002): BoForm on bo_rel of the fixture snapshot with the real `file`, `file-image` and
// `files` interfaces, BoUpload and the files drawer: US4 scenarios 1-2 and the edit scenarios of
// fixtures/interfaces/snapshot/expected.<id>.json. The only writes an interface sends itself are the FR-054 ones.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, type Pinia, setActivePinia } from 'pinia';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue } from '../api/sdk.ts';
import BoForm from '../components/form/BoForm.vue';
import { i18n } from '../lang/index.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { usePermissionsStore } from '../stores/permissions.ts';
import { useRelationsStore } from '../stores/relations.ts';
import { useUserStore } from '../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../test-utils/fetch.ts';
import { type ExpectedScenario, loadSnapshot, type Row } from '../test-utils/fixtures.ts';

enableAutoUnmount(afterEach);

// Real drawers and forms (or editors) per scenario: slow on loaded CI runners.
vi.setConfig({ testTimeout: 20_000 });

beforeAll(() => import('../components/form/BoForm.vue'));

const IDS = ['file', 'file-image', 'files'];

interface Scenario extends ExpectedScenario {
	collection: string;
	field: string;
	initial: unknown;
	/** Option values of the scenario over the seeded ones (US4 names them). */
	options?: Record<string, unknown>;
}

const snapshot = loadSnapshot();
let fetch: ReturnType<typeof mockFixtureApi>;
// Installed in every mounted app (see relations.fixture.test.ts).
let pinia: Pinia;

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });

beforeEach(async () => {
	Element.prototype.scrollIntoView = vi.fn();
	vi.unstubAllGlobals();
	await replaceQueue();
	pinia = createPinia();
	setActivePinia(pinia);
	fetch = mockFixtureApi(snapshot);
	await useUserStore(pinia).hydrate();

	await Promise.all([
		useFieldsStore(pinia).hydrate(),
		useRelationsStore(pinia).hydrate(),
		useCollectionsStore(pinia).hydrate(),
		usePermissionsStore(pinia).hydrate(),
	]);
});

/** FR-054: the writes an interface sends itself (the item save of the screen is not part of a form test). */
const FR054 = [/^POST \/files$/, /^POST \/files\/import$/, /^POST \/flows\/trigger\/[^/]+$/];
const writes = () => calls(fetch).filter((call) => !call.startsWith('GET '));

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
	expect(writes().filter((call) => !FR054.some((re) => re.test(call.split('?')[0]!)))).toEqual([]);
	vi.restoreAllMocks();
});

/** A `fields=*.*` row as the item page holds it: related objects become their keys. */
function keysOnly(row: Row): Row {
	const key = (value: any) => (value && typeof value === 'object' && 'id' in value ? value.id : value);
	return Object.fromEntries(
		Object.entries(row).map(([name, value]) => [name, Array.isArray(value) ? value.map(key) : key(value)]),
	);
}

const itemOf = (id: number) => keysOnly(snapshot.items['bo_rel']!.find((row) => row['id'] === id)!);
const meta = (field: string) => useFieldsStore(pinia).getField('bo_rel', field)!.meta!;

async function settle(ms = 0) {
	await new Promise((resolve) => setTimeout(resolve, ms));
	await flushPromises();
	await flushPromises();
}

async function mountForm(id: number) {
	const wrapper = mount(BoForm, {
		props: {
			collection: 'bo_rel',
			primaryKey: id,
			initialValues: itemOf(id),
			modelValue: {},
			'onUpdate:modelValue': (edits: Record<string, unknown>) => wrapper.setProps({ modelValue: edits }),
		},
		global: { plugins: [i18n, router, pinia] },
		attachTo: document.body,
	});

	await settle();
	return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountForm>>;

const fieldEl = (wrapper: Wrapper, name: string) => wrapper.get(`[data-field="${name}"]`);
const lastEdits = (wrapper: Wrapper) => wrapper.emitted<[Record<string, unknown>]>('update:modelValue')?.at(-1)?.[0];
const panel = () => [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].at(-1)!;

async function key(el: Element, name: string) {
	(el as HTMLElement).focus();
	el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
	await settle();
}

/** Opens a BoMenu by keyboard and runs the item with this text. */
async function menu(trigger: Element, text: string) {
	await key(trigger, 'Enter');
	const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) =>
		el.textContent!.trim().endsWith(text),
	);
	if (!item) throw new Error(`No menu item "${text}"`);
	await key(item, 'Enter');
}

const button = (root: Element, text: string) =>
	[...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim().endsWith(text));

/** Chooses local files in a BoUpload file input like the browser does. */
async function chooseFiles(input: HTMLInputElement, files: File[]) {
	Object.defineProperty(input, 'files', { value: files, configurable: true });
	input.dispatchEvent(new Event('input'));
	await settle();
}

const png = (name: string) => new File(['png'], name, { type: 'image/png' });
const lastBody = (path: string) => fetch.mock.calls.filter(([url]) => String(url).endsWith(path)).at(-1)![1]!.body;

/* ---------------------------------------------------------------- edit scenarios of expected.<id>.json */

const RUNNERS: Record<string, Record<string, { id: number; run: (wrapper: Wrapper) => Promise<void> }>> = {
	file: {
		'import from a URL into the folder': {
			id: 2,
			run: async (wrapper) => {
				await menu(fieldEl(wrapper, 'file').get('button.activator').element, 'Import File from URL');
				const url = panel().querySelector<HTMLInputElement>('input[type="url"]')!;
				url.value = 'https://example.com/report.pdf';
				url.dispatchEvent(new Event('input'));
				await settle();
				button(panel(), 'Import')!.click();
				await settle();

				// FR-053: folder of the option, accept as filterMimeType
				expect(JSON.parse(String(lastBody('/files/import')))).toEqual({
					url: 'https://example.com/report.pdf',
					data: { folder: 'bo-2' },
					options: { filterMimeType: ['application/pdf'] },
				});
			},
		},
		'choose from the library': {
			id: 2,
			run: async (wrapper) => {
				await menu(fieldEl(wrapper, 'file').get('button.activator').element, 'Choose File from Library');
				await vi.waitFor(() => expect(panel().querySelector('tbody tr td')).not.toBeNull());
				await settle(550);
				// option filter type = application/pdf, merged with allowedMimeTypes
				const rows = [...panel().querySelectorAll('tbody tr')];
				expect(rows.map((tr) => tr.textContent)).toEqual([expect.stringContaining('bo-sample-pdf')]);
				(rows[0]!.querySelector('[role="checkbox"]') as HTMLElement).click();
				await settle();
				panel().querySelector<HTMLButtonElement>('header button[aria-label="Save"]')!.click();
				await settle();
			},
		},
	},
	'file-image': {
		'upload a PNG into the folder, a JPEG is refused': {
			id: 2,
			run: async (wrapper) => {
				const field = fieldEl(wrapper, 'file_image');
				const input = field.get<HTMLInputElement>('input[type="file"]').element;
				expect(input.accept).toBe('image/png');

				await chooseFiles(input, [new File(['jpg'], 'photo.jpg', { type: 'image/jpeg' })]);
				expect(writes()).toEqual([]);
				expect(field.text()).toContain('Files "photo.jpg" (image/jpeg) have invalid types, expecting image/png type.');

				await chooseFiles(input, [png('photo.png')]);
				expect(writes()).toEqual(['POST /files']);
				expect((lastBody('/files') as FormData).get('folder')).toBe('bo-2');

				// US4-1: shown with the contain preset (crop false)
				await vi.waitFor(() =>
					expect(field.get('img').attributes('src')).toBe('http://api.test/assets/bo-new-1?key=system-large-contain'),
				);
			},
		},
	},
	files: {
		'move the first file down': {
			id: 1,
			run: async (wrapper) => {
				const field = fieldEl(wrapper, 'files').element;
				expect([...field.querySelectorAll('li')].map((li) => li.textContent!.trim())).toEqual([
					expect.stringContaining('bo-sample-png'),
					expect.stringContaining('bo-sample-pdf'),
				]);
				await menu(field.querySelector('button.row-menu')!, 'Move down');
			},
		},
		'upload two files into the folder': {
			id: 1,
			run: async (wrapper) => {
				button(fieldEl(wrapper, 'files').element, 'Upload File')!.click();
				await settle();
				await chooseFiles(panel().querySelector<HTMLInputElement>('input[type="file"]')!, [
					png('a.png'),
					new File(['%PDF'], 'b.pdf', { type: 'application/pdf' }),
				]);

				expect(writes()).toEqual(['POST /files', 'POST /files']);
				expect(
					fetch.mock.calls
						.filter(([, init]) => init?.method === 'POST')
						.map(([, init]) => (init!.body as FormData).get('folder')),
				).toEqual(['bo-2', 'bo-2']);
			},
		},
	},
};

test('every file interface has an expected file and every scenario a runner', () => {
	for (const id of IDS)
		expect(Object.keys(snapshot.expected[id] ?? {}).sort(), id).toEqual(Object.keys(RUNNERS[id]!).sort());
});

describe.each(IDS)('expected.%s.json', (id) => {
	const scenarios = Object.entries((snapshot.expected[id] ?? {}) as unknown as Record<string, Scenario>);

	test.each(scenarios)('%s', async (name, scenario) => {
		const { id: itemId, run } = RUNNERS[id]![name]!;
		expect(meta(scenario.field).interface).toBe(id);
		expect(scenario.initial).toEqual(itemOf(itemId)[scenario.field]);
		Object.assign(meta(scenario.field).options!, scenario.options);

		const wrapper = await mountForm(itemId);
		expect(wrapper.emitted('update:modelValue'), 'no edit on mount').toBeUndefined();

		await run(wrapper);

		expect(lastEdits(wrapper)).toHaveProperty([scenario.field]);
		expect(JSON.parse(JSON.stringify(lastEdits(wrapper)![scenario.field]))).toEqual(scenario.value);
	});
});

/* ---------------------------------------------------------------- US4 */

describe('US4 on the bo_rel form', () => {
	test('the seeded files render without an edit; reading them sends no write', async () => {
		const wrapper = await mountForm(1);
		await settle(550);

		expect(fieldEl(wrapper, 'file').text()).toContain('bo-sample-pdf');
		expect(fieldEl(wrapper, 'file_image').get('img').attributes('src')).toBe(
			'http://api.test/assets/bo-4?key=system-large-contain',
		);
		expect(fieldEl(wrapper, 'files').findAll('li')).toHaveLength(2);
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
		expect(writes()).toEqual([]);
	});

	test('US4-1: crop true shows system-large-cover', async () => {
		meta('file_image').options!['crop'] = true;
		const wrapper = await mountForm(1);

		expect(fieldEl(wrapper, 'file_image').get('img').attributes('src')).toBe(
			'http://api.test/assets/bo-4?key=system-large-cover',
		);
	});

	test('US4-2: files with limit 3 and a sort field: sorting is on; "Move up" of the second row writes index + 1', async () => {
		meta('files').options!['limit'] = 3;
		const wrapper = await mountForm(1);
		const field = fieldEl(wrapper, 'files').element;

		await menu(field.querySelectorAll('button.row-menu')[1]!, 'Move up');

		expect(lastEdits(wrapper)).toEqual({
			files: {
				create: [],
				update: [
					{ id: 2, sort: 1, directus_files_id: { id: 'bo-3' } },
					{ id: 1, sort: 2, directus_files_id: { id: 'bo-4' } },
				],
				delete: [],
			},
		});
	});
});
