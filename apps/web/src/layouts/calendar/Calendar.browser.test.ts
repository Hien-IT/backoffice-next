// T058 in a real browser: the calendar layout with FullCalendar 6.1.19 over the fixture API (bo_content, one item a day
// from 2026-10-01 09:00 to 2026-10-30 09:00), rendered as the collection screen does (`<component :is="layout.component"
// v-bind="layoutState">`, the actions slot likewise); the theme variables of calendar.css in light and dark (FR-110c).
import type { Filter } from '@directus/types';
import { userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { Calendar as FullCalendar } from '@fullcalendar/core';
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
import '../../styles/index.css';
import { calls, json, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import { createLayoutWrapper } from '../use-layout.ts';
import calendar from './index.ts';

// The Calendar instance the layout renders (not exposed by the layout state), for moveEvent: the spy keeps `render`.
const render = vi.spyOn(FullCalendar.prototype, 'render');
const fullCalendar = () => render.mock.contexts.at(-1) as FullCalendar | undefined;

enableAutoUnmount(afterEach);

let fetch: ReturnType<typeof mockFixtureApi>;

/** The fixture API with `_between` (not in the fixture filters) read as `_gte` + `_lte`; `answers` win. */
async function setup(answers: Record<string, any> = {}, max = 100) {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	const inner = mockFixtureApi(loadSnapshot());
	fetch = mockFixtureApi(loadSnapshot(), {
		answers: {
			'GET /items/bo_content': ({ url, init }: { url: URL; init: RequestInit }) => {
				const filter = url.searchParams.get('filter');
				const between = (_key: string, value: any) =>
					value?._between ? { _gte: value._between[0], _lte: value._between[1] } : value;
				if (filter) url.searchParams.set('filter', JSON.stringify(JSON.parse(filter, between)));
				return inner(url, init);
			},
			...answers,
		},
	});
	await useUserStore().hydrate();
	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);
	useServerStore().info.queryLimit = { default: 100, max };
}

beforeEach(() => {
	render.mockClear();
	return setup();
});

const OCTOBER = { type: 'dayGridMonth', startDateStr: '2026-10-01T00:00:00' };

async function mountCalendar(initial: { layoutOptions?: any; filterUser?: Filter | null } = {}) {
	const layoutOptions = ref(initial.layoutOptions ?? null);
	const Wrapper = createLayoutWrapper(calendar);

	const Harness = defineComponent(
		() => () =>
			h(
				Wrapper,
				{
					collection: 'bo_content',
					layoutOptions: layoutOptions.value,
					layoutProps: { height: '700px' },
					filterUser: initial.filterUser ?? null,
					filter: initial.filterUser ?? null,
					resetPreset: async () => undefined,
					'onUpdate:layoutOptions': (value: any) => (layoutOptions.value = value),
				},
				{
					default: ({ layoutState }: { layoutState: Record<string, any> }) =>
						h('div', { style: 'width: 1000px; height: 800px' }, [
							h('header', [h(calendar.slots.actions, layoutState)]),
							h(calendar.component, layoutState, {
								error: ({ error }: { error: any }) => h('p', { 'data-test': 'error' }, String(error)),
							}),
						]),
				},
			),
	);

	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });
	await router.push('/content/bo_content');
	const wrapper = mount(Harness, { global: { plugins: [router, i18n] }, attachTo: document.body });
	await vi.waitFor(() => expect(document.querySelector('.fc .fc-toolbar-title')).not.toBeNull(), { timeout: 5000 });
	await flushPromises();

	return { wrapper, router, layoutOptions };
}

const eventTitles = () =>
	[...document.querySelectorAll('.fc-daygrid-event .fc-event-title')].map((el) => el.textContent?.trim());

/** The value a theme token resolves to, read through a probe element. */
function token(name: string) {
	const probe = document.body.appendChild(document.createElement('div'));
	probe.style.color = `var(${name})`;
	const value = getComputedStyle(probe).color;
	probe.remove();
	return value;
}

async function serious(el: Element) {
	const { violations } = await axe.run(el, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
	return violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.map((v) => `${v.id} ${v.nodes.map((n) => n.html + n.failureSummary).join('|')}`);
}

test('October with a dateTime start field: events, time grid views, the count line', async () => {
	await mountCalendar({
		layoutOptions: { startDateField: 'date_published', template: '{{ title }}', viewInfo: OCTOBER },
	});

	await vi.waitFor(() => expect(eventTitles()).toContain('Content 05'));
	expect(document.querySelector('.fc-toolbar-title')!.textContent).toBe('October 2026');
	expect(document.querySelector('.fc-timeGridWeek-button')).not.toBeNull();
	expect(document.querySelector('.fc-dayGridWeek-button')).toBeNull();
	expect(document.querySelector('[role="status"]')!.textContent).toBe(i18n.global.t('item_count', { count: 30 }, 30));
	expect(document.querySelector('.fc-scrollgrid')!.getBoundingClientRect().height).toBeGreaterThan(400);
});

test('calendar.css: FullCalendar variables from the theme tokens, light and dark; axe has no serious issue', async () => {
	const { wrapper } = await mountCalendar({ layoutOptions: { startDateField: 'date_published', viewInfo: OCTOBER } });
	await vi.waitFor(() => expect(eventTitles().length).toBeGreaterThan(0));

	const grid = document.querySelector('.fc-scrollgrid')!;
	const today = document.querySelector<HTMLElement>('.fc .fc-button-primary.fc-today-button')!;
	expect(getComputedStyle(grid).borderTopColor).toBe(token('--color-gray-200'));
	expect(getComputedStyle(today).borderRadius).toBe('8px');
	expect(getComputedStyle(today).height).toBe('36px');
	expect(getComputedStyle(document.querySelector('.fc-toolbar-title')!).color).toBe(token('--color-gray-800'));

	const noTransitions = document.head.appendChild(document.createElement('style'));
	noTransitions.textContent = '*, *::before, *::after { transition: none !important; }';
	try {
		expect(await serious(wrapper.element)).toEqual([]);
		document.documentElement.classList.add('dark');
		expect(getComputedStyle(grid).borderTopColor).toBe(token('--color-gray-800'));
		expect(getComputedStyle(today).backgroundColor).toBe(token('--color-gray-800'));
		expect(await serious(wrapper.element)).toEqual([]);
	} finally {
		document.documentElement.classList.remove('dark');
		noTransitions.remove();
	}
});

test('next month: viewInfo goes to the layout options and the request asks for the new range', async () => {
	const { layoutOptions } = await mountCalendar({
		layoutOptions: { startDateField: 'date_published', viewInfo: OCTOBER },
	});
	await vi.waitFor(() => expect(eventTitles().length).toBeGreaterThan(0));

	await userEvent.click(document.querySelector<HTMLElement>('.fc-next-button')!);

	await vi.waitFor(() => expect(layoutOptions.value.viewInfo.type).toBe('dayGridMonth'));
	expect(layoutOptions.value.viewInfo.startDateStr.startsWith('2026-11-01T00:00:00')).toBe(true);
	expect(document.querySelector('.fc-toolbar-title')!.textContent).toBe('November 2026');
	await vi.waitFor(() =>
		expect(
			calls(fetch).some((call) => call.includes('/items/bo_content?') && call.includes('"_between":["2026-11-01')),
		).toBe(true),
	);
});

/**
 * Moves the event of October 3 to October 10 the way a drop ends: FullCalendar's `EventApi.moveDates`, which fires the
 * layout's `eventChange` (with `revert`) like a drag does. A pointer drag on the loaded CI runner was not taken as a drop
 * even after retries (CI 39018596094, 39031268612); what this file checks is the layout's handler, not FullCalendar's
 * own drag.
 */
async function moveEvent() {
	await vi.waitFor(() => expect(fullCalendar()).toBeDefined());
	fullCalendar()!.getEventById('3')!.moveDates({ days: 7 });
}

test('moving an event to another day (a drop) PATCHes the start date cut to 19 characters', async () => {
	await mountCalendar({ layoutOptions: { startDateField: 'date_published', viewInfo: OCTOBER } });
	await vi.waitFor(() => expect(document.querySelector('td[data-date="2026-10-03"] .fc-event')).not.toBeNull());

	await moveEvent();

	await vi.waitFor(() => expect(calls(fetch)).toContain('PATCH /items/bo_content/3'));
	const [, init] = fetch.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
	expect(JSON.parse(String(init!.body))).toEqual({ date_published: '2026-10-10T09:00:00' });
});

test('a failed PATCH puts the event back', async () => {
	await setup({
		'PATCH /items/bo_content/3': () =>
			json({ errors: [{ message: 'Forbidden', extensions: { code: 'FORBIDDEN' } }] }, 403),
	});
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	await mountCalendar({ layoutOptions: { startDateField: 'date_published', viewInfo: OCTOBER } });
	await vi.waitFor(() => expect(document.querySelector('td[data-date="2026-10-03"] .fc-event')).not.toBeNull());

	await moveEvent();

	// The PATCH and the revert take longer than the default second on a loaded CI runner.
	await vi.waitFor(() => expect(warn).toHaveBeenCalled(), { timeout: 15_000 });
	await vi.waitFor(() => expect(document.querySelector('td[data-date="2026-10-03"] .fc-event')).not.toBeNull(), {
		timeout: 5_000,
	});
	expect(document.querySelectorAll('td[data-date="2026-10-10"] .fc-event')).toHaveLength(1);
	warn.mockRestore();
}, 30_000);

test('clicking an event opens the item', async () => {
	const { router } = await mountCalendar({ layoutOptions: { startDateField: 'date_published', viewInfo: OCTOBER } });
	await vi.waitFor(() => expect(document.querySelector('td[data-date="2026-10-02"] .fc-event')).not.toBeNull());

	await userEvent.click(document.querySelector<HTMLElement>('td[data-date="2026-10-02"] .fc-event')!);

	await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/content/bo_content/2'));
});

test('more items than the query limit: the dataset notice', async () => {
	await setup({}, 10);
	await mountCalendar({ layoutOptions: { viewInfo: OCTOBER } });

	await vi.waitFor(() =>
		expect(document.body.textContent).toContain(
			i18n.global.t('dataset_too_large_currently_showing_n_items', { n: 10 }),
		),
	);
});
