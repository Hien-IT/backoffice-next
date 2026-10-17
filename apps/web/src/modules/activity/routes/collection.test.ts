// Directus has no test for modules/activity/routes/collection.vue and components/navigation.vue (spec 018 T080, US5-1
// to US5-3, FR-060, FR-061, contracts/api-calls.md #199): the real tabular layout over the fixture API with the default
// directus_activity preset, the sub-menu filter sent as part of GET /activity and marked with aria-current, a stored
// user filter merged with it by `_and`, no row selection, the empty state, a row click opening the detail view. The
// directus_activity collection, fields and relations are built from directus/packages/system-data (the fixture set has
// none); `timestamp` gets its real type (the yaml has none).
import type { Pinia } from 'pinia';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { RouterView, useRoute, type RouteRecordRaw } from 'vue-router';
import { replaceQueue } from '../../../api/sdk.ts';
import { resetNotices } from '../../../composables/use-notices.ts';
import { i18n } from '../../../lang/index.ts';
import { useCollectionsStore } from '../../../stores/collections.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import { usePermissionsStore } from '../../../stores/permissions.ts';
import { usePresetsStore } from '../../../stores/presets.ts';
import { useRelationsStore } from '../../../stores/relations.ts';
import { useServerStore } from '../../../stores/server.ts';
import { useUserStore } from '../../../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../../test-utils/fetch.ts';
import { loadSnapshot, type Snapshot } from '../../../test-utils/fixtures.ts';
import { mountLayout } from '../../../test-utils/layout.ts';
import { systemCollections, systemFields, systemRelations } from '../../settings/test-system-data.ts';
import ActivityCollectionRoute from './ActivityCollectionRoute.vue';

// The pinia of the mounted app: under load a late callback of an earlier test can change the active pinia.
let appPinia: Pinia;

// The sidebar shows the `navigation` slot under the module bar entry of the open module (inside a drawer below `xl`);
// the stand-in renders the slot as is, so the test reaches the sub-menu without a module bar.
vi.mock('../../../layout/AppSidebar.vue', async () => {
	const { defineComponent: define } = await import('vue');
	return {
		default: define(
			(_, { slots }) =>
				() =>
					slots['navigation']?.(),
		),
	};
});

enableAutoUnmount(afterEach);
afterEach(async () => {
	// The preset autosave of use-preset (debounced 450 ms) lands in this test's mock, not in the next one.
	await new Promise((resolve) => setTimeout(resolve, 500));
	vi.unstubAllGlobals();
	assertOnlyKnownRequests(calls(fetch));
});

const t = (key: string, ...args: unknown[]) => (i18n.global.t as (...a: unknown[]) => string)(key, ...args);
const SLOW = 15_000;

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	resetNotices();
	localStorage.clear();
	await replaceQueue();
});

const Detail = defineComponent(() => {
	const route = useRoute();
	return () => h('div', { 'data-detail': route.params['primaryKey'] });
});

const routes: RouteRecordRaw[] = [
	{
		path: '/activity',
		name: 'activity-collection',
		component: ActivityCollectionRoute,
		props: true,
		children: [
			{ path: ':primaryKey', name: 'activity-item', meta: { isFloatingView: true }, components: { detail: Detail } },
		],
	},
	{ path: '/:p(.*)*', component: { render: () => null } },
];

function activitySnapshot(edit?: (snapshot: Snapshot) => void) {
	const snapshot = loadSnapshot();
	const fields = systemFields().filter((f) => f.collection === 'directus_activity');
	fields.find((f) => f.field === 'timestamp')!.type = 'timestamp';
	snapshot.systemFields.push(...(fields as never[]));
	snapshot.systemCollections.push(...systemCollections().filter((c) => c['collection'] === 'directus_activity'));
	snapshot.relations.push(...systemRelations().filter((r) => r.collection === 'directus_activity'));
	edit?.(snapshot);
	return snapshot;
}

async function setup(snapshot = activitySnapshot()) {
	const mounted = await mountLayout(
		{ render: () => h(RouterView) },
		{
			routes,
			path: '/activity',
			async beforeMount() {
				fetch = mockFixtureApi(snapshot, { user: 'admin' });
				await useUserStore().hydrate();
				await Promise.all([
					useFieldsStore().hydrate(),
					useRelationsStore().hydrate(),
					useCollectionsStore().hydrate(),
					usePermissionsStore().hydrate(),
					usePresetsStore().hydrate(),
				]);
				useServerStore().info.queryLimit = { default: 100, max: -1 };
			},
		},
	);

	await vi.waitFor(() => expect(document.querySelector('main [aria-busy="true"]')).toBeNull());
	await vi.waitFor(() => expect(document.querySelectorAll('nav button[aria-current]')).toHaveLength(1));
	await flushPromises();
	appPinia = mounted.wrapper.vm.$pinia;
	return mounted;
}

const rows = () => [...document.querySelectorAll('main tbody tr')];
const headers = () =>
	[...document.querySelectorAll('main thead th span.truncate')].map((span) => span.textContent?.trim());
/** The text of a sub-menu row without its icon ligature. */
const label = (el: Element) => el.querySelector('[data-icon] + *')?.textContent?.trim();
const navButton = (key: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('nav button')].find((b) => label(b) === t(key))!;
const current = () => [...document.querySelectorAll('nav button[aria-current="true"]')].map(label);

/** The query of the last item read of GET /activity (#199), not its count aggregates. */
function lastListQuery() {
	const url = fetch.mock.calls
		.map(([input]) => new URL(String(input)))
		.filter(
			(u) => u.pathname === '/activity' && !u.searchParams.has('aggregate[count]') && !u.search.includes('aggregate'),
		)
		.at(-1)!;

	return {
		sort: url.searchParams.get('sort'),
		fields: url.searchParams.get('fields'),
		filter: JSON.parse(url.searchParams.get('filter') ?? 'null'),
	};
}

async function click(el: HTMLElement) {
	el.click();
	await flushPromises();
}

/** The preset writes (POST/PATCH /presets) after the autosave debounce of use-preset (450 ms). */
async function presetWrites(): Promise<Record<string, unknown>[]> {
	await new Promise((resolve) => setTimeout(resolve, 600));
	await flushPromises();

	return fetch.mock.calls
		.filter(([input, init]) => ['POST', 'PATCH'].includes(init?.method ?? 'GET') && String(input).includes('/presets'))
		.map(([, init]) => JSON.parse(String(init!.body)));
}

/** use-items throttles its reads (500 ms, trailing): waits for the read with this filter and its rows. */
async function expectList(filter: unknown, rowCount: number) {
	await vi.waitFor(() => expect(lastListQuery().filter).toEqual(filter), { timeout: 2000 });
	await vi.waitFor(() => expect(rows()).toHaveLength(rowCount));
}

describe('activity list (US5-1)', () => {
	test(
		'title, default preset: tabular, sort -timestamp, four columns, no row selection',
		async () => {
			await setup();

			expect(document.querySelector('main h1')?.textContent?.trim()).toBe(t('activity_feed'));
			expect(rows()).toHaveLength(12);
			// The field names of directus_activity in the Directus translations (`timestamp` "Action On", `user` "Action By").
			expect(headers()).toEqual([
				t('fields.directus_activity.action'),
				t('fields.directus_activity.collection'),
				t('fields.directus_activity.timestamp'),
				t('fields.directus_activity.user'),
			]);
			expect(document.querySelector('main tbody [role="checkbox"], main tbody input[type="checkbox"]')).toBeNull();

			const query = lastListQuery();
			expect(query.sort).toBe('-timestamp');
			expect(query.fields!.split(',')).toEqual(expect.arrayContaining(['action', 'collection', 'timestamp']));
			expect(query.filter).toBeNull();
		},
		SLOW,
	);

	test(
		'a row click opens /activity/<id> in the detail view',
		async () => {
			const { router } = await setup();

			(rows()[0] as HTMLElement).click();
			await flushPromises();

			expect(router.currentRoute.value.name).toBe('activity-item');
			expect(document.querySelector('[data-detail]')).not.toBeNull();
		},
		SLOW,
	);

	test(
		'no activity: the empty state',
		async () => {
			await setup(activitySnapshot((s) => (s.activity = [])));

			expect(rows()).toHaveLength(0);
			expect(document.querySelector('main')!.textContent).toContain(t('item_count', 0));
			expect(document.querySelector('main')!.textContent).toContain(t('no_items_copy'));
		},
		SLOW,
	);
});

describe('sub-menu (US5-2, FR-061)', () => {
	test(
		'each row sends its system filter and becomes current; All clears it',
		async () => {
			await setup();
			const me = (useUserStore(appPinia).currentUser as { id: string }).id;

			expect(current()).toEqual([t('all_activity')]);

			await click(navButton('my_activity'));
			await expectList({ user: { _eq: me } }, 12);
			expect(current()).toEqual([t('my_activity')]);

			for (const [key, action] of [
				['create', 'create'],
				['update', 'update'],
				['delete_label', 'delete'],
				['login', 'login'],
				['logout', 'logout'],
			] as const) {
				await click(navButton(key));
				await expectList({ action: { _eq: action } }, action === 'create' ? 12 : 0);
				expect(current()).toEqual([t(key)]);
			}

			// Only `create` rows in the fixture; a system filter alone gives the "no items" state (tabular, as Directus).
			expect(document.querySelector('main')!.textContent).toContain(t('item_count', 0));

			await click(navButton('all_activity'));
			await expectList(null, 12);
			expect(current()).toEqual([t('all_activity')]);
		},
		SLOW,
	);

	test(
		'the system filter is not saved in the preset',
		async () => {
			await setup();
			await click(navButton('update'));
			await expectList({ action: { _eq: 'update' } }, 0);

			for (const body of await presetWrites()) expect(body['filter'] ?? null).toBeNull();
		},
		SLOW,
	);
});

describe('advanced filter (US5-3)', () => {
	test(
		'a stored user filter is merged with the sub-menu filter by _and',
		async () => {
			const userFilter = { collection: { _eq: 'bo_insights_data' } };

			await setup(
				activitySnapshot((s) =>
					s.presets.push({
						id: 9001,
						bookmark: null,
						user: s.users.admin.me.id,
						role: null,
						collection: 'directus_activity',
						layout: 'tabular',
						layout_query: { tabular: { sort: ['-timestamp'], fields: ['action', 'collection', 'timestamp', 'user'] } },
						layout_options: null,
						filter: userFilter,
						search: null,
					}),
				),
			);

			expect(lastListQuery().filter).toEqual(userFilter);

			await click(navButton('create'));
			await expectList({ _and: [userFilter, { action: { _eq: 'create' } }] }, 12);
			// The preset keeps the user filter only.
			expect((await presetWrites()).map((body) => body['filter'] ?? userFilter)).not.toContainEqual(
				expect.objectContaining({ action: expect.anything() }),
			);
		},
		SLOW,
	);
});
