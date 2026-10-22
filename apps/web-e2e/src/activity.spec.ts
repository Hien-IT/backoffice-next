// Feature 018 US5 (T085; US5-1 to US5-5, FR-060 to FR-065): the Activity module. A temporary bo_content item is created,
// updated and deleted through the API (admin); the activity list shows the four Directus columns sorted by -timestamp,
// the sub-menu filters by user and action (one GET /activity each, aria-current on the chosen row), the detail drawer
// shows the row and `launch` opens the item page, /content/directus_activity redirects to /activity, and a user with only
// the minimal app permissions reads its own activity only.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL, DATA_PREFIX } from './helpers/config.js';
import { Fixtures, type TestUser } from './helpers/fixtures.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;
let fixtures: Fixtures;
let itemId: number;
let minimal: TestUser;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	fixtures = new Fixtures(api);
	minimal = await fixtures.user('activity-minimal', { role: await fixtures.role('activity minimal') });

	const { id } = await api.call<{ id: number }>('POST', '/items/bo_content', {
		data: { title: `${DATA_PREFIX}-activity`, status: 'draft' },
	});
	itemId = id;
	await api.call('PATCH', `/items/bo_content/${id}`, { data: { status: 'published' } });
});

test.beforeEach(async () => {
	await resetLastPage(api);
	// The tabular layout keeps its page in the admin's preset (as Directus): start on page 1 with no stored filter.
	const presets = await api.call<{ id: number }[]>(
		'GET',
		'/presets?filter[collection][_eq]=directus_activity&filter[user][_eq]=$CURRENT_USER&filter[bookmark][_null]=true&fields=id',
	);
	for (const { id } of presets) await api.call('DELETE', `/presets/${id}`);
});

test.afterAll(async () => {
	await api.call('DELETE', `/items/bo_content/${itemId}`).catch(() => undefined);
	await fixtures.cleanup();
});

/** The list request of the layout (not its aggregate count requests). */
const isActivityList = (url: string) => {
	const { pathname, searchParams } = new URL(url);
	return pathname.endsWith('/activity') && !searchParams.has('aggregate[count]') && searchParams.has('sort');
};

async function openActivity(page: Page, user = ADMIN) {
	await page.goto('/admin/login');
	await login(page, user);
	await expect(page).toHaveURL(CONTENT_URL);
	const list = page.waitForResponse((response) => isActivityList(response.url()));
	await page.goto('/admin/activity');
	await expect(page.getByRole('heading', { level: 1, name: 'Activity Feed' })).toBeVisible();
	return list;
}

// In the sidebar (D-157): the pagination of the list is also a navigation named after the collection ("Activity", D-117).
const subMenu = (page: Page) => page.locator('aside#navigation').getByRole('navigation', { name: 'Activity', exact: true });

async function chooseFilter(page: Page, name: string) {
	const navigation = subMenu(page);
	// Below xl the sub-menu is in the navigation drawer: open it, then close it with Escape (its backdrop covers the page).
	const drawer = !(await navigation.isVisible());
	if (drawer) await page.getByRole('button', { name: 'Open navigation' }).click();
	const request = page.waitForRequest((request) => isActivityList(request.url()));
	await navigation.getByRole('button', { name, exact: true }).click();
	const filter = new URL((await request).url()).searchParams.get('filter');
	await expect(navigation.getByRole('button', { name, exact: true })).toHaveAttribute('aria-current', 'true');
	if (drawer) {
		await page.keyboard.press('Escape');
		await expect(navigation).toBeHidden();
	}
	return filter ? JSON.parse(filter) : null;
}

test('columns, sort and the sub-menu filters (US5-1, US5-2)', async ({ page }) => {
	const list = await openActivity(page);
	const query = new URL((await list).url()).searchParams;
	expect(query.get('sort')).toBe('-timestamp');

	const headers = page.locator('main thead th');
	await expect(headers.filter({ hasText: /\S/ })).toHaveText([/Action/, /Collection/, /Action On/, /Action By/, /.*/]);

	expect(await chooseFilter(page, 'Update')).toEqual({ action: { _eq: 'update' } });
	await expect(page.locator('main tbody tr').first()).toContainText('Update');

	expect(await chooseFilter(page, 'Create')).toEqual({ action: { _eq: 'create' } });
	expect(JSON.stringify(await chooseFilter(page, 'My Activity'))).toContain('"user":{"_eq":"');
	expect(await chooseFilter(page, 'All Activity')).toBeNull();
});

test('the detail drawer and launch to the item page (US5-3, US5-4)', async ({ page }) => {
	await openActivity(page);
	await chooseFilter(page, 'Update');

	const row = page.locator('main tbody tr').filter({ hasText: 'Bo Content' }).first();
	await row.click();
	const drawer = page.getByRole('dialog');
	await expect(drawer).toContainText('bo_content');
	await expect(drawer).toContainText(String(itemId));
	await expect(page).toHaveURL(/\/admin\/activity\/\d+/);

	await drawer.getByRole('link', { name: 'Open' }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/content/bo_content/${itemId}$`));
});

test('/content/directus_activity redirects to /activity (FR-065)', async ({ page }) => {
	await openActivity(page);
	await page.goto('/admin/content/directus_activity');
	await expect(page).toHaveURL(/\/admin\/activity$/);
});

test('a user with the minimal app permissions reads its own activity only (US5-5)', async ({ page }) => {
	const list = await openActivity(page, minimal);
	const { data } = (await (await list).json()) as { data: { user: string | { id: string } | null }[] };

	expect(data.length).toBeGreaterThan(0);
	expect(data.every((row) => (typeof row.user === 'object' ? row.user?.id : row.user) === minimal.id)).toBe(true);
});
