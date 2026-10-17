// Feature 018 US4 (T072; US4-1 to US4-4, FR-053 to FR-056): the dashboard variables of bo_dash_vars. The metric and
// list filter bo_insights_data by `{{ vars_status }}` (variable, default published) and `{{ vars_author }}`
// (relational variable on directus_users). Expected values come from the seed rows (apps/web/fixtures/interfaces/seed.mjs
// INSIGHTS_ROWS: rows 1-7 owned by admin, 8-12 by bo-editor). The spec never writes bo_dash_vars.
import type { Page, Request } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { dashboardId, DASHBOARDS, openInsights, readTileText, tileOfType } from './helpers/insights.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;
let id: string;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	id = await dashboardId(api, DASHBOARDS.vars);
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
});

const isGraphql = (request: Request) =>
	request.method() === 'POST' && /\/graphql$/.test(new URL(request.url()).pathname);

/** The number of panel aliases in the next POST /graphql document. */
async function nextQuery(page: Page, action: () => Promise<void>) {
	const request = page.waitForRequest(isGraphql);
	await action();
	const { query } = (await request).postDataJSON() as { query: string };
	return query.match(/query_[0-9a-f]+:/g)?.length ?? 0;
}

async function pickOwner(page: Page, email: string) {
	await tileOfType(page, 'relational-variable').getByRole('button', { name: 'Add Existing' }).click();
	const drawer = page.getByRole('dialog');
	await drawer.getByRole('row').filter({ hasText: email }).getByRole('checkbox').click();
	await drawer.getByRole('button', { name: 'Save' }).click();
	await expect(drawer).toBeHidden();
}

async function chooseStatus(page: Page, status: string) {
	await tileOfType(page, 'variable').getByRole('combobox').click();
	await page.getByRole('option', { name: status, exact: true }).click();
}

const metric = (page: Page) => readTileText(page, 'metric');
const listRows = (page: Page) => tileOfType(page, 'list').getByRole('listitem');

test('the variables filter the metric and the list; only those panels ask their data again (US4-1 to US4-4)', async ({
	page,
}) => {
	await openInsights(page, `/${id}`);
	await expect(page.getByRole('heading', { level: 1, name: DASHBOARDS.vars })).toBeVisible();

	// No owner yet: the panels using {{ vars_author }} get no data and send no request (FR-056).
	await expect(tileOfType(page, 'metric')).toContainText('No Data');
	await expect(tileOfType(page, 'variable').getByRole('combobox')).toContainText('published');

	expect(await nextQuery(page, () => pickOwner(page, 'admin@example.com'))).toBe(2);
	await expect.poll(() => metric(page)).toMatch(/\b4\b/);
	await expect(listRows(page)).toHaveCount(4);

	expect(await nextQuery(page, () => chooseStatus(page, 'draft'))).toBe(2);
	await expect.poll(() => metric(page)).toMatch(/\b2\b/);
	await expect(listRows(page)).toHaveCount(2);

	await chooseStatus(page, 'archived');
	await expect.poll(() => metric(page)).toMatch(/\b1\b/);

	await pickOwner(page, 'bo-editor@example.com');
	await expect.poll(() => metric(page)).toMatch(/\b3\b/);
	await expect(listRows(page)).toHaveCount(3);

	// The variable values live in the page only: a reload is back to the defaults.
	await page.reload();
	await expect(tileOfType(page, 'variable').getByRole('combobox')).toContainText('published');
	await expect(tileOfType(page, 'metric')).toContainText('No Data');
});
