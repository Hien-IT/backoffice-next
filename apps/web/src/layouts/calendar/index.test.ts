// DR has no test for layouts/calendar/index.ts: the layout state (T058) over the fixture API, collection
// bo_content (30 items, `date_published` dateTime from 2026-10-01T09:00:00 to 2026-10-30T09:00:00) plus a `date` field
// `date_end` added here; FullCalendar is a fake that records the options (the browser test runs the real one).
import type { Snapshot } from '../../test-utils/fixtures.ts';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { formatISO } from 'date-fns';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useServerStore } from '../../stores/server.ts';
import { useUserStore } from '../../stores/user.ts';
import { calls, json, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import { saveAsCSV } from '../../utils/save-as-csv.ts';
import { createLayoutWrapper } from '../use-layout.ts';
import calendar from './index.ts';

const fc = vi.hoisted(() => ({ options: null as any, instance: null as any }));

vi.mock('@fullcalendar/core', () => ({
	Calendar: class {
		view = {
			type: 'dayGridMonth',
			activeStart: new Date(2026, 8, 27),
			activeEnd: new Date(2026, 10, 8),
			currentStart: new Date(2026, 9, 1),
		};
		handlers: Record<string, (args: any) => void> = {};
		render = vi.fn();
		pauseRendering = vi.fn();
		resumeRendering = vi.fn();
		setOption = vi.fn();
		destroy = vi.fn();
		updateSize = vi.fn();
		constructor(_element: HTMLElement, options: any) {
			fc.options = options;
			fc.instance = this;
		}
		resetOptions(options: any) {
			fc.options = options;
		}
		on(name: string, handler: (args: any) => void) {
			this.handlers[name] = handler;
		}
	},
}));
vi.mock('@fullcalendar/daygrid', () => ({ default: { name: 'daygrid' } }));
vi.mock('@fullcalendar/timegrid', () => ({ default: { name: 'timegrid' } }));
vi.mock('@fullcalendar/list', () => ({ default: { name: 'list' } }));
vi.mock('@fullcalendar/interaction', () => ({ default: { name: 'interaction' } }));
vi.mock('../../utils/save-as-csv.ts', () => ({ saveAsCSV: vi.fn() }));

const START = formatISO(new Date(2026, 8, 27));
const END = formatISO(new Date(2026, 10, 8));

enableAutoUnmount(afterEach);

let fetch: ReturnType<typeof mockFixtureApi>;
let host: HTMLElement;

/** bo_content with a `date` field `date_end` = 2 days after `date_published`. */
function snapshotWithDateEnd(): Snapshot {
	const snapshot = loadSnapshot();
	const published = snapshot.fields.find((f) => f.collection === 'bo_content' && f.field === 'date_published')!;
	snapshot.fields.push({
		...published,
		field: 'date_end',
		type: 'date',
		schema: { ...published.schema!, name: 'date_end', data_type: 'date' },
		meta: { ...published.meta!, field: 'date_end', sort: 50 },
	});

	for (const row of snapshot.items['bo_content']!) {
		const day = Number(String(row['date_published']).slice(8, 10)) + 2;
		row['date_end'] = `2026-10-${String(day).padStart(2, '0')}`;
	}

	return snapshot;
}

/**
 * The fixture API, with `_between` (not in the fixture filters) read as `_gte` + `_lte` for the item lists; `answers`
 * win over both.
 */
function mockCalendarApi(answers: Record<string, any> = {}) {
	const snapshot = snapshotWithDateEnd();
	const inner = mockFixtureApi(snapshot);

	return mockFixtureApi(snapshot, {
		answers: {
			'GET /items/bo_content': ({ url, init }: { url: URL; init: RequestInit }) => {
				const filter = url.searchParams.get('filter');

				if (filter) {
					const rewritten = JSON.parse(filter, (_key, value) =>
						value?._between ? { _gte: value._between[0], _lte: value._between[1] } : value,
					);
					url.searchParams.set('filter', JSON.stringify(rewritten));
				}

				return inner(url, init);
			},
			...answers,
		},
	});
}

async function setup(answers: Record<string, any> = {}, queryLimit?: { default: number; max: number }) {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockCalendarApi(answers);
	await useUserStore().hydrate();
	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);
	useServerStore().info.queryLimit = queryLimit;
}

beforeEach(async () => {
	fc.options = null;
	fc.instance = null;
	host = document.createElement('div');
	document.body.append(host);
	await setup();
});

afterEach(() => host.remove());

/** Mounts the calendar wrapper with its v-models in refs; `create` runs `createCalendar` as Calendar.vue does. */
async function mountCalendar(
	initial: { layoutOptions?: any; filterUser?: any; selectMode?: boolean; create?: boolean } = {},
) {
	const layoutOptions = ref(initial.layoutOptions ?? null);
	const selection = ref<(string | number)[]>([]);
	let state: Record<string, any> = {};
	const Wrapper = createLayoutWrapper(calendar);

	const Harness = defineComponent(
		() => () =>
			h(
				Wrapper,
				{
					collection: 'bo_content',
					layoutOptions: layoutOptions.value,
					selection: selection.value,
					selectMode: initial.selectMode ?? false,
					filterUser: initial.filterUser ?? null,
					filter: initial.filterUser ?? null,
					'onUpdate:layoutOptions': (value: any) => (layoutOptions.value = value),
					'onUpdate:selection': (value: any) => (selection.value = value),
				},
				{ default: (scope: { layoutState: Record<string, any> }) => ((state = scope.layoutState), h('div')) },
			),
	);

	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });
	await router.push('/content/bo_content');
	mount(Harness, { global: { plugins: [router, i18n] } });
	await vi.waitFor(() => expect(state['loading']).toBe(false));

	if (initial.create !== false) {
		await state['createCalendar'](host);
		// The view range filter comes with the calendar; useItems throttles the refetch (500 ms).
		if (initial.layoutOptions?.startDateField) await listWith('_between');
		await flushPromises();
		await vi.waitFor(() => expect(state['loading']).toBe(false));
	}

	await flushPromises();

	return { layoutOptions, selection, router, state: () => state };
}

const itemLists = () =>
	calls(fetch).filter((call) => call.startsWith('GET /items/bo_content?') && call.includes('limit='));

/**
 * The item list request containing `fragment` (waits for it): a throttled refetch of a layout of an earlier test may
 * land in this test's fetch mock, so the last call is not always ours.
 */
async function listWith(fragment: string): Promise<string> {
	return vi.waitFor(() => {
		const list = itemLists().findLast((call) => call.includes(fragment));
		expect(list).toBeDefined();
		return list!;
	});
}

const patches = () =>
	fetch.mock.calls
		.filter(([, init]) => init?.method === 'PATCH')
		.map(([input, init]) => [new URL(String(input)).pathname, JSON.parse(String(init!.body))]);

/** The `info` FullCalendar gives `eventChange`. */
function change(event: { id: string; startStr: string; endStr?: string; allDay?: boolean; end?: Date | null }) {
	const revert = vi.fn();
	return { info: { event: { endStr: '', allDay: false, end: null, ...event }, revert }, revert };
}

test('registers as Directus: id, name, icon and slots, all lazy', () => {
	expect(calendar.id).toBe('calendar');
	expect(calendar.name).toBe('$t:layouts.calendar.calendar');
	expect(calendar.icon).toBe('event');
	expect(Object.keys(calendar.slots)).toEqual(['options', 'sidebar', 'actions']);
	expect((calendar.component as any).__asyncLoader).toBeTypeOf('function');
	expect((calendar.slots.options as any).__asyncLoader).toBeTypeOf('function');
	expect((calendar.slots.actions as any).__asyncLoader).toBeTypeOf('function');
});

test('without a start date field: no date filter, page 1 sorted by primary key, limit 1000, the total count', async () => {
	const { state } = await mountCalendar();

	const list = itemLists().at(-1)!;
	expect(list).toContain('limit=1000');
	expect(list).toContain('sort=id');
	expect(list).toContain('page=1');
	expect(list).not.toContain('filter=');
	expect(state()['limit']).toBe(1000);
	expect(state()['dateFields'].map((field: any) => field.field)).toEqual(['date_published', 'date_end']);
	expect(state()['showingCount']).toBe(i18n.global.t('item_count', { count: 30 }, 30));
	expect(fc.options.events).toEqual([]);
	expect(fc.options.plugins.map((plugin: any) => plugin.name)).toEqual(['daygrid', 'timegrid', 'list', 'interaction']);
});

test('limit is queryLimit.max of the server, 1000 when it is -1', async () => {
	await setup({}, { default: 100, max: 100 });
	expect((await mountCalendar({ create: false })).state()['limit']).toBe(100);

	await setup({}, { default: 100, max: -1 });
	expect((await mountCalendar({ create: false })).state()['limit']).toBe(1000);
});

test('start field: the request keeps the items starting in the view; dateTime events with the time grid views', async () => {
	const { state } = await mountCalendar({
		layoutOptions: { startDateField: 'date_published', template: '{{ title }}' },
	});

	const list = await listWith(`filter=${JSON.stringify({ date_published: { _between: [START, END] } })}`);
	expect(list).toContain('fields=id,title,date_published,');

	expect(fc.options.events).toHaveLength(30);
	expect(fc.options.events[0]).toEqual({
		id: 1,
		title: 'Content 01 (edited)',
		start: '2026-10-01T09:00:00',
		end: undefined,
		allDay: undefined,
		className: undefined,
	});
	expect(fc.options.headerToolbar.right).toBe('dayGridMonth,timeGridWeek,timeGridDay,listWeek');
	expect(fc.options.views.dayGridMonth.displayEventTime).toBe(true);
	expect(fc.options.firstDay).toBe(0);
	expect(fc.options.editable).toBe(true);
	expect(fc.options.dragRevertDuration).toBe(500);
	expect(state()['showingCount']).toBe(i18n.global.t('item_count', { count: 30 }, 30));
});

test('start and end fields: starts, ends or spans the view; date end = all day, shown one day later', async () => {
	await mountCalendar({ layoutOptions: { startDateField: 'date_published', endDateField: 'date_end' } });

	const filter = {
		_or: [
			{ date_published: { _between: [START, END] } },
			{ date_end: { _between: [START, END] } },
			{ _and: [{ date_published: { _lte: START } }, { date_end: { _gte: END } }] },
		],
	};
	expect(await listWith(`filter=${JSON.stringify(filter)}`)).toContain('fields=id,date_published,date_end,');

	expect(fc.options.events[0]).toMatchObject({
		id: 1,
		title: '1',
		start: '2026-10-01T09:00:00',
		end: '2026-10-04',
		allDay: true,
	});
});

test('a date start field has no event time and the day grid views; firstDay from the options', async () => {
	await mountCalendar({ layoutOptions: { startDateField: 'date_end', firstDay: 1 } });

	expect(fc.options.headerToolbar.right).toBe('dayGridMonth,dayGridWeek,dayGridDay,listWeek');
	expect(fc.options.views.dayGridMonth.displayEventTime).toBe(false);
	expect(fc.options.views.week.displayEventTime).toBe(false);
	expect(fc.options.firstDay).toBe(1);
});

test('viewInfo: the initial view and date come from the options, datesSet writes them back', async () => {
	const { layoutOptions } = await mountCalendar({
		layoutOptions: { viewInfo: { type: 'listWeek', startDateStr: '2026-10-05T00:00:00+00:00' } },
	});

	expect(fc.options.initialView).toBe('listWeek');
	expect(fc.options.initialDate).toBe('2026-10-05T00:00:00+00:00');

	fc.instance.handlers.datesSet({ view: { type: 'timeGridWeek', currentStart: new Date(2026, 9, 11) } });
	expect(layoutOptions.value).toEqual({
		viewInfo: { type: 'timeGridWeek', startDateStr: formatISO(new Date(2026, 9, 11)) },
	});
});

test('eventChange: dateTime cut to 19 characters, PATCH of the item', async () => {
	await mountCalendar({ layoutOptions: { startDateField: 'date_published' } });

	const { info, revert } = change({ id: '3', startStr: '2026-10-05T10:30:00+07:00' });
	await fc.options.eventChange(info);

	expect(patches()).toEqual([['/items/bo_content/3', { date_published: '2026-10-05T10:30:00' }]]);
	expect(revert).not.toHaveBeenCalled();
});

test('eventChange of an all day event: the date end field gets the exclusive end minus one day', async () => {
	await mountCalendar({ layoutOptions: { startDateField: 'date_published', endDateField: 'date_end' } });

	const { info } = change({
		id: '4',
		startStr: '2026-10-06',
		endStr: '2026-10-09',
		end: new Date(2026, 9, 9),
		allDay: true,
	});
	await fc.options.eventChange(info);

	expect(patches()).toEqual([['/items/bo_content/4', { date_published: '2026-10-06', date_end: '2026-10-08' }]]);
});

test('eventChange: an API error reverts the event', async () => {
	await setup({
		'PATCH /items/bo_content/3': () =>
			json({ errors: [{ message: 'Forbidden', extensions: { code: 'FORBIDDEN' } }] }, 403),
	});
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	await mountCalendar({ layoutOptions: { startDateField: 'date_published' } });

	const { info, revert } = change({ id: '3', startStr: '2026-10-05T10:30:00' });
	await fc.options.eventChange(info);

	expect(revert).toHaveBeenCalledOnce();
	expect(warn).toHaveBeenCalled();
	warn.mockRestore();
});

test('eventClick opens the item, or toggles it in the selection in select mode (selected class)', async () => {
	const { router } = await mountCalendar({ layoutOptions: { startDateField: 'date_published' } });

	fc.options.eventClick({ event: { id: '2' }, jsEvent: new MouseEvent('click') });
	await flushPromises();
	expect(router.currentRoute.value.fullPath).toBe('/content/bo_content/2');

	const { selection } = await mountCalendar({ layoutOptions: { startDateField: 'date_published' }, selectMode: true });
	fc.options.eventClick({ event: { id: '2' }, jsEvent: new MouseEvent('click') });
	await flushPromises();
	expect(selection.value).toEqual([2]);
	expect(fc.options.events[1].className).toBe('selected');
});

test('a user filter merges with the view range; the count is relative; download, resize and destroy', async () => {
	const filterUser = { status: { _eq: 'published' } };
	const { state } = await mountCalendar({ layoutOptions: { startDateField: 'date_published' }, filterUser });

	await listWith(`filter=${JSON.stringify({ _and: [filterUser, { date_published: { _between: [START, END] } }] })}`);
	const count = state()['itemCount'];
	expect(count).toBeGreaterThan(0);
	expect(count).toBeLessThan(30);
	expect(state()['isFiltered']).toBe(true);
	expect(state()['showingCount']).toBe(i18n.global.t('filtered_item_count', { count, total: 30 }, count));

	state()['download']();
	// DR queryFields: the fields, then adjustFieldsForDisplays of them (the same plain fields again).
	expect(saveAsCSV).toHaveBeenCalledWith(
		'bo_content',
		['id', 'date_published', 'id', 'date_published'],
		state()['items'],
	);

	state()['resize']();
	expect(fc.instance.updateSize).toHaveBeenCalled();
	state()['destroyCalendar']();
	expect(fc.instance.destroy).toHaveBeenCalled();
});

test('createCalendar does nothing once the element left the page', async () => {
	const { state } = await mountCalendar({ create: false });
	host.remove();

	await state()['createCalendar'](host);
	expect(fc.instance).toBeNull();
});
