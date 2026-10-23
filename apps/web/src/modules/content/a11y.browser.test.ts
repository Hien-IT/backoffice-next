// T095 (FR-123, SC-006): axe on the Content module screens over the fixture API, light and `html.dark`: the collection
// page in the five layouts (map only with WebGL, like layouts/map/MapLayout.browser.test.ts), the item page with each
// detail section open (revisions, comments, shares, flows), the comparison modal, the export dialog, the import error
// dialog, the version menu and the collection tree. 0 serious or critical violations outside EXCEPTIONS.
import { page, userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { createPinia, setActivePinia } from 'pinia';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { h } from 'vue';
import { RouterView } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import ImportErrorDialog from '../../components/sidebar/ImportErrorDialog.vue';
import { i18n } from '../../lang/index.ts';
import { getInternalModules, registeredModules } from '../index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useFlowsStore } from '../../stores/flows.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { usePresetsStore } from '../../stores/presets.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useSettingsStore } from '../../stores/settings.ts';
import { useUserStore } from '../../stores/user.ts';
import '../../styles/index.css';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot, type Row } from '../../test-utils/fixtures.ts';
import { mountLayout } from '../../test-utils/layout.ts';
import CollectionRoute from './routes/CollectionRoute.vue';
import ItemRoute from './routes/ItemRoute.vue';

enableAutoUnmount(afterEach);

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Accepted exceptions (FR-123: third-party library DOM and data colors only), as in components/form/a11y.browser.test.ts.
 * - `link-in-text-block` in `.maplibregl-ctrl-attrib`: MapLibre's attribution control (its own DOM and CSS, links
 *   without underline), kept as the library ships it (map layout, `location` map field of the item form).
 * - `color-contrast` when the element or an ancestor inside the field, cell or card gets its color from an inline
 *   style: data colors from the field options, the item or the flow (`color` of the manual flow icon in the flows
 *   section), applied as is like DR.
 * FullCalendar needs none (calendar.css maps its variables to the theme tokens).
 */
const EXCEPTIONS: { rule: string; reason: string; applies: (el: Element) => boolean }[] = [
	{
		rule: 'link-in-text-block',
		reason: 'MapLibre attribution control (third-party DOM)',
		applies: (el) => el.closest('.maplibregl-ctrl-attrib') !== null,
	},
	{
		rule: 'color-contrast',
		reason: 'data color applied with an inline style',
		applies: (el) => {
			for (
				let node: Element | null = el;
				node && !node.matches('[data-field], td, [data-card], body');
				node = node.parentElement
			) {
				if (/(^|;)\s*(color|background(-color)?|border-color)\s*:/.test(node.getAttribute('style') ?? '')) return true;
			}

			return false;
		},
	},
];

const webgl = document.createElement('canvas').getContext('webgl') !== null;
const snapshot = loadSnapshot();
let fetch: ReturnType<typeof mockFixtureApi>;
let noTransitions: HTMLStyleElement;

// The detail panel is a popover of the page header toggle (D-128): openSection opens it first.
beforeAll(async () => {
	await page.viewport(1280, 900);
	noTransitions = document.head.appendChild(document.createElement('style'));
	// BoButton colors and the panels have transitions: axe must read the final colors.
	noTransitions.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
});

afterAll(() => noTransitions.remove());

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
});

afterEach(() => {
	document.documentElement.classList.remove('dark');
	// MapLibre fetches tiles with Request objects (outside the API).
	const api = fetch.mock.calls.filter(([input]) => !(input instanceof Request));
	assertOnlyKnownRequests(calls({ mock: { calls: api } } as typeof fetch));
});

const admin = { id: 'bo-1', email: 'admin@example.com', first_name: 'Admin', last_name: 'User' };

// The fixture revisions of bo_content/1 with a date and a user, as DR lists them.
const revisions = snapshot.revisions['bo_content']!.map(
	(r, index): Row => ({
		...r,
		activity: { ...r['activity'], timestamp: new Date(2026, 9, 1 + index, 9).toISOString(), user: admin },
	}),
);

/**
 * `GET /revisions` of use-revisions (list, count and the `activity.action` "created" query): the fixture API has no
 * relation for `directus_revisions.activity`, so its filter is read here (version and action).
 */
function revisionsAnswer({ url }: { url: URL }) {
	const filter = url.searchParams.get('filter') ?? '';
	const version = /"version":\{"_eq":"([^"]+)"/.exec(filter)?.[1] ?? null;
	const action = /"action":\{"_eq":"([^"]+)"/.exec(filter)?.[1];
	const rows = revisions
		.filter((r) => r['version'] === version && (!action || r['activity']['action'] === action))
		.sort((a, b) => b['id'] - a['id']);
	const data = url.search.includes('aggregate') ? [{ count: { id: rows.length } }] : rows;
	return new Response(JSON.stringify({ data }), { headers: { 'Content-Type': 'application/json' } });
}

/** Fixture API with the admin's own bo_content preset on `layout` (and its options), stores hydrated. */
async function hydrate(layout = 'tabular', layoutOptions: Record<string, unknown> = {}) {
	// Stores taken before any await: a late component of the previous test can make its own pinia the active one.
	const [user, permissions, fields, relations, collections, presets, settings, flows] = [
		useUserStore(),
		usePermissionsStore(),
		useFieldsStore(),
		useRelationsStore(),
		useCollectionsStore(),
		usePresetsStore(),
		useSettingsStore(),
		useFlowsStore(),
	];
	const source = structuredClone(snapshot);
	const preset = source.presets.find((p) => p['id'] === 1)!;
	preset['layout'] = layout;
	preset['layout_options'] = { [layout]: layoutOptions };
	preset['layout_query'] = null;
	// The live preview iframe (if a mode is stored) on about:blank: no request leaves the test.
	source.collections.find((c) => c['collection'] === 'bo_content')!['meta'].preview_url = 'about:blank#{{ id }}';
	// The API sets date_created; the fixture rows have none.
	for (const [index, comment] of source.comments.entries())
		comment['date_created'] = new Date(2026, 9, 1 + index).toISOString();
	fetch = mockFixtureApi(source, { answers: { 'GET /revisions': revisionsAnswer } });
	await user.hydrate();
	// The module list of the sidebar (hydrate.ts onHydrateModules): the collection tree is the Content sub-menu.
	registeredModules.value = getInternalModules();
	// Permissions first, as hydrate.ts: the flows store reads them.
	await Promise.all([permissions.hydrate(), fields.hydrate()]);
	await Promise.all([
		relations.hydrate(),
		collections.hydrate(),
		presets.hydrate(),
		settings.hydrate(),
		flows.hydrate(),
	]);
}

const routes = [
	{ path: '/content/:collection', component: CollectionRoute, props: true },
	{ path: '/content/:collection/:primaryKey', component: ItemRoute, props: true },
	{ path: '/:p(.*)*', component: { render: () => null } },
];

async function mountPage(path: string, layout?: string, layoutOptions?: Record<string, unknown>) {
	return mountLayout(
		{ render: () => h(RouterView) },
		{ path, routes, beforeMount: () => hydrate(layout, layoutOptions) },
	);
}

/** Serious and critical violations outside EXCEPTIONS, as "rule: selector html". */
async function violations(): Promise<string[]> {
	const results = await axe.run(document.body, { runOnly: { type: 'tag', values: TAGS } });

	return results.violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.flatMap((v) =>
			v.nodes
				.filter((n) => {
					const el = document.querySelector(String(n.target[0]));
					return !EXCEPTIONS.some((e) => e.rule === v.id && el && e.applies(el));
				})
				.map((n) => `${v.id}: ${n.target.join(' ')} ${n.html.slice(0, 200)}`),
		);
}

/** Scans in light, then in dark. */
async function bothSchemes() {
	expect(await violations(), 'light').toEqual([]);
	document.documentElement.classList.add('dark');
	expect(await violations(), 'dark').toEqual([]);
	document.documentElement.classList.remove('dark');
}

async function settle() {
	await flushPromises();
	await new Promise((resolve) => setTimeout(resolve, 300));
	await flushPromises();
}

const t = (key: string, values?: Record<string, unknown>) => i18n.global.t(key, values ?? {});

const byText = (selector: string, text: string) =>
	[...document.querySelectorAll<HTMLElement>(selector)].find((el) => el.textContent?.trim().includes(text));

/** Waits until `get` returns an element (lazy components, API answers). */
const found = <T>(get: () => T | null | undefined, timeout = 10000) =>
	vi.waitFor(
		() => {
			const el = get();
			if (!el)
				throw new Error(
					'not rendered yet ' +
						JSON.stringify({
							ls: { ...localStorage },
							h1: document.querySelector('h1')?.textContent,
							calls: fetch.mock.calls
								.map(
									([i, init]) => (init?.method ?? 'GET') + ' ' + String(i instanceof Request ? i.url : i).slice(16, 90),
								)
								.slice(0, 40),
							cols: useCollectionsStore().collections.length,
							w: innerWidth,
							h3: [...document.querySelectorAll('h3')].map((e) => e.textContent),
							dlg: [...document.querySelectorAll('[role=dialog]')].map((e) => e.textContent?.slice(0, 200)),
						}),
				);
			return el;
		},
		{ timeout },
	);

/** Opens the detail panel popover (closed on load, D-128), then a section by its header button; returns its region. */
async function openSection(title: string) {
	const toggle = document.querySelector<HTMLButtonElement>('button[aria-label="Open sidebar"]');
	if (toggle) await userEvent.click(toggle);
	const header = await found(() => byText('h3 > button', title));
	await userEvent.click(header);
	await vi.waitFor(() => expect(header.getAttribute('aria-expanded')).toBe('true'));
	return document.getElementById(header.getAttribute('aria-controls')!)!;
}

describe('collection page', () => {
	const cases: [string, Record<string, unknown>, string][] = [
		['tabular', {}, 'tbody tr'],
		['cards', {}, 'main a[href="/content/bo_content/1"]'],
		[
			'calendar',
			{ startDateField: 'date_published', viewInfo: { type: 'dayGridMonth', startDateStr: '2026-10-01T00:00:00' } },
			'.fc-daygrid-event',
		],
		['kanban', {}, '[data-card]'],
	];

	test.each(cases)('%s layout, with the collection tree', async (layout, options, ready) => {
		await mountPage('/content/bo_content', layout, options);
		await vi.waitFor(() => expect(document.querySelector(ready)).not.toBeNull(), { timeout: 10000 });
		// The collection tree in the sidebar sub-menu.
		await vi.waitFor(() => expect(document.querySelector('[role="tree"] [role="treeitem"]')).not.toBeNull());
		await settle();

		await bothSchemes();
	});

	test.skipIf(!webgl)('map layout (WebGL)', async () => {
		await mountPage('/content/bo_content', 'map', { geometryField: 'location' });
		await vi.waitFor(() => expect(document.querySelector('.maplibregl-canvas')).not.toBeNull(), { timeout: 15000 });
		await settle();

		await bothSchemes();
	});

	test('export dialog', async () => {
		await mountPage('/content/bo_content');
		await vi.waitFor(() => expect(document.querySelector('tbody tr')).not.toBeNull(), { timeout: 10000 });
		await openSection(t('import_export'));
		await userEvent.click(await found(() => byText('button', t('export_items'))));
		await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
		await settle();

		await bothSchemes();
	}, 30_000);
});

describe('item page', () => {
	// Each section with a text its loaded content shows (fixture rows of bo_content/1).
	test.each([
		['revisions', 'Admin User'],
		['comments', 'First comment'],
		['shares', 'bo-share'],
		['flows', 'bo-flow-item'],
	])('with the %s section open', async (section, text) => {
		await mountPage('/content/bo_content/1');
		const region = await openSection(t(section));
		await vi.waitFor(() => expect(region.textContent).toContain(text), { timeout: 5000 });
		await settle();

		await bothSchemes();
	});

	test('comparison modal (revision)', async () => {
		await mountPage('/content/bo_content/1');
		const region = await openSection(t('revisions'));
		const revision = await found(() => region.querySelector<HTMLElement>('button'));
		await userEvent.click(revision);
		await vi.waitFor(() => expect(document.querySelector('[data-comparison-side="incoming"]')).not.toBeNull(), {
			timeout: 10000,
		});
		await settle();

		await bothSchemes();
	});

	test('version menu', async () => {
		await mountPage('/content/bo_content/1');
		const trigger = await found(() => document.querySelector<HTMLElement>(`[aria-label^="${t('version')}: "]`));
		await userEvent.click(trigger);
		await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull());
		await settle();

		await bothSchemes();
	});
});

test('import error dialog', async () => {
	setActivePinia(createPinia());
	await hydrate();
	mount(ImportErrorDialog, {
		props: {
			modelValue: true,
			collection: 'bo_content',
			errors: [
				{
					extensions: {
						code: 'FAILED_VALIDATION',
						field: 'title',
						type: 'nnull',
						rows: [
							{ type: 'lines', rows: [2, 3] },
							{ type: 'range', start: 7, end: 9 },
						],
					},
				},
				{ extensions: { code: 'RECORD_NOT_UNIQUE', field: 'status', rows: [{ type: 'lines', rows: [4] }] } },
			] as never,
		},
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
	await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
	await settle();

	await bothSchemes();
});
