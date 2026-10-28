// Feature 018 US2 (T049; US2-1 to US2-6, FR-020 to FR-023, FR-040 to FR-052): the dashboard page in view mode in the three
// configurations. bo_dash_all (every panel type on bo_insights_data, 12 fixed rows only the seed writes) shows each tile
// at its cell and size, its header, its value or its chart data (read from the sr-only table, FR-105), with one merged
// POST /graphql; bo_dash_system queries /graphql/system; bo_dash_empty has no tile; bo_dash_unknown shows the header of
// its unknown panel; zoom-to-fit scales the grid; auto refresh asks the data again. Expected values come from the seed
// rows (apps/web/fixtures/interfaces/seed.mjs INSIGHTS_ROWS).
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import {
	dashboardId,
	DASHBOARDS,
	openInsights,
	readChartTable,
	readGrid,
	readTileText,
	tileOfType,
} from './helpers/insights.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;
const ids: Record<string, string> = {};

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	for (const name of Object.values(DASHBOARDS)) ids[name] = await dashboardId(api, name);
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
});

async function openDashboard(page: Page, name: string) {
	const graphql = page.waitForRequest((request) => /\/graphql$/.test(new URL(request.url()).pathname));
	await openInsights(page, `/${ids[name]}`);
	await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
	return graphql;
}

test('bo_dash_all: every tile at its cell and size, one merged GraphQL document (US2-1, US2-2)', async ({ page }) => {
	const requests: string[] = [];
	page.on('request', (request) => {
		const path = new URL(request.url()).pathname;
		if (request.method() === 'POST' && /\/graphql(\/system)?$/.test(path)) requests.push(path);
	});
	await openDashboard(page, DASHBOARDS.all);
	await expect(tileOfType(page, 'metric')).toContainText('12');

	const grid = (await readGrid(page)).map(({ type, x, y, w, h }) => ({ type, x, y, w, h }));
	expect(grid).toEqual([
		{ type: 'metric', x: 1, y: 1, w: 6, h: 2 },
		{ type: 'label', x: 7, y: 1, w: 6, h: 2 },
		{ type: 'meter', x: 13, y: 1, w: 6, h: 6 },
		{ type: 'line-chart', x: 25, y: 1, w: 6, h: 6 },
		{ type: 'metric-list', x: 1, y: 3, w: 12, h: 6 },
		{ type: 'list', x: 13, y: 7, w: 12, h: 6 },
		{ type: 'bar-chart', x: 1, y: 9, w: 12, h: 10 },
		{ type: 'pie-chart', x: 19, y: 13, w: 10, h: 10 },
		{ type: 'time-series', x: 1, y: 19, w: 12, h: 6 },
		{ type: 'variable', x: 13, y: 19, w: 12, h: 6 },
		{ type: 'relational-variable', x: 25, y: 19, w: 12, h: 6 },
	]);
	expect(requests).toEqual(['/graphql']);
	await expect(tileOfType(page, 'metric').locator('[data-panel-name]')).toHaveText('Items');
});

test('bo_dash_all: the values of metric, metric list, meter, label and list (US2-3, FR-042 to FR-046)', async ({
	page,
}) => {
	await openDashboard(page, DASHBOARDS.all);
	await expect(tileOfType(page, 'metric')).toContainText('12');

	expect(await readTileText(page, 'metric')).toMatch(/#\s*12/);
	expect(await readTileText(page, 'label')).toBe('Backoffice');
	const metricList = await readTileText(page, 'metric-list');
	expect(metricList).toMatch(/published\s*5.*draft\s*4.*archived\s*3/i);
	expect(await readTileText(page, 'meter')).toContain('62');
	const list = await readTileText(page, 'list');
	expect(list).toMatch(/archived a.*draft b.*published c.*archived a.*draft a/);
	await expect(
		tileOfType(page, 'variable').getByRole('combobox').or(tileOfType(page, 'variable').locator('input')),
	).toBeVisible();
});

test('bo_dash_all: the chart data of bar, line, pie and time series (US2-3, FR-047 to FR-050, FR-105)', async ({
	page,
}) => {
	await openDashboard(page, DASHBOARDS.all);

	const bar = await readChartTable(page, 'bar-chart');
	expect(Object.fromEntries(bar.rows.map(([x, y]) => [x, Number(y)]))).toEqual({
		published: 48.14,
		draft: 70.35,
		archived: 26.35,
	});

	const pie = await readChartTable(page, 'pie-chart');
	expect(Object.fromEntries(pie.rows.map(([label, value]) => [label, Number(value)]))).toEqual({ a: 6, b: 4, c: 2 });

	const line = await readChartTable(page, 'line-chart');
	expect(Object.fromEntries(line.rows.map(([x, y]) => [x, Number(y)]))).toEqual({ a: 37, b: 21, c: 4 });

	const series = await readChartTable(page, 'time-series');
	expect(series.rows).toHaveLength(6);
	expect(series.rows.map((row) => Number(row[1]))).toEqual([2, 2, 2, 2, 2, 2]);
});

test('system collections go to /graphql/system; empty and unknown dashboards (US2-2, Edge Cases)', async ({ page }) => {
	const system = page.waitForRequest(
		(request) => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/graphql/system'),
	);
	await openInsights(page, `/${ids[DASHBOARDS.system]}`);
	await system;
	await expect(tileOfType(page, 'metric')).not.toContainText('Unexpected');

	await page.goto(`/admin/insights/${ids[DASHBOARDS.empty]}`);
	await expect(page.getByRole('heading', { level: 1, name: DASHBOARDS.empty })).toBeVisible();
	await expect(page.locator('[data-panel-id]')).toHaveCount(0);

	await page.goto(`/admin/insights/${ids[DASHBOARDS.unknown]}`);
	await expect(page.locator('[data-panel-type="bo-unknown"]')).toBeVisible();
	await expect(page.locator('[data-panel-type="bo-unknown"] [data-panel-name]')).toHaveText('Unknown');
});

test('zoom to fit scales the grid to the content area and back (US2-4)', async ({ page }) => {
	await openDashboard(page, DASHBOARDS.all);
	const zoom = page.getByRole('button', { name: 'Fit to Screen' });
	await zoom.click();
	await expect(zoom).toHaveAttribute('aria-pressed', 'true');
	// Directus does not cap the scale: below 1 on a wide grid, above 1 when the grid is smaller than the area.
	await expect(page.locator('[data-workspace]')).toHaveAttribute('data-zoom', /\d/);
	const fits = () =>
		page.locator('[data-insights-route]').evaluate((region) => {
			const area = region.getBoundingClientRect();
			const grid = region.querySelector('[data-workspace]')!.getBoundingClientRect();
			return grid.right <= area.right + 1 && grid.bottom <= area.bottom + 1;
		});
	await expect.poll(fits).toBe(true);
	await zoom.click();
	await expect(page.locator('[data-workspace]')).not.toHaveAttribute('data-zoom');
});

test('auto refresh every 10 s asks the panel data again (US2-5)', async ({ page }) => {
	await openDashboard(page, DASHBOARDS.all);
	const toggle = page.getByRole('button', { name: 'Open sidebar', exact: true });
	if (await toggle.isVisible()) await toggle.click();
	await page.getByRole('button', { name: 'Auto Refresh', exact: true }).click();
	await page.getByRole('combobox', { name: 'Refresh Interval' }).click();
	await page.getByRole('option', { name: 'Every 10 Seconds' }).click();
	// The timer belongs to the page: it keeps running once the detail popover is closed.
	await page.keyboard.press('Escape');
	await expect(page.getByRole('combobox', { name: 'Refresh Interval' })).toHaveCount(0);

	const again = await page.waitForRequest(
		(request) => request.method() === 'POST' && /\/graphql$/.test(new URL(request.url()).pathname),
		{ timeout: 15_000 },
	);
	expect(again).toBeTruthy();
});
