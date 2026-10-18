// T096 (SC-006, D-69): the keyboard path of every drag of contracts/layouts.md §5, driven on the Content pages over the
// fixture API with focus and keys only (no pointer): manual sort, column move and width, kanban card and column, the
// calendar event (opened to edit its date in the item form), the map selection list, the live preview handle and the
// filter rule menu. Then FR-115c (focus after save and create new, and after delete) and FR-115d (confirmation dialogs
// focus Cancel first, Esc cancels).
import { page, userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { h } from 'vue';
import { RouterView } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
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
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import { mountLayout } from '../../test-utils/layout.ts';
import { getInternalModules, registeredModules } from '../index.ts';
import CollectionRoute from './routes/CollectionRoute.vue';
import ItemRoute from './routes/ItemRoute.vue';

enableAutoUnmount(afterEach);

const webgl = document.createElement('canvas').getContext('webgl') !== null;
const snapshot = loadSnapshot();
let fetch: ReturnType<typeof mockFixtureApi>;

beforeAll(() => page.viewport(1280, 900));

beforeEach(async () => {
	vi.unstubAllGlobals();
	localStorage.clear();
	await replaceQueue();
});

afterEach(() => {
	// MapLibre fetches tiles with Request objects (outside the API).
	assertOnlyKnownRequests(apiCalls());
});

const t = (key: string, values?: Record<string, unknown>) => i18n.global.t(key, values ?? {});

/** Fixture API with the admin's own bo_content preset (layout, options, filter), stores hydrated as hydrate.ts. */
async function hydrate(preset: Record<string, unknown> = {}) {
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
	Object.assign(source.presets.find((p) => p['id'] === 1)!, { layout_query: null, ...preset });
	// An iframe on about:blank: no request leaves the test.
	source.collections.find((c) => c['collection'] === 'bo_content')!['meta'].preview_url = 'about:blank#{{ id }}';
	fetch = mockFixtureApi(source);
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

function mountPage(path: string, preset?: Record<string, unknown>) {
	return mountLayout({ render: () => h(RouterView) }, { path, routes, beforeMount: () => hydrate(preset) });
}

/** Waits until `get` returns an element (lazy components, API answers). */
const found = <T>(get: () => T | null | undefined, timeout = 10000) =>
	vi.waitFor(
		() => {
			const el = get();
			if (!el) throw new Error('not rendered yet');
			return el;
		},
		{ timeout },
	);

const active = () => document.activeElement as HTMLElement | null;

/** Focuses `trigger`, opens its menu with Enter, walks down with the arrows to `label` and presses Enter. */
async function pick(trigger: HTMLElement, label: string) {
	trigger.focus();
	await userEvent.keyboard('{Enter}');
	await found(() => document.querySelector('[role="menu"]'));
	await walkTo(label);
	await userEvent.keyboard('{Enter}');
	await flushPromises();
}

/** Arrow Down until the focused menu item shows `label` (disabled items are skipped by Reka). */
async function walkTo(label: string) {
	await vi.waitFor(() => expect(active()?.closest('[role="menu"]')).not.toBeNull());
	for (let i = 0; i < 20 && !active()?.textContent?.includes(label); i++) await userEvent.keyboard('{ArrowDown}');
	expect(active()?.textContent).toContain(label);
}

/** API calls (MapLibre tile Requests of the location field left out). */
const apiCalls = () =>
	calls({ mock: { calls: fetch.mock.calls.filter(([input]) => !(input instanceof Request)) } } as typeof fetch);

const sortCall = () => fetch.mock.calls.filter(([input]) => String(input).includes('/utils/sort/')).at(-1);

describe('drag and drop keyboard paths (contracts/layouts.md §5)', () => {
	test('manual sort: the row menu "Move down" sorts the item and announces its position', async () => {
		await mountPage('/content/bo_content');
		const menu = await found(() => document.querySelector<HTMLElement>('tbody tr .row-menu'));

		await pick(menu, t('move_down'));

		await vi.waitFor(() => expect(sortCall()).toBeDefined());
		expect(JSON.parse(String(sortCall()![1]!.body))).toEqual({ item: 1, to: 2 });
		await vi.waitFor(() =>
			expect(document.querySelector('[aria-live="polite"][aria-atomic="true"]')?.textContent).toContain(
				'moved to position 2',
			),
		);
	});

	test('columns: the header menu "Move right" and "Move left" reorder, the width input resizes', async () => {
		await mountPage('/content/bo_content');
		const headers = () =>
			[...document.querySelectorAll('thead th[scope="col"] [data-reorder-handle] button > span.truncate')].map((el) =>
				el.textContent?.trim(),
			);
		const trigger = (label: string) =>
			[...document.querySelectorAll<HTMLElement>('thead [data-reorder-handle] button')].find(
				(el) => el.querySelector('span.truncate')?.textContent?.trim() === label,
			)!;
		await vi.waitFor(() => expect(headers().length).toBeGreaterThan(2));
		const [first, second] = headers() as [string, string];

		await pick(trigger(first), t('move_right'));
		await vi.waitFor(() => expect(headers().slice(0, 2)).toEqual([second, first]));

		await pick(trigger(first), t('move_left'));
		await vi.waitFor(() => expect(headers().slice(0, 2)).toEqual([first, second]));

		// Width: the number input of the header menu, reached with Tab from the menu.
		const th = () => trigger(first).closest('th')!;
		const before = th().getBoundingClientRect().width;
		trigger(first).focus();
		await userEvent.keyboard('{Enter}');
		const width = await found(() => document.querySelector<HTMLInputElement>('[role="menu"] input[type="number"]'));
		// The menu moves the focus into itself once open; on a loaded runner that came after the focus below and the
		// typing went to the first item (CI 39103368273). Wait for it, then hold the input.
		await vi.waitFor(() => expect(document.activeElement?.closest('[role="menu"]')).not.toBeNull());
		width.focus();
		await vi.waitFor(() => expect(document.activeElement).toBe(width));
		// Select the old value directly: Control+A is "line start" on macOS, which typed "300144" there.
		width.select();
		await userEvent.keyboard('300{Enter}');
		expect(width.value).toBe('300');
		await userEvent.keyboard('{Escape}');
		// The new width goes through the preset and a re-render: slow on a loaded runner (1 s default failed on CI).
		await vi.waitFor(() => expect(th().getBoundingClientRect().width).toBeGreaterThan(before + 100), {
			timeout: 10_000,
		});
	});

	test('kanban: card menu "Move down" and "Move to group…" (submenu), column menu "Move right"', async () => {
		await mountPage('/content/bo_content', { layout: 'kanban', layout_options: { kanban: {} } });
		const columns = () => [...document.querySelectorAll('section h3')].map((el) => el.textContent?.trim());
		const cardsOf = (column: number) =>
			[...document.querySelectorAll('section')[column]!.querySelectorAll<HTMLElement>('[data-card]')].map(
				(el) => el.dataset['card'],
			);
		const card = (id: string) => document.querySelector<HTMLElement>(`[data-card="${id}"]`)!;
		await found(() => document.querySelector('[data-card="1"]'));
		expect(columns()).toEqual(['Draft', 'Published', 'Archived']);

		await pick(card('1').querySelector<HTMLElement>('.card-menu')!, t('move_down'));
		await vi.waitFor(() => expect(cardsOf(0).slice(0, 2)).toEqual(['4', '1']));

		const menu = card('1').querySelector<HTMLElement>('.card-menu')!;
		menu.focus();
		await userEvent.keyboard('{Enter}');
		await walkTo(t('move_to_group'));
		await userEvent.keyboard('{ArrowRight}');
		await vi.waitFor(() => expect(document.querySelectorAll('[role="menu"]')).toHaveLength(2));
		await walkTo('Published');
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(cardsOf(1)).toContain('1'));
		// The preset autosave PATCHes too: take the last item PATCH.
		const patch = fetch.mock.calls.findLast(
			([url, init]) => init?.method === 'PATCH' && String(url).includes('/items/bo_content/'),
		);
		expect(String(patch![0])).toContain('/items/bo_content/1');
		expect(patch![1]!.body).toBe(JSON.stringify({ status: 'published' }));
		// Focus follows the moved card.
		await vi.waitFor(() => expect(active()).toBe(card('1')));

		await pick(document.querySelectorAll<HTMLElement>('.group-menu')[0]!, t('move_right'));
		await vi.waitFor(() => expect(columns()).toEqual(['Published', 'Draft', 'Archived']));
	});

	test('calendar: an event opens its item with Enter, where the date is edited in the form', async () => {
		const { router } = await mountPage('/content/bo_content', {
			layout: 'calendar',
			layout_options: {
				calendar: {
					startDateField: 'date_published',
					viewInfo: { type: 'dayGridMonth', startDateStr: '2026-10-01T00:00:00' },
				},
			},
		});
		// FullCalendar makes the events tabbable (eventClick is set) and runs eventClick on Enter.
		const event = await found(() => document.querySelector<HTMLElement>('.fc-event[tabindex="0"]'));

		event.focus();
		await userEvent.keyboard('{Enter}');

		await vi.waitFor(() => expect(router.currentRoute.value.path).toMatch(/^\/content\/bo_content\/\d+$/));
		await found(() => document.querySelector('[data-field="date_published"]'));
	});

	test.skipIf(!webgl)('map: the items-in-view list opens an item with the keyboard (WebGL)', async () => {
		const { router } = await mountPage('/content/bo_content', {
			layout: 'map',
			layout_options: { map: { geometryField: 'location' } },
		});
		const trigger = await found(() => document.querySelector<HTMLElement>('[data-action="items-in-view"]'));

		trigger.focus();
		await userEvent.keyboard('{Enter}');
		const item = await found(() => document.querySelector<HTMLElement>('[data-item="2"]'));
		item.focus();
		await userEvent.keyboard('{Enter}');

		await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/content/bo_content/2'));
	});

	test('live preview handle: Left/Right ±5 %, Home/End', async () => {
		await mountPage('/content/bo_content/1');
		const toggle = await found(() =>
			document.querySelector<HTMLElement>(`button[aria-label="${t('live_preview.enable')}"]`),
		);
		toggle.focus();
		await userEvent.keyboard('{Enter}');
		const handle = await found(() => document.querySelector<HTMLElement>('[role="separator"]'));
		const size = () => Number(localStorage.getItem('backoffice-live-preview-size'));
		const start = size() || 50;

		handle.focus();
		await userEvent.keyboard('{ArrowLeft}');
		await vi.waitFor(() => expect(Math.round(size())).toBe(start + 5));
		await userEvent.keyboard('{ArrowRight}{ArrowRight}');
		await vi.waitFor(() => expect(Math.round(size())).toBe(start - 5));
		await userEvent.keyboard('{Home}');
		await vi.waitFor(() => expect(Math.round(size())).toBe(20));
		await userEvent.keyboard('{End}');
		await vi.waitFor(() => expect(Math.round(size())).toBe(80));
		// Stored modes are shared with the other test files of the browser run (same origin).
		localStorage.removeItem('backoffice-live-preview-mode');
	});

	test('filter: the rule menu "Move down" and "Move up" reorder the conditions', async () => {
		await mountPage('/content/bo_content', {
			filter: { _and: [{ title: { _contains: 'Content' } }, { status: { _eq: 'draft' } }] },
		});
		const filterButton = await found(() => document.querySelector<HTMLElement>(`button[aria-label="${t('filter')}"]`));
		filterButton.focus();
		await userEvent.keyboard('{Enter}');
		const rules = () =>
			[...document.querySelectorAll<HTMLElement>('.rule-header .row-menu')].map((el) => el.getAttribute('aria-label'));
		await vi.waitFor(() => expect(rules()).toHaveLength(2));
		const [title, status] = rules() as [string, string];

		await pick(document.querySelector<HTMLElement>(`[aria-label="${title}"]`)!, t('move_down'));
		await vi.waitFor(() => expect(rules()).toEqual([status, title]));
		await vi.waitFor(() => expect(active()?.getAttribute('aria-label')).toBe(title));

		await pick(document.querySelector<HTMLElement>(`[aria-label="${title}"]`)!, t('move_up'));
		await vi.waitFor(() => expect(rules()).toEqual([title, status]));
	});
});

describe('focus after actions (FR-115c) and confirmation dialogs (FR-115d)', () => {
	const button = (label: string) => document.querySelector<HTMLElement>(`button[aria-label="${label}"]`);
	const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

	test('save and create new: the new blank form has focus on its first field', async () => {
		const { router } = await mountPage('/content/bo_content/2');
		const input = await found(() => document.querySelector<HTMLInputElement>('[data-field="title"] input'));
		await vi.waitFor(() => expect(input.value).toBe('Content 02'));
		input.focus();
		await userEvent.keyboard('{Control>}a{/Control}Changed');

		await pick(await found(() => button(t('more_save_options'))), t('save_and_create_new'));

		await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/content/bo_content/+'));
		await vi.waitFor(() => expect(active()?.closest('[data-field]')).not.toBeNull());
		const first = document.querySelector('[data-field] input, [data-field] textarea, [data-field] button');
		expect(active()).toBe(first);
	});

	test('delete: the dialog focuses Cancel, Esc cancels; confirming focuses the collection page title', async () => {
		const { router } = await mountPage('/content/bo_content/2');
		const remove = await found(() => button(t('delete_label')));
		await vi.waitFor(() => expect((remove as HTMLButtonElement).disabled).toBe(false));

		remove.focus();
		await userEvent.keyboard('{Enter}');
		await found(dialog);
		await vi.waitFor(() => expect(active()?.textContent?.trim()).toBe(t('cancel')));
		await userEvent.keyboard('{Escape}');
		await vi.waitFor(() => expect(dialog()).toBeNull());
		await vi.waitFor(() => expect(active()).toBe(remove));

		await userEvent.keyboard('{Enter}');
		await found(dialog);
		await vi.waitFor(() => expect(active()?.textContent?.trim()).toBe(t('cancel')));
		await userEvent.keyboard('{Tab}');
		expect(active()?.textContent?.trim()).toBe(t('delete_label'));
		await userEvent.keyboard('{Enter}');

		await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/content/bo_content'));
		expect(apiCalls()).toContain('DELETE /items/bo_content/2');
		await vi.waitFor(() => expect(active()?.tagName).toBe('H1'));
		expect(active()?.textContent?.trim()).toBe('Bo Content');
	});

	test('archive on the item page focuses Cancel first, Esc cancels', async () => {
		await mountPage('/content/bo_content/2');
		const archive = await found(() => button(t('archive')));
		await vi.waitFor(() => expect((archive as HTMLButtonElement).disabled).toBe(false));
		archive.focus();
		await userEvent.keyboard('{Enter}');
		await found(dialog);
		await vi.waitFor(() => expect(active()?.textContent?.trim()).toBe(t('cancel')));
		await userEvent.keyboard('{Escape}');
		await vi.waitFor(() => expect(dialog()).toBeNull());
	});

	test('leaving with unsaved edits: the dialog focuses its first button that does not discard', async () => {
		const { router } = await mountPage('/content/bo_content/2');
		const input = await found(() => document.querySelector<HTMLInputElement>('[data-field="title"] input'));
		await vi.waitFor(() => expect(input.value).toBe('Content 02'));
		input.focus();
		await userEvent.keyboard('{End}x');
		void router.push('/content/bo_content');

		await found(dialog);
		await vi.waitFor(() => expect(active()?.closest('[role="dialog"]')).not.toBeNull());
		expect(active()?.textContent?.trim()).toBe(t('keep_editing'));
		await userEvent.keyboard('{Escape}');
		await vi.waitFor(() => expect(dialog()).toBeNull());
		expect(router.currentRoute.value.path).toBe('/content/bo_content/2');
	});

	test('batch delete on the collection page focuses Cancel first', async () => {
		await mountPage('/content/bo_content');
		const checkbox = await found(() => document.querySelector<HTMLElement>('tbody tr [role="checkbox"]'));
		checkbox.focus();
		await userEvent.keyboard(' ');
		const remove = await found(() => button(t('delete_label')));

		remove.focus();
		await userEvent.keyboard('{Enter}');
		await found(dialog);
		await vi.waitFor(() => expect(active()?.textContent?.trim()).toBe(t('cancel')));
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(dialog()).toBeNull());
		expect(apiCalls().some((call) => call.startsWith('DELETE'))).toBe(false);
	});
});
