// Feature 018 (contracts/components.md §8): the dashboards of the fixture set and the temporary dashboards a spec creates.
// A spec names its dashboards `${DATA_PREFIX}-<spec>-<n>` (the three configurations never touch each other's rows) and
// deletes them in `afterAll`; no spec changes the bo_dash_* dashboards.
import { expect, type Page } from '@playwright/test';
import type { AdminApi } from './api.js';
import { ADMIN, CONTENT_URL, DATA_PREFIX } from './config.js';
import { login } from './login.js';

/** lib.mjs DASHBOARDS of apps/web/fixtures/interfaces. */
export const DASHBOARDS = {
	all: 'bo_dash_all',
	vars: 'bo_dash_vars',
	system: 'bo_dash_system',
	empty: 'bo_dash_empty',
	unknown: 'bo_dash_unknown',
} as const;

export const tempDashboardName = (spec: string, n: number | string) => `${DATA_PREFIX}-${spec}-${n}`;

/** The id of a dashboard by name (fixture or temporary). */
export async function dashboardId(api: AdminApi, name: string): Promise<string> {
	const rows = await api.call<{ id: string }[]>(
		'GET',
		`/dashboards?filter[name][_eq]=${encodeURIComponent(name)}&fields=id&limit=1`,
	);
	if (!rows[0]) throw new Error(`dashboard ${name} not found`);
	return rows[0].id;
}

/** Creates a temporary dashboard (optionally with panels) through the API; returns its id. */
export async function createTempDashboard(
	api: AdminApi,
	name: string,
	panels: Record<string, unknown>[] = [],
): Promise<string> {
	const dashboard = await api.call<{ id: string }>('POST', '/dashboards?fields=id', {
		data: { name, icon: 'dashboard', panels },
	});
	return dashboard.id;
}

/** Deletes every dashboard whose name starts with `${DATA_PREFIX}-${spec}` (panels go with them). */
export async function deleteTempDashboards(api: AdminApi, spec: string): Promise<void> {
	const rows = await api.call<{ id: string }[]>(
		'GET',
		`/dashboards?filter[name][_starts_with]=${encodeURIComponent(`${DATA_PREFIX}-${spec}`)}&fields=id&limit=-1`,
	);
	if (rows.length > 0) await api.call('DELETE', '/dashboards', { data: rows.map((row) => row.id) });
}

/** Logs in as admin and opens /admin/insights (or a dashboard of it). */
export async function openInsights(page: Page, path = ''): Promise<void> {
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
	await page.goto(`/admin/insights${path}`);
}

/** The dashboards table row of a dashboard on the overview page. */
export const dashboardRow = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name });

/** The tile of a panel by its id. */
export const tile = (page: Page, id: string) => page.locator(`[data-panel-id="${id}"]`);

/** A tile by its panel type (the first one). */
export const tileOfType = (page: Page, type: string) => page.locator(`[data-panel-type="${type}"]`).first();

export interface GridTile {
	id: string;
	type: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Cell, size and type of every tile, from the attributes BoWorkspaceTile exposes, sorted by position. */
export async function readGrid(page: Page): Promise<GridTile[]> {
	return page.locator('[data-panel-id]').evaluateAll((tiles) =>
		tiles
			.map((tile) => ({
				id: tile.getAttribute('data-panel-id')!,
				type: tile.getAttribute('data-panel-type')!,
				x: Number(tile.getAttribute('data-pos-x')),
				y: Number(tile.getAttribute('data-pos-y')),
				w: Number(tile.getAttribute('data-width')),
				h: Number(tile.getAttribute('data-height')),
			}))
			.sort((a, b) => a.y - b.y || a.x - b.x),
	);
}

/** Columns and rows of the sr-only data table of a chart tile (FR-105, FR-106). */
export async function readChartTable(page: Page, type: string): Promise<{ columns: string[]; rows: string[][] }> {
	const table = tileOfType(page, type).locator('[data-chart-table]');
	await expect(table).toBeAttached();
	return table.evaluate((element) => ({
		columns: Array.from(element.querySelectorAll('thead th')).map((th) => th.textContent!.trim()),
		rows: Array.from(element.querySelectorAll('tbody tr')).map((tr) =>
			Array.from(tr.querySelectorAll('td')).map((td) => td.getAttribute('data-value') ?? ''),
		),
	}));
}

/** The visible text of a tile body (header with its icon ligature excluded). */
export async function readTileText(page: Page, type: string): Promise<string> {
	const node = tileOfType(page, type);
	const header = await node.locator('[data-panel-header]').allInnerTexts();
	const text = await node.innerText();
	return header
		.reduce((rest, name) => rest.replace(name, ''), text)
		.replace(/\s+/g, ' ')
		.trim();
}
