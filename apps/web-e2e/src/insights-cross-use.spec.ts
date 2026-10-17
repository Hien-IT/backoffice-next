// Feature 018 T113 (SC-002, SC-003, FR-102, contracts/tests.md §5): dashboards and notifications written in one app open
// and change in the other. (1) bo_dash_all and bo_dash_system (seeded through Directus REST) show in the Backoffice app
// with the cells, sizes and headers of the Directus app, the same text in metric, metric list, list, meter, label and
// the two variables, and chart tables equal to the Directus app's GraphQL answer for the same panel (category order,
// values); both APIs return the same panel rows. (2) A temporary dashboard with a metric and a bar chart added and
// arranged in the Backoffice app (metric at 13,1 in 8×4) opens the same in the Directus app; a label added and the metric
// resized to 10×4 there show after reloading the Backoffice app. (3) A dashboard and two panels made in the Directus app
// open the same in the Backoffice app. (4) The fixture notification bo_notification_item archived in the Backoffice
// app is in the Archive tab of the Directus app with the badge one lower; unarchived there, it is back in the Backoffice
// inbox (the fixture ends as it started). (5) bo_dash_vars: the same owner and status values give the same metric and
// list text in both apps. Runs at proxy-api only, in chromium at 1280 px (DIRECTUS_APP_SPECS of playwright.config.ts).
// Temporary dashboards: `${DATA_PREFIX}-xinsights-*` (Backoffice) and `${DATA_PREFIX}-dir-xinsights-*` (Directus app),
// deleted before and after the file.
import type { Page, Request } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL, DATA_PREFIX, e2eConfig } from './helpers/config.js';
import {
	archiveDirectusNotification,
	chooseInMenu,
	directusApi,
	dirDragBy,
	dirEditPanels,
	dirPanelDrawer,
	dirSaveFlow,
	dirSized,
	dirTile,
	dirTileOfType,
	field,
	goto as gotoDirectus,
	headerButton,
	onDirectusApp,
	openDirectusDashboard,
	openDirectusNotifications,
	readDirectusGrid,
	readDirectusTileHeaders,
	readDirectusTileText,
} from './helpers/directus-app.js';
import { moveAndRelease } from './helpers/flows.js';
import {
	createTempDashboard,
	dashboardId,
	DASHBOARDS,
	deleteTempDashboards,
	readChartTable,
	readGrid,
	tempDashboardName,
	tileOfType,
} from './helpers/insights.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

test.skip(e2eConfig !== 'proxy-api', 'drives the Directus app of the main pair (proxy-api only)');
// Default mode: in order in the one worker, a failed test does not skip the next ones (each sets up its own rows).
test.describe.configure({ mode: 'default' });
test.use({ actionTimeout: 15_000 });
test.setTimeout(240_000);

const SPEC = 'xinsights';
const BO_DASH = tempDashboardName(SPEC, 'bo');
const DIR_DASH = `${DATA_PREFIX}-dir-${SPEC}-dir`;
const NOTIFICATION = 'bo_notification_item';
const GRID = 18;
const TEXT_TYPES = ['metric', 'metric-list', 'list', 'meter', 'label', 'relational-variable'];

let api: AdminApi;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	await cleanup();
});

test.afterAll(async () => {
	await cleanup();
	await resetLastPage(api);
});

async function cleanup() {
	await deleteTempDashboards(api, SPEC);
	await deleteTempDashboards(api, `dir-${SPEC}`);
	const [row] = await api.call<{ id: number; status: string }[]>(
		'GET',
		`/notifications?filter[subject][_eq]=${NOTIFICATION}&fields=id,status&limit=1`,
	);
	if (row && row.status !== 'inbox') await api.call('PATCH', `/notifications/${row.id}`, { data: { status: 'inbox' } });
}

async function signIn(page: Page) {
	await resetLastPage(api);
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
}

/* ------------------------------------------------------------------------------------------- readers */

type Shown = {
	cells: string[];
	headers: string[];
	texts: Record<string, string>;
};

/** `x:y w×h` of every tile, sorted. */
const cellsOf = (grid: { x: number; y: number; w: number; h: number }[]) =>
	grid.map(({ x, y, w, h }) => `${x}:${y} ${w}×${h}`).sort();

async function backofficeShown(page: Page, types: string[]): Promise<Shown> {
	const cells = cellsOf(await readGrid(page));
	const headers = await page.locator('[data-panel-id]').evaluateAll((tiles) =>
		tiles
			.filter((tile) => tile.querySelector('[data-panel-name]'))
			.map(
				(tile) =>
					`${tile.getAttribute('data-pos-x')}:${tile.getAttribute('data-pos-y')} ${tile.querySelector('[data-panel-name]')!.textContent!.trim()}`,
			)
			.sort(),
	);
	const texts: Record<string, string> = {};
	for (const type of types) {
		if (!(await tileOfType(page, type).count())) continue;
		// The visible text without the header, icon ligatures and screen-reader texts (the Directus app has none).
		texts[type] = await tileOfType(page, type).evaluate((tile) => {
			let text = (tile as HTMLElement).innerText;
			for (const el of Array.from(tile.querySelectorAll('[data-panel-header], [data-icon], .sr-only'))) {
				const part = (el as HTMLElement).innerText.trim();
				if (part) text = text.replace(part, '');
			}
			return text.replace(/\s+/g, ' ').trim();
		});
	}
	// The global variable: the value its select shows.
	if (await tileOfType(page, 'variable').count())
		texts['variable'] = await tileOfType(page, 'variable')
			.getByRole('combobox')
			.evaluate((el) => {
				const copy = el.cloneNode(true) as HTMLElement;
				copy.querySelectorAll('[data-icon], .sr-only').forEach((e) => e.remove());
				return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
			});
	return { cells, headers, texts };
}

async function directusShown(page: Page, types: string[]): Promise<Shown> {
	const cells = cellsOf(await readDirectusGrid(page));
	const headers = (await readDirectusTileHeaders(page)).map(({ x, y, name }) => `${x}:${y} ${name}`).sort();
	const texts: Record<string, string> = {};
	for (const type of types)
		if (await dirTileOfType(page, type).count()) texts[type] = await readDirectusTileText(page, type);
	if (await dirTileOfType(page, 'variable').count())
		texts['variable'] = await dirTileOfType(page, 'variable').locator('input').first().inputValue();
	return { cells, headers, texts };
}

/** Waits until the tiles of `types` show their data (no loader) in the Backoffice app. */
async function settledBackoffice(page: Page) {
	await expect(page.locator('[data-panel-id]').first()).toBeVisible({ timeout: 15_000 });
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(800);
}

async function openBackofficeDashboard(page: Page, id: string) {
	await page.goto(`/admin/insights/${id}`);
	await settledBackoffice(page);
}

/* ------------------------------------------------------------------------------------------- (1) */

type Answer = { query: string; data: Record<string, unknown[]> };

/** The aliased queries of the GraphQL documents the Directus app sends while `steps` run, with their answer rows. */
async function directusAnswers(page: Page, steps: () => Promise<void>): Promise<Map<string, unknown[]>> {
	const answers: Promise<Answer | undefined>[] = [];
	const onRequest = (request: Request) => {
		if (request.method() !== 'POST' || !/\/graphql(\/system)?$/.test(new URL(request.url()).pathname)) return;
		const query = (request.postDataJSON() as { query: string }).query;
		answers.push(
			request
				.response()
				.then(async (response) => ({ query, data: ((await response?.json()) as { data: Answer['data'] }).data }))
				.catch(() => undefined),
		);
	};
	page.on('request', onRequest);
	await steps();
	await page.waitForLoadState('networkidle');
	page.off('request', onRequest);
	const out = new Map<string, unknown[]>();
	for (const answer of await Promise.all(answers)) {
		if (!answer) continue;
		// `query_<hash>: <the query>` up to the next alias: the query text keys its rows.
		for (const [, alias, text] of answer.query.matchAll(/(query_[0-9a-f]+): (.*?)(?= query_[0-9a-f]+: | \}$)/g))
			out.set(text!.replace(/\s+/g, ' ').trim(), answer.data[alias!] ?? []);
	}
	return out;
}

/** The rows of the answer whose query matches `pattern`. */
function rowsOf(answers: Map<string, unknown[]>, pattern: RegExp): Record<string, any>[] {
	const hits = [...answers.entries()].filter(([query]) => pattern.test(query));
	expect(hits.length, `one Directus query matches ${pattern}`).toBeGreaterThan(0);
	return hits[0]![1] as Record<string, any>[];
}

test('(1) bo_dash_all and bo_dash_system seeded through Directus REST show the same in the Backoffice app (SC-002)', async ({
	page,
	browser,
}) => {
	const ids = { all: await dashboardId(api, DASHBOARDS.all), system: await dashboardId(api, DASHBOARDS.system) };

	const directus = await onDirectusApp(browser, async (p) => {
		const shown: Record<string, Shown> = {};
		const answers = await directusAnswers(p, () => openDirectusDashboard(p, ids.all));
		await p.waitForTimeout(800);
		shown['all'] = await directusShown(p, TEXT_TYPES);
		await openDirectusDashboard(p, ids.system);
		await p.waitForTimeout(800);
		shown['system'] = await directusShown(p, TEXT_TYPES);
		return { answers, shown };
	});

	await signIn(page);
	await openBackofficeDashboard(page, ids.all);
	const all = await backofficeShown(page, TEXT_TYPES);
	const charts = {
		bar: await readChartTable(page, 'bar-chart'),
		pie: await readChartTable(page, 'pie-chart'),
		line: await readChartTable(page, 'line-chart'),
		series: await readChartTable(page, 'time-series'),
	};
	await openBackofficeDashboard(page, ids.system);
	const system = await backofficeShown(page, TEXT_TYPES);

	expect.soft(all, DASHBOARDS.all).toEqual(directus.shown['all']);
	expect.soft(system, DASHBOARDS.system).toEqual(directus.shown['system']);
	expect(directus.shown['all']!.cells).toHaveLength(11);

	// Charts: the rows of each chart's table are the rows of the Directus app's answer for that panel, in order.
	const bar = rowsOf(directus.answers, /groupBy: \["status"\]\) \{ sum \{ amount \} group \}/);
	expect
		.soft(
			charts.bar.rows.map(([x, y]) => [x, Number(y)]),
			'bar-chart',
		)
		.toEqual(bar.map((row) => [row['group'].status, row['sum'].amount]));
	const pie = rowsOf(directus.answers, /groupBy: \["category"\]\) \{ count \{ category \} group \}/);
	expect
		.soft(
			charts.pie.rows.map(([x, y]) => [x, Number(y)]),
			'pie-chart',
		)
		.toEqual(pie.map((row) => [row['group'].category, row['count'].category]));
	const line = rowsOf(directus.answers, /groupBy: \["category"\]\) \{ sum \{ qty \} group \}/);
	expect
		.soft(
			charts.line.rows.map(([x, y]) => [x, Number(y)]),
			'line-chart',
		)
		.toEqual(line.map((row) => [row['group'].category, row['sum'].qty]));
	const series = rowsOf(directus.answers, /groupBy: \["year\(happened_at\)"/);
	expect
		.soft(
			charts.series.rows.map((row) => Number(row.at(-1))),
			'time-series',
		)
		.toEqual(series.map((row) => row['count'].id));

	// The panel rows: the same through both APIs.
	const panelsPath = `/panels?filter[dashboard][_eq]=${ids.all}&fields=*&sort=id&limit=-1`;
	expect(await api.call('GET', panelsPath)).toEqual(await directusApi('GET', panelsPath));
});

/* ------------------------------------------------------------------------------------------- (2), (3) */

async function boAddPanel(page: Page, type: string, options: [string, string][]) {
	await page.getByRole('link', { name: 'Create Panel' }).click();
	const drawer = page.getByRole('dialog');
	await drawer
		.getByRole('button')
		.filter({ has: page.getByText(type, { exact: true }) })
		.click();
	for (const [key, option] of options) {
		await drawer.locator(`[data-field="${key}"]`).getByRole('combobox').click();
		await page.getByRole('option', { name: option, exact: true }).click();
		await expect(page.getByRole('listbox')).toHaveCount(0);
	}
	await drawer.getByRole('button', { name: 'Done' }).click();
	await expect(drawer).toBeHidden();
}

async function boDrag(page: Page, from: { x: number; y: number }, cells: { dx: number; dy: number }) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await moveAndRelease(page, from, { x: from.x + cells.dx * GRID, y: from.y + cells.dy * GRID });
}

const METRIC_OPTIONS = {
	bo: [
		['collection', 'Bo Insights Data'],
		['field', 'ID'],
		['function', 'Count'],
	] as [string, string][],
	dir: [
		['Collection', 'Bo Insights Data'],
		['Field', 'ID'],
		['Aggregate Function', 'Count'],
	] as [string, string][],
};
const BAR_OPTIONS = {
	bo: [
		['collection', 'Bo Insights Data'],
		['xAxis', 'Status'],
		['yAxis', 'Amount'],
		['function', 'Sum'],
	] as [string, string][],
	dir: [
		['Collection', 'Bo Insights Data'],
		['X-Axis', 'Status'],
		['Y-Axis', 'Amount'],
		['Y-Axis Function', 'Sum'],
	] as [string, string][],
};

test('(2) a dashboard arranged in the Backoffice app opens the same in the Directus app, and back (SC-002)', async ({
	page,
	browser,
}) => {
	const id = await createTempDashboard(api, BO_DASH);
	await signIn(page);
	await page.goto(`/admin/insights/${id}`);
	await expect(page.getByRole('heading', { level: 1, name: BO_DASH })).toBeVisible();
	await page.getByRole('button', { name: 'Edit Panels' }).click();
	await boAddPanel(page, 'Metric', METRIC_OPTIONS.bo);
	await boAddPanel(page, 'Bar Chart', BAR_OPTIONS.bo);

	// Both start at (1,1): the bar chart (on top) goes down first, then the metric right and 8×4 (insights-edit).
	const bar = tileOfType(page, 'bar-chart');
	const barBox = (await bar.boundingBox())!;
	await boDrag(page, { x: barBox.x + barBox.width / 2, y: barBox.y + barBox.height / 2 }, { dx: 0, dy: 10 });
	await expect(bar).toHaveAttribute('data-pos-y', '11');
	const metric = tileOfType(page, 'metric');
	const box = (await metric.boundingBox())!;
	await boDrag(page, { x: box.x + 12, y: box.y + box.height - 6 }, { dx: 12, dy: 0 });
	await expect(metric).toHaveAttribute('data-pos-x', '13');
	await metric.hover();
	const handle = (await metric.locator('[data-resize="bottom-right"]').boundingBox())!;
	await boDrag(page, { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, { dx: 2, dy: 2 });
	await expect(metric).toHaveAttribute('data-width', '8');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('button', { name: 'Edit Panels' })).toBeVisible({ timeout: 30_000 });
	await settledBackoffice(page);
	const made = await backofficeShown(page, TEXT_TYPES);
	expect(made.cells).toEqual(['13:1 8×4', '1:11 12×10']);

	const edited = await onDirectusApp(browser, async (p) => {
		await openDirectusDashboard(p, id);
		await p.waitForTimeout(800);
		const shown = await directusShown(p, TEXT_TYPES);

		await dirEditPanels(p);
		await p.getByRole('banner').getByRole('link', { name: 'add', exact: true }).click();
		const drawer = p.locator('.v-drawer').last();
		await drawer
			.locator('button.interface')
			.filter({ has: p.locator('.name', { hasText: /^Label$/ }) })
			.click();
		await field(drawer, 'Label').locator('textarea').fill('Cross label');
		await dirPanelDrawer(p, null, []);
		const metricHandle = (await dirSized(p, 8, 4).locator('.resize-handlers .right').boundingBox())!;
		await dirDragBy(
			p,
			{ x: metricHandle.x + metricHandle.width / 2, y: metricHandle.y + metricHandle.height / 2 },
			{ dx: 2, dy: 0 },
		);
		await expect(dirSized(p, 10, 4)).toHaveCount(1);
		await dirSaveFlow(p);
		await p.waitForLoadState('networkidle');
		await p.waitForTimeout(800);
		return { shown, after: await directusShown(p, TEXT_TYPES) };
	});
	expect.soft(made, 'Backoffice → Directus app').toEqual(edited.shown);

	await openBackofficeDashboard(page, id);
	const reloaded = await backofficeShown(page, TEXT_TYPES);
	expect(edited.after.cells).toContain('13:1 10×4');
	expect(edited.after.texts['label']).toBe('Cross label');
	expect.soft(reloaded, 'Directus app → Backoffice').toEqual(edited.after);
});

test('(3) a dashboard and two panels made in the Directus app open the same in the Backoffice app (SC-002)', async ({
	page,
	browser,
}) => {
	const shown = await onDirectusApp(browser, async (p) => {
		await gotoDirectus(p, '/insights');
		await headerButton(p, 'add').click();
		await p.locator('.v-card').last().getByPlaceholder('Dashboard Name').fill(DIR_DASH);
		await p.locator('.v-card').last().getByRole('button', { name: 'Save', exact: true }).click();
		await expect(p).toHaveURL(/\/insights\/[0-9a-f-]{36}$/, { timeout: 30_000 });
		await dirEditPanels(p);
		await p.getByRole('banner').getByRole('link', { name: 'add', exact: true }).click();
		await dirPanelDrawer(p, 'Metric', METRIC_OPTIONS.dir);
		await p.getByRole('banner').getByRole('link', { name: 'add', exact: true }).click();
		await dirPanelDrawer(p, 'Bar Chart', BAR_OPTIONS.dir);
		await dirSaveFlow(p);
		await p.waitForLoadState('networkidle');
		await p.waitForTimeout(800);
		return directusShown(p, TEXT_TYPES);
	});

	// The insights store loads at sign-in: a dashboard made elsewhere shows after signing in again.
	await signIn(page);
	await openBackofficeDashboard(page, await dashboardId(api, DIR_DASH));
	expect(shown.cells).toHaveLength(2);
	expect(await backofficeShown(page, TEXT_TYPES)).toEqual(shown);
});

/* ------------------------------------------------------------------------------------------- (4) */

test('(4) a notification archived in the Backoffice app is archived in the Directus app, and back (SC-002)', async ({
	page,
	browser,
}) => {
	const bell = page.locator('button[aria-label^="Notifications, "]');
	const unread = async () => Number((await bell.getAttribute('aria-label'))!.match(/\d+/)![0]);
	const drawer = page.getByRole('dialog', { name: 'Notifications' });

	try {
		await signIn(page);
		await expect(bell).toHaveAttribute('aria-label', /Notifications, [1-9]/);
		const before = await unread();
		await bell.click();
		await drawer.getByRole('checkbox', { name: `Select ${NOTIFICATION}` }).click();
		await drawer.getByRole('button', { name: 'Archive', exact: true }).click();
		await expect(drawer).not.toContainText(NOTIFICATION);
		await expect.poll(unread).toBe(before - 1);

		await onDirectusApp(browser, async (p) => {
			await gotoDirectus(p, '/insights');
			await expect(p.locator('.notifications-badge .badge')).toHaveText(String(before - 1));
			const directusDrawer = await openDirectusNotifications(p);
			await expect(directusDrawer.locator('.notifications .v-list-item', { hasText: NOTIFICATION })).toHaveCount(0);
			await directusDrawer.locator('.v-tab', { hasText: 'Archive' }).click();
			await expect(directusDrawer.locator('.notifications .v-list-item', { hasText: NOTIFICATION })).toHaveCount(1);
			await archiveDirectusNotification(p, NOTIFICATION);
			await expect(p.locator('.notifications-badge .badge')).toHaveText(String(before));
		});

		await page.reload();
		await expect.poll(unread).toBe(before);
		await bell.click();
		await expect(drawer).toContainText(NOTIFICATION);
	} finally {
		await cleanup();
	}
});

/* ------------------------------------------------------------------------------------------- (5) */

test('(5) bo_dash_vars: the same owner and status show the same metric and list in both apps (SC-003)', async ({
	page,
	browser,
}) => {
	const id = await dashboardId(api, DASHBOARDS.vars);
	const STATUSES = ['draft', 'archived'];
	const read = ['metric', 'list'];

	const directus = await onDirectusApp(browser, async (p) => {
		const steps: Record<string, Record<string, string>> = {};
		const texts = async () => {
			await p.waitForLoadState('networkidle');
			await p.waitForTimeout(800);
			return (await directusShown(p, read)).texts;
		};
		await openDirectusDashboard(p, id);
		await dirTile(p, 'Owners').getByRole('button', { name: 'Add Existing' }).click();
		const users = p.locator('.v-drawer').last();
		await users.locator('.table-row', { hasText: ADMIN.email }).click();
		await users.getByRole('button', { name: 'check', exact: true }).click();
		steps['published'] = await texts();
		for (const status of STATUSES) {
			await dirTile(p, 'Status').locator('.v-input').first().click();
			await chooseInMenu(p, status);
			steps[status] = await texts();
		}
		return steps;
	});

	await signIn(page);
	await openBackofficeDashboard(page, id);
	const backoffice: Record<string, Record<string, string>> = {};
	const texts = async () => {
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(800);
		return (await backofficeShown(page, read)).texts;
	};
	await tileOfType(page, 'relational-variable').getByRole('button', { name: 'Add Existing' }).click();
	const drawer = page.getByRole('dialog');
	await drawer.getByRole('button', { name: 'Search', exact: true }).click();
	await drawer.getByRole('searchbox').fill(ADMIN.email);
	await expect(drawer.getByRole('row').filter({ hasText: ADMIN.email })).toHaveCount(1);
	await drawer.getByRole('row').filter({ hasText: ADMIN.email }).getByRole('checkbox').click();
	await drawer.getByRole('button', { name: 'Save' }).click();
	await expect(drawer).toBeHidden();
	backoffice['published'] = await texts();
	for (const status of STATUSES) {
		await tileOfType(page, 'variable').getByRole('combobox').click();
		await page.getByRole('option', { name: status, exact: true }).click();
		backoffice[status] = await texts();
	}

	expect(directus['published']!['metric']).toMatch(/\d/);
	expect(backoffice).toEqual(directus);
});
