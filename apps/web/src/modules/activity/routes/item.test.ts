// Directus has no test for modules/activity/routes/item.vue (spec 018 T080, US5-4, FR-063, contracts/api-calls.md
// #200): the drawer reads one activity with the Directus fields, translates the action label (raw key when there is
// no translation), shows the date in the local format and the user with its popover (an empty row without user), links
// the related item except for system collections and deletes, shows a translated error notice, and closes back to the
// list with the page query. directus_activity fields and relations come from directus/packages/system-data (the
// fixture set has none).
import type { Pinia } from 'pinia';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { h } from 'vue';
import { RouterView, type RouteRecordRaw } from 'vue-router';
import { replaceQueue } from '../../../api/sdk.ts';
import UserPopover from '../../../components/render/UserPopover.vue';
import { i18n } from '../../../lang/index.ts';
import { useUserStore } from '../../../stores/user.ts';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../test-utils/fixtures.ts';
import { mountLayout } from '../../../test-utils/layout.ts';
import { userName } from '../../../utils/user-name.ts';
import { systemFields, systemRelations } from '../../settings/test-system-data.ts';
import ActivityItemRoute from './ActivityItemRoute.vue';

// The pinia of the mounted app: under load a late callback of an earlier test can change the active pinia.
let appPinia: Pinia;

enableAutoUnmount(afterEach);
afterEach(() => {
	vi.unstubAllGlobals();
	assertOnlyKnownRequests(calls(fetch));
});

const t = (key: string, ...args: unknown[]) => (i18n.global.t as (...a: unknown[]) => string)(key, ...args);

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(() => replaceQueue());

const routes: RouteRecordRaw[] = [
	{
		path: '/activity',
		name: 'activity-collection',
		component: { render: () => h(RouterView, { name: 'detail' }) },
		children: [
			{
				path: ':primaryKey',
				name: 'activity-item',
				components: { detail: ActivityItemRoute },
				props: { detail: true },
			},
		],
	},
	{ path: '/:p(.*)*', component: { render: () => null } },
];

const RECORD = {
	user: null,
	action: 'update',
	timestamp: '2026-10-01T08:30:00.000Z',
	ip: '10.0.0.1',
	user_agent: 'agent',
	origin: 'http://app.test',
	collection: 'bo_content',
	item: '4',
};

async function setup(path = '/activity/1', answers: Record<string, unknown> = {}) {
	const snapshot = loadSnapshot();
	snapshot.systemFields.push(...(systemFields().filter((f) => f.collection === 'directus_activity') as never[]));
	snapshot.relations.push(...systemRelations().filter((r) => r.collection === 'directus_activity'));

	const mounted = await mountLayout(
		{ render: () => h(RouterView) },
		{
			routes,
			path,
			async beforeMount() {
				fetch = mockFixtureApi(snapshot, { user: 'admin', answers });
				await useUserStore().hydrate();
				fetch.mockClear();
			},
		},
	);

	await vi.waitFor(() => expect(drawer()?.querySelector('dl, [role="alert"], .border-error-500')).toBeTruthy());
	appPinia = mounted.wrapper.vm.$pinia;
	return mounted;
}

const drawer = () => document.querySelector<HTMLElement>('[role="dialog"]');
/** The definition list as label → value. */
const rows = () =>
	Object.fromEntries(
		[...drawer()!.querySelectorAll('dt')].map((dt) => [
			dt.textContent!.trim().replace(/:$/, ''),
			dt.nextElementSibling!.textContent!.trim(),
		]),
	);
const launch = () => drawer()!.querySelector<HTMLAnchorElement>(`a[aria-label="${t('open')}"]`);

describe('activity drawer (US5-4)', () => {
	test('GET /activity/<pk> with the Directus fields; user, translated action, local date, link to the item', async () => {
		const { wrapper } = await setup();
		const row = loadSnapshot().activity[0]!;

		const url = new URL(
			String(fetch.mock.calls.find(([input]) => new URL(String(input)).pathname === '/activity/1')![0]),
		);
		expect(url.searchParams.get('fields')!.split(',')).toEqual([
			'user.id',
			'user.email',
			'user.first_name',
			'user.last_name',
			'action',
			'timestamp',
			'ip',
			'user_agent',
			'origin',
			'collection',
			'item',
		]);

		expect(drawer()!.textContent).toContain(t('activity_item'));
		expect(rows()).toEqual({
			[t('user')]: userName(useUserStore(appPinia).currentUser as never),
			[t('action')]: t('field_options.directus_activity.create'),
			[t('date')]: new Date(row['timestamp'] as string).toLocaleString(i18n.global.locale.value),
			[t('ip_address')]: '',
			[t('user_agent')]: '',
			[t('origin')]: '',
			[t('collection')]: 'bo_insights_data',
			[t('item')]: '1',
		});
		expect(wrapper.findComponent(UserPopover).props('user')).toBe(row['user']);
		expect(launch()!.getAttribute('href')).toBe('/content/bo_insights_data/1');
	});

	test('an action without translation shows its key; no user leaves the user row empty', async () => {
		const { wrapper } = await setup('/activity/1', { 'GET /activity/1': { ...RECORD, action: 'run' } });

		expect(rows()[t('action')]).toBe('run');
		expect(rows()[t('user')]).toBe('');
		expect(wrapper.findComponent(UserPopover).exists()).toBe(false);
		expect(rows()[t('ip_address')]).toBe('10.0.0.1');
		expect(launch()!.getAttribute('href')).toBe('/content/bo_content/4');
	});

	test.each([
		['a system collection', { collection: 'directus_users' }],
		['a delete', { action: 'delete' }],
	])('no launch button for %s', async (_, edit) => {
		await setup('/activity/1', { 'GET /activity/1': { ...RECORD, ...edit } });

		expect(drawer()!.querySelector('dl')).not.toBeNull();
		expect(launch()).toBeNull();
	});

	test('a load error shows the translated message in a danger notice', async () => {
		await setup('/activity/1', {
			'GET /activity/1': () => json({ errors: [{ message: 'Forbidden', extensions: { code: 'FORBIDDEN' } }] }, 403),
		});

		expect(drawer()!.querySelector('dl')).toBeNull();
		expect(drawer()!.querySelector('.border-error-500')!.textContent).toContain(t('errors.FORBIDDEN'));
		expect(launch()).toBeNull();
	});

	test('closing goes back to the list with the page query', async () => {
		const { router } = await setup('/activity/1?bookmark=2');

		drawer()!
			.querySelector<HTMLButtonElement>(`button[aria-label="${t('cancel')}"]`)!
			.click();
		await flushPromises();

		expect(router.currentRoute.value.name).toBe('activity-collection');
		expect(router.currentRoute.value.query).toEqual({ bookmark: '2' });
	});
});
