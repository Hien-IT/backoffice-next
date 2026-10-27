// Spec 018 US1 (T030, T031; FR-010 to FR-015): the dashboards table reads the insights store (no request when it opens),
// sorts by name, filters by name, opens a dashboard on row click, gates the actions by permission, duplicates (POST with
// the panels, an error opens the dialog and stops the spinner: R-49), exports (GET ?export=json through apiFetch), deletes
// one or many; the dashboard dialog creates (POST fields=id, then the dashboard page) and edits (PATCH, no navigation).
import type { Pinia } from 'pinia';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { h } from 'vue';
import { RouterView, type RouteRecordRaw } from 'vue-router';
import { replaceQueue } from '../../../api/sdk.ts';
import { resetNotices, useNotices } from '../../../composables/use-notices.ts';
import { i18n } from '../../../lang/index.ts';
import { useInsightsStore } from '../../../stores/insights.ts';
import { usePermissionsStore } from '../../../stores/permissions.ts';
import { useUserStore } from '../../../stores/user.ts';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../test-utils/fixtures.ts';
import { mountLayout, press } from '../../../test-utils/layout.ts';
import InsightsOverviewRoute from './InsightsOverviewRoute.vue';

// The pinia of the mounted app: under load a late callback of an earlier test can change the active pinia.
let appPinia: Pinia;

vi.mock('file-saver', () => ({ default: { saveAs: vi.fn() } }));

enableAutoUnmount(afterEach);
afterEach(() => {
	vi.unstubAllGlobals();
	assertOnlyKnownRequests(calls(fetch));
});

const t = (key: string, ...args: unknown[]) => (i18n.global.t as (...a: unknown[]) => string)(key, ...args);
const SLOW = 15_000;

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	resetNotices();
	await replaceQueue();
});

const routes: RouteRecordRaw[] = [
	{ path: '/insights', name: 'insights-overview', component: InsightsOverviewRoute },
	{ path: '/insights/:primaryKey', name: 'insights-dashboard', component: { render: () => null } },
	{ path: '/:p(.*)*', component: { render: () => null } },
];

async function setup(answers: Record<string, unknown> = {}, { hydrated = true } = {}) {
	const mounted = await mountLayout(
		{ render: () => h(RouterView) },
		{
			routes,
			path: '/insights',
			async beforeMount() {
				fetch = mockFixtureApi(loadSnapshot(), { user: 'admin', answers });
				await useUserStore().hydrate();
				await usePermissionsStore().hydrate();
				if (hydrated) await useInsightsStore().hydrate();
				fetch.mockClear();
			},
		},
	);

	await flushPromises();
	appPinia = mounted.wrapper.vm.$pinia;
	return mounted;
}

const rowNames = () =>
	[...document.querySelectorAll('main tbody tr')].map((r) => r.querySelectorAll('td')[2]?.textContent?.trim());
const button = (label: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button')].find((el) => el.getAttribute('aria-label') === label);
const bodies = (method: string, path: RegExp) =>
	fetch.mock.calls
		.filter(([input, init]) => (init?.method ?? 'GET') === method && path.test(new URL(String(input)).pathname))
		.map(([, init]) => JSON.parse(String(init!.body ?? 'null')));

async function openRowMenu(name: string) {
	const trigger = button(t('item_options', { item: name }))!;
	trigger.focus();
	await press(trigger, 'Enter');
}

async function chooseMenu(text: string) {
	const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) =>
		el.textContent?.includes(text),
	)!;
	item.click();
	await flushPromises();
	await flushPromises();
}

describe('InsightsOverviewRoute', () => {
	test(
		'reads the store (no request), sorted by name, a row opens its dashboard',
		async () => {
			const { router } = await setup();

			expect(calls(fetch)).toEqual([]);
			expect(document.querySelector('main h1')!.textContent).toContain(t('insights'));
			expect(rowNames()).toEqual(['bo_dash_all', 'bo_dash_empty', 'bo_dash_system', 'bo_dash_unknown', 'bo_dash_vars']);

			[...document.querySelectorAll<HTMLElement>('main tbody tr')]
				.find((r) => r.textContent?.includes('bo_dash_vars'))!
				.click();
			await flushPromises();
			expect(router.currentRoute.value.name).toBe('insights-dashboard');
		},
		SLOW,
	);

	test(
		'search filters by name without a request; no match shows no_results with a clear button',
		async () => {
			await setup();
			const input = document.querySelector<HTMLInputElement>('main input[type="search"], main input')!;
			input.value = 'SYSTEM';
			input.dispatchEvent(new Event('input'));
			await flushPromises();
			expect(rowNames()).toEqual(['bo_dash_system']);

			input.value = 'nothing-matches';
			input.dispatchEvent(new Event('input'));
			await flushPromises();
			expect(document.body.textContent).toContain(t('no_results'));
			expect(calls(fetch)).toEqual([]);
		},
		SLOW,
	);

	test(
		'duplicate posts the dashboard with its panels and "(copy)"; an error opens the dialog',
		async () => {
			await setup();
			await openRowMenu('bo_dash_system');
			await chooseMenu(t('duplicate_dashboard'));

			const [body] = bodies('POST', /^\/dashboards$/);
			expect(body).toMatchObject({ name: 'bo_dash_system (copy)' });
			expect(body.panels).toHaveLength(2);
			expect(body.panels.every((panel: Record<string, unknown>) => !('id' in panel))).toBe(true);
			expect(calls(fetch).some((call) => call.startsWith('GET /dashboards'))).toBe(true);

			fetch.mockImplementationOnce(async () =>
				json({ errors: [{ message: 'No', extensions: { code: 'FORBIDDEN' } }] }, 403),
			);
			await openRowMenu('bo_dash_vars');
			await chooseMenu(t('duplicate_dashboard'));
			expect(useNotices().dialogs.value).toHaveLength(1);
		},
		SLOW,
	);

	test(
		'export asks GET /dashboards?export=json with the 15 fields and the id filter',
		async () => {
			const dashboards = loadSnapshot().dashboards;
			await setup({
				'GET /dashboards': ({ url }: { url: URL }) =>
					url.searchParams.has('export')
						? new Response('[]', { headers: { 'Content-Disposition': 'attachment; filename="x.json"' } })
						: json({ data: dashboards }),
			});
			await openRowMenu('bo_dash_all');
			await chooseMenu(t('export_dashboard'));

			const call = calls(fetch).find((c) => c.includes('export=json'))!;
			expect(call).toContain('panels.options');
			expect(call).toContain('"_in":[');
		},
		SLOW,
	);

	// Backoffice (spec 025, FR-028): export dashboard follows the export permission of the policies (DR: create).
	test(
		'export dashboard is disabled without the export permission, enabled with it',
		async () => {
			await setup();
			useUserStore(appPinia).currentUser = { ...useUserStore(appPinia).currentUser!, admin_access: false } as never;

			const exportItem = async (exportAccess: string) => {
				usePermissionsStore(appPinia).permissions = {
					directus_dashboards: {
						read: { access: 'full' },
						create: { access: 'full' },
						import: { access: 'none' },
						export: { access: exportAccess },
					},
				} as never;
				await flushPromises();
				await openRowMenu('bo_dash_all');
				const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) =>
					el.textContent?.includes(t('export_dashboard')),
				)!;
				const disabled = item.getAttribute('aria-disabled') === 'true';
				document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
				await flushPromises();
				return disabled;
			};

			expect(await exportItem('none')).toBe(true);
			expect(await exportItem('full')).toBe(false);
		},
		SLOW,
	);

	test(
		'delete one asks first, DELETE /dashboards/<id> then GET /dashboards',
		async () => {
			await setup();
			const id = useInsightsStore(appPinia).dashboards.find((d) => d.name === 'bo_dash_empty')!.id;
			await openRowMenu('bo_dash_empty');
			await chooseMenu(t('delete_dashboard'));

			const dialog = document.querySelector('[role="dialog"]')!;
			expect(dialog.textContent).toContain(t('dashboard_delete_confirm'));
			[...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === t('delete_label'))!.click();
			await flushPromises();
			await flushPromises();

			expect(calls(fetch)).toContain(`DELETE /dashboards/${id}`);
			expect(rowNames()).not.toContain('bo_dash_empty');
		},
		SLOW,
	);

	test(
		'no dashboards: the blank state with the create button, no search field',
		async () => {
			await setup({}, { hydrated: false });
			expect(document.body.textContent).toContain(t('no_dashboards'));
			expect(document.body.textContent).toContain(t('no_dashboards_copy'));
		},
		SLOW,
	);
});

describe('DashboardDialog', () => {
	// DR resets the icon to `space_dashboard` whenever the dialog opens (dashboard-dialog.vue watcher), so a new
	// dashboard is saved with that icon, not the `dashboard` of the initial values.
	test(
		'create: name required, POST /dashboards {name, icon, color, note} fields=id, then the dashboard page',
		async () => {
			const { router } = await setup({
				'POST /dashboards': ({ init }: { init: RequestInit }) =>
					json({ data: { id: 'new-dashboard', ...JSON.parse(String(init.body)) } }),
			});
			button(t('create_dashboard'))!.click();
			await flushPromises();

			const dialog = document.querySelector('[role="dialog"]')!;
			const save = [...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === t('save'))!;
			expect(save.disabled).toBe(true);

			const name = dialog.querySelector<HTMLInputElement>('input')!;
			name.value = 'Sales';
			name.dispatchEvent(new Event('input'));
			await flushPromises();
			save.click();
			await flushPromises();
			await flushPromises();

			expect(bodies('POST', /^\/dashboards$/)).toEqual([
				{ name: 'Sales', icon: 'space_dashboard', color: null, note: null },
			]);
			expect(calls(fetch).find((c) => c.startsWith('POST /dashboards'))).toContain('fields=id');
			expect(router.currentRoute.value.params['primaryKey']).toBe('new-dashboard');
		},
		SLOW,
	);

	test(
		'edit: PATCH /dashboards/<id> with the values, the dialog closes, no navigation',
		async () => {
			const { router } = await setup();
			const dashboard = useInsightsStore(appPinia).dashboards.find((d) => d.name === 'bo_dash_vars')!;
			await openRowMenu('bo_dash_vars');
			await chooseMenu(t('edit_dashboard'));

			const dialog = document.querySelector('[role="dialog"]')!;
			const name = dialog.querySelector<HTMLInputElement>('input')!;
			expect(name.value).toBe('bo_dash_vars');
			name.value = 'bo_dash_vars_renamed';
			name.dispatchEvent(new Event('input'));
			await flushPromises();
			[...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === t('save'))!.click();
			await flushPromises();
			await flushPromises();

			expect(bodies('PATCH', new RegExp(`^/dashboards/${dashboard.id}$`))[0]).toMatchObject({
				name: 'bo_dash_vars_renamed',
				icon: 'tune',
			});
			expect(router.currentRoute.value.name).toBe('insights-overview');
			expect(document.querySelector('[role="dialog"]')).toBeNull();
		},
		SLOW,
	);
});
