// Feature 018 T111 (SC-005, FR-101, contracts/tests.md §4, api-calls #193–#195): the Activity module reads what the
// Directus app 11.17.4 reads. On both apps: the GET /activity requests of opening /activity and of four sub-menu rows
// (All Activity, My Activity, Create, Update), of the list filtered on `collection` bo_insights_data (the filter of the
// admin's directus_activity preset, set through the API: both apps read it from the preset like a filter set in the
// search bar), and of the detail drawer `/activity/<pk>` of a seed row. Queries compare by meaning (`canonicalPath`),
// sorted per step. Read only, except the admin's directus_activity presets, deleted before and after. proxy-api only.
import type { Page, Request } from '@playwright/test';
import { AdminApi } from '../helpers/api.js';
import { apiUrl, directusUrl, e2eConfig } from '../helpers/config.js';
import { onDirectusApp } from '../helpers/directus-app.js';
import { resetLastPage } from '../helpers/login.js';
import { canonicalPath, signInBackoffice } from '../helpers/payload.js';
import { apiPath, expect, test } from '../helpers/requests.js';

test.skip(e2eConfig !== 'proxy-api', 'payload comparison runs in proxy-api only');
test.use({ actionTimeout: 15_000 });
test.describe.configure({ mode: 'default' });
test.setTimeout(180_000);

const ROWS = ['All Activity', 'My Activity', 'Create', 'Update'];

let api: AdminApi;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	await clearPresets();
});

test.afterAll(async () => {
	await clearPresets();
	await resetLastPage(api);
});

async function clearPresets() {
	const presets = await api.call<{ id: number }[]>(
		'GET',
		'/presets?filter[collection][_eq]=directus_activity&filter[user][_eq]=$CURRENT_USER&filter[bookmark][_null]=true&fields=id',
	);
	for (const { id } of presets) await api.call('DELETE', `/presets/${id}`);
}

/** The GET /activity requests `page` sends to `api` while `steps` run, by meaning, `pk` → `<pk>`, sorted. */
async function activityReads(page: Page, api: string, steps: () => Promise<void>, pk?: string): Promise<string[]> {
	const seen: string[] = [];
	const onRequest = (request: Request) => {
		const path = apiPath(request.url(), api);
		if (request.method() !== 'GET' || !path?.startsWith('/activity')) return;
		const read = canonicalPath(`${path}${new URL(request.url()).search}`);
		seen.push(pk ? read.replace(`/activity/${pk}`, '/activity/<pk>') : read);
	};
	page.on('request', onRequest);
	try {
		await steps();
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1_000);
	} finally {
		page.off('request', onRequest);
	}
	return seen.sort();
}

test('the list and the four sub-menu rows send the same GET /activity (#193, #194)', async ({ browser, page }) => {
	const dir = await onDirectusApp(browser, async (p) => {
		const steps: Record<string, string[]> = {};
		steps['open'] = await activityReads(p, directusUrl, async () => {
			await p.goto(`${directusUrl}/admin/activity`);
			await expect(p.locator('.v-table, .table-row').first()).toBeVisible({ timeout: 15_000 });
		});
		for (const row of ROWS)
			steps[row] = await activityReads(p, directusUrl, () =>
				p.locator('.module-nav .v-list-item', { hasText: new RegExp(`^\\s*\\S*\\s*${row}\\s*$`) }).click(),
			);
		return steps;
	});

	await signInBackoffice(page, api);
	const bo: Record<string, string[]> = {};
	bo['open'] = await activityReads(page, apiUrl, async () => {
		await page.goto('/admin/activity');
		await expect(page.locator('main tbody tr').first()).toBeVisible({ timeout: 15_000 });
	});
	const navigation = page.getByRole('navigation', { name: 'Activity', exact: true });
	for (const row of ROWS)
		bo[row] = await activityReads(page, apiUrl, () =>
			navigation.getByRole('button', { name: row, exact: true }).click(),
		);

	expect(dir['open']!.length).toBeGreaterThan(0);
	expect(bo).toEqual(dir);
});

test('the list filtered on collection bo_insights_data sends the same GET /activity (#193)', async ({
	browser,
	page,
}) => {
	const me = (await api.call<{ id: string }>('GET', '/users/me?fields=id')).id;
	// The sub-menu test leaves the preset the apps saved: the filter goes into the only one.
	await clearPresets();
	await api.call('POST', '/presets', {
		data: {
			user: me,
			collection: 'directus_activity',
			filter: { collection: { _eq: 'bo_insights_data' } },
		},
	});

	try {
		const dir = await onDirectusApp(browser, (p) =>
			activityReads(p, directusUrl, async () => {
				await p.goto(`${directusUrl}/admin/activity`);
				await expect(p.locator('.table-row').first()).toBeVisible({ timeout: 15_000 });
			}),
		);

		await signInBackoffice(page, api);
		const bo = await activityReads(page, apiUrl, async () => {
			await page.goto('/admin/activity');
			await expect(page.locator('main tbody tr').first()).toBeVisible({ timeout: 15_000 });
		});

		expect(dir.some((read) => read.includes('"bo_insights_data"'))).toBe(true);
		expect(bo).toEqual(dir);
	} finally {
		await clearPresets();
	}
});

test('the detail drawer sends the same GET /activity/<pk> (#195)', async ({ browser, page }) => {
	const [row] = await api.call<{ id: number }[]>(
		'GET',
		'/activity?filter[collection][_eq]=bo_insights_data&sort=-id&fields=id&limit=1',
	);
	const pk = String(row!.id);

	const dir = await onDirectusApp(browser, (p) =>
		activityReads(
			p,
			directusUrl,
			async () => {
				await p.goto(`${directusUrl}/admin/activity/${pk}`);
				await expect(p.locator('.v-drawer')).toContainText('bo_insights_data', { timeout: 15_000 });
			},
			pk,
		),
	);

	await signInBackoffice(page, api);
	const bo = await activityReads(
		page,
		apiUrl,
		async () => {
			await page.goto(`/admin/activity/${pk}`);
			await expect(page.getByRole('dialog')).toContainText('bo_insights_data', { timeout: 15_000 });
		},
		pk,
	);

	expect(dir.some((read) => read.startsWith('/activity/<pk>'))).toBe(true);
	expect(bo).toEqual(dir);
});
