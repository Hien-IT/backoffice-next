// T081 (contracts/tests.md §5, SC-002) in chromium: the edit scenarios of fixtures/interfaces/snapshot/expected.<id>.json
// for the heavy bo_std interfaces (US5 scenarios 2-4): Editor.js block JSON, map geometry per field type, the list
// repeater, markdown image insertion with imageToken. Each mounts the registered interface like FormFieldInterface
// (options spread as props) on the fixture API. Not compared (spec Assumptions): Editor.js `time` and block `id`;
// map coordinates come from a click on the map centre, compared to 2 decimals. input-rich-text-html (TinyMCE, T075)
// is not part of this file.
import { userEvent } from '@vitest/browser/context';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, type Pinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue } from '../api/sdk.ts';
import { i18n } from '../lang/index.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../test-utils/fetch.ts';
import { type ExpectedScenario, fieldsOf, loadSnapshot } from '../test-utils/fixtures.ts';
import { translate } from '../utils/translate-object-values.ts';
import { getInterface } from './index.ts';
import '../styles/index.css';

interface Scenario extends ExpectedScenario {
	field: string;
	/** The value mounted: a seeded one (bo_std items 1-3), or a Directus-shaped value written for the scenario. */
	initial: unknown;
	/** Option values of the scenario over the seeded ones. */
	options?: Record<string, unknown>;
	action: string | string[];
}

// Real drawers and forms (or editors) per scenario: slow on loaded CI runners.
vi.setConfig({ testTimeout: 20_000 });

const IDS = ['input-rich-text-md', 'input-block-editor', 'map', 'list'];

const snapshot = loadSnapshot();
const fields = fieldsOf('bo_std');
const webgl = document.createElement('canvas').getContext('webgl') !== null;

// 1x1 transparent PNG for every map tile, answered locally.
const PNG = Uint8Array.from(
	atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='),
	(c) => c.charCodeAt(0),
);

let fetch: ReturnType<typeof mockFixtureApi>;
let pinia: Pinia;
let wrapper: VueWrapper | undefined;
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	pinia = createPinia();
	setActivePinia(pinia);
	fetch = mockFixtureApi(snapshot);
	await useCollectionsStore(pinia).hydrate();

	// OpenStreetMap tiles of the map (FR-081) never reach the fixture API.
	const api = window.fetch;
	vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
		String(input instanceof Request ? input.url : input).includes('tile.openstreetmap.org')
			? Promise.resolve(new Response(PNG, { headers: { 'Content-Type': 'image/png' } }))
			: api(input, init),
	);
});

afterEach(() => {
	wrapper?.unmount();
	wrapper = undefined;
	document.body.innerHTML = '';
	assertOnlyKnownRequests(calls(fetch));
	vi.unstubAllGlobals();
});

/** Mounts the registered interface like FormFieldInterface, with v-model on `input` like the form. */
async function mountInterface(id: string, scenario: Scenario) {
	const field = fields.find((f) => f.field === scenario.field)!;
	// The heavy interfaces are async components (own chunk, R12): mount the loaded one to reach its emits.
	const component = getInterface(id)!.component as { __asyncLoader?: () => Promise<unknown> };
	const loaded = component.__asyncLoader ? await component.__asyncLoader() : component;

	const mounted: VueWrapper = mount(loaded as never, {
		props: {
			...translate({ ...(field.meta?.options ?? {}), ...scenario.options }),
			value: scenario.initial,
			type: field.type,
			collection: field.collection,
			field: field.field,
			fieldData: field,
			width: field.meta?.width ?? 'full',
			primaryKey: 1,
			onInput: (next: unknown) => mounted.setProps({ value: next }),
		} as never,
		global: { plugins: [i18n, router, pinia] },
		attachTo: document.body,
	});

	wrapper = mounted;
	return mounted;
}

const settle = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms)).then(() => flushPromises());

/** Puts the caret at the end of a contenteditable element. */
function caretAtEnd(el: HTMLElement) {
	el.focus();
	const range = document.createRange();
	range.selectNodeContents(el);
	range.collapse(false);
	getSelection()!.removeAllRanges();
	getSelection()!.addRange(range);
}

async function waitForBlocks(mounted: VueWrapper, count: number) {
	await vi.waitFor(() => expect(mounted.findAll('.ce-block').length).toBeGreaterThanOrEqual(count), {
		timeout: 10_000,
	});
	await settle();
}

async function waitForMap(mounted: VueWrapper) {
	await vi.waitFor(() => expect(mounted.get('[role="group"]').attributes('aria-busy')).toBe('false'), {
		timeout: 15_000,
	});
}

const lastInput = (mounted: VueWrapper) => mounted.emitted('input')?.at(-1)?.[0];

/** Types into a field of the list drawer. */
async function typeInDrawer(name: string, text: string) {
	const input = document.querySelector<HTMLInputElement>(`.bo-drawer [data-field="${name}"] input`)!;
	input.value = text;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	await flushPromises();
}

const drawerSave = () => document.querySelector<HTMLButtonElement>('.bo-drawer button[aria-label="Save"]')!;

/* ---------------------------------------------------------------- runners */

type Runner = (mounted: VueWrapper) => Promise<void>;

const RUNNERS: Record<string, Record<string, Runner>> = {
	'input-rich-text-md': {
		'insert an uploaded image with the image token': async (mounted) => {
			await vi.waitFor(() => expect(mounted.find('.CodeMirror').exists()).toBe(true));
			await userEvent.click(mounted.get('[role="toolbar"] button:not([data-toolbar])').element);
			await userEvent.click(mounted.get('[data-toolbar="image"]').element);

			const input = await vi.waitFor(() => {
				const found = document.querySelector<HTMLInputElement>('[role="dialog"] input[type="file"]');
				expect(found).not.toBeNull();
				return found!;
			});
			Object.defineProperty(input, 'files', {
				value: [new File(['png'], 'sample.png', { type: 'image/png' })],
				configurable: true,
			});
			input.dispatchEvent(new Event('input'));

			await vi.waitFor(() => expect(mounted.emitted('input')).toBeDefined());
			// FR-053: the upload goes to the folder of the option
			const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!;
			expect((post[1]!.body as FormData).get('folder')).toBe('bo-2');
		},
	},
	'input-block-editor': {
		'type at the end of the heading': async (mounted) => {
			await waitForBlocks(mounted, 3);
			expect(mounted.emitted('input'), 'no input on mount').toBeUndefined();
			caretAtEnd(mounted.get('.ce-header').element as HTMLElement);
			await userEvent.keyboard('!');
			await vi.waitFor(() => expect(mounted.emitted('input')).toBeDefined(), { timeout: 3000 });
		},
		'dangerous HTML of a stored value is sanitized': async (mounted) => {
			await waitForBlocks(mounted, 1);
			expect(mounted.get('.ce-paragraph').html()).not.toContain('onerror');
			caretAtEnd(mounted.get('.ce-paragraph').element as HTMLElement);
			await userEvent.keyboard('!');
			await vi.waitFor(() => expect(mounted.emitted('input')).toBeDefined(), { timeout: 3000 });
		},
		'no block left is null': async (mounted) => {
			await waitForBlocks(mounted, 1);
			caretAtEnd(mounted.get('.ce-paragraph').element as HTMLElement);
			await userEvent.keyboard('{Backspace}');
			await vi.waitFor(() => expect(mounted.emitted('input')).toBeDefined(), { timeout: 3000 });
		},
	},
	map: Object.fromEntries(
		['json field: GeoJSON', 'text field: WKT', 'csv field: [lng, lat]', 'geometry field: GeoJSON'].map((name) => [
			name,
			async (mounted: VueWrapper) => {
				await waitForMap(mounted);
				const point = mounted.get('[data-control="draw-Point"]');
				// map.vue takes the geometry type from a geometry.<Type> field only (the `geometryType` option of json,
				// text and csv fields is not read): a null geometry.Point starts in point mode, the others need the button.
				if (mounted.props('type' as never) === 'geometry.Point') expect(point.attributes('aria-pressed')).toBe('true');
				else await userEvent.click(point.element);
				await userEvent.click(mounted.get('canvas.maplibregl-canvas').element);
				await vi.waitFor(() => expect(mounted.emitted('input')).toBeDefined());
			},
		]),
	),
	list: {
		'add two rows; the required sub-field blocks saving': async (mounted) => {
			await userEvent.click(mounted.get('.actions button').element);
			await vi.waitFor(() => expect(drawerSave()).not.toBeNull());
			// title is required: the row cannot be saved empty
			expect(drawerSave().disabled).toBe(true);
			await typeInDrawer('title', 'First');
			await typeInDrawer('count', '3');
			expect(drawerSave().disabled).toBe(false);
			await userEvent.click(drawerSave());
			await vi.waitFor(() => expect(document.querySelector('.bo-drawer')).toBeNull());

			await userEvent.click(mounted.get('.actions button').element);
			await vi.waitFor(() => expect(drawerSave()).not.toBeNull());
			await typeInDrawer('title', 'Second');
			await typeInDrawer('count', '1');
			await userEvent.click(drawerSave());
			await vi.waitFor(() => expect(document.querySelector('.bo-drawer')).toBeNull());

			// template {{ title }} ({{ count }}), rows by `sort: count`
			expect(mounted.findAll('button.row-open').map((b) => b.text().replace(/\s+/g, ' ').trim())).toEqual([
				'Second (1)',
				'First (3)',
			]);
		},
	},
};

/** The compared part of a value (spec Assumptions): no Editor.js `time` or block `id`, coordinates to 2 decimals. */
function stable(id: string, value: unknown): unknown {
	const json = JSON.parse(JSON.stringify(value ?? null));

	if (id === 'input-block-editor' && json) {
		delete json.time;
		for (const block of json.blocks) delete block.id;
	}

	if (id === 'map')
		return JSON.parse(JSON.stringify(json).replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 100) / 100)));

	return json;
}

test('every US5 interface (TinyMCE aside) has an expected file and every scenario a runner', () => {
	for (const id of IDS)
		expect(Object.keys(snapshot.expected[id] ?? {}).sort(), id).toEqual(Object.keys(RUNNERS[id]!).sort());
});

describe.each(IDS)('expected.%s.json', (id) => {
	const scenarios = Object.entries((snapshot.expected[id] ?? {}) as unknown as Record<string, Scenario>);

	// Without WebGL (a CI runner without GPU emulation) the map scenarios are skipped; InterfaceMap.test.ts covers the logic.
	test.skipIf(id === 'map' && !webgl).each(scenarios)('%s', async (name, scenario) => {
		expect(fields.find((f) => f.field === scenario.field)?.meta?.interface).toBe(id);

		const mounted = await mountInterface(id, scenario);
		await settle();

		await RUNNERS[id]![name]!(mounted);

		expect(mounted.emitted('input')).toBeDefined();
		expect(stable(id, lastInput(mounted))).toEqual(stable(id, scenario.value));
	});
});
