// Feature 018 T110 (SC-002, SC-003, SC-005, FR-101, contracts/tests.md §4): the Insights module sends the writes and
// reads of the Directus app 11.17.4. Each scenario runs the same UI steps on the Directus app (8155) and on the Backoffice
// app, records the writes with the GraphQL reads they trigger (helpers/payload.ts `recordWrites`, `normalize`,
// `normalizeInsightsBody`) and compares them: (1) create a dashboard, (2) "+" metric and bar chart, Save, (3) drag and
// resize, Save, (4) Duplicate and Delete, Save, (5) Copy To, Save, (6) edit a dashboard, (7) duplicate a dashboard,
// (8) export (the GET), (9) import, (10) delete a dashboard. After (1)–(7), (9), (10) the rows left in
// directus_dashboards and directus_panels (db-rows.ts `changesSince` with INSIGHTS_TABLES, `scopeChanges`) are compared
// too. Then the GraphQL documents of bo_dash_all and of bo_dash_vars (open, owner [admin], vars_status draft and
// archived) are compared after `normalizeGraphql`. The Directus run names its rows `<prefix>-dir-pi-*`, the Backoffice
// run `<prefix>-bo-pi-*` (RUN_TAG); the rows of the first run are deleted before the second. proxy-api only.
import type { Browser, Page, Request } from '@playwright/test';
import { AdminApi } from '../helpers/api.js';
import { ADMIN, apiUrl, directusUrl, e2eConfig } from '../helpers/config.js';
import { openSidebar } from '../helpers/content.js';
import { changesSince, closeHostDb, INSIGHTS_TABLES, scopeChanges, snapshot } from '../helpers/db-rows.js';
import {
	card,
	chooseInMenu,
	dirDragBy,
	dirEditPanels,
	dirPanelDrawer,
	dirSaveFlow,
	dirSized,
	dirTile,
	dirTileMenu,
	headerButton,
	onDirectusApp,
	openSidebarSection,
	sidebar,
} from '../helpers/directus-app.js';
import { moveAndRelease } from '../helpers/flows.js';
import { createTempDashboard, dashboardId, DASHBOARDS, deleteTempDashboards } from '../helpers/insights.js';
import { resetLastPage } from '../helpers/login.js';
import {
	calls,
	canonicalPath,
	captureFormData,
	normalize,
	normalizeGraphql,
	normalizeInsightsBody,
	recordWrites,
	RUN_TAG,
	signInBackoffice,
	type Write,
} from '../helpers/payload.js';
import { apiPath, expect, test } from '../helpers/requests.js';

test.skip(e2eConfig !== 'proxy-api', 'payload comparison runs in proxy-api only');
test.use({ actionTimeout: 15_000 });
// Default mode: in order in the one worker (playwright.config.ts), a failed test does not skip the next ones.
test.describe.configure({ mode: 'default' });
test.setTimeout(240_000);

type Run = keyof typeof RUN_TAG;
const SPEC = 'pi';
const TAGS = [RUN_TAG.dir, RUN_TAG.bo];
const nameOf = (run: Run, n: string) => `${RUN_TAG[run]}-${SPEC}-${n}`;
const GRID = 18;

let api: AdminApi;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	await cleanup();
});

test.afterAll(async () => {
	await cleanup();
	await resetLastPage(api);
	await closeHostDb();
});

async function cleanup() {
	await deleteTempDashboards(api, `dir-${SPEC}`);
	await deleteTempDashboards(api, `bo-${SPEC}`);
}

/* ------------------------------------------------------------------------------------------- set-up rows */

const METRIC = { collection: 'bo_insights_data', field: 'id', function: 'count' };
const BAR = { collection: 'bo_insights_data', xAxis: 'status', yAxis: 'amount', function: 'sum' };
const panelRow = (type: string, x: number, y: number, w: number, h: number, options: object) => ({
	type,
	position_x: x,
	position_y: y,
	width: w,
	height: h,
	options,
});

/** A dashboard with `panels`; returns [dashboard id, panel ids in the order given]. */
async function dashboardWith(name: string, panels: Record<string, unknown>[] = []): Promise<string[]> {
	const id = await createTempDashboard(api, name);
	const ids = [id];
	for (const panel of panels) {
		ids.push((await api.call<{ id: string }>('POST', '/panels?fields=id', { data: { ...panel, dashboard: id } })).id);
	}
	return ids;
}

/* ------------------------------------------------------------------------------------------- the two runs */

interface Scenario {
	/** Page both runs start from (under /admin); a function of the set-up keys. */
	start: (ids: string[]) => string;
	setup?: (run: Run) => Promise<string[]>;
	/** Compare the rows of INSIGHTS_TABLES. */
	db?: boolean;
	directus: (page: Page, ids: string[]) => Promise<void>;
	backoffice: (page: Page, ids: string[]) => Promise<void>;
}

interface Result {
	bo: Write[];
	dir: Write[];
	boDb: unknown;
	dirDb: unknown;
}

async function run(page: Page, scenario: Scenario, ids: string[], directus: boolean) {
	await captureFormData(page);
	await page.goto(`${directus ? directusUrl : ''}/admin${scenario.start(ids)}`);
	await expect(page.getByRole('main').first()).toBeVisible({ timeout: 15_000 });
	await page.waitForLoadState('networkidle');
	const before = scenario.db ? await snapshot(INSIGHTS_TABLES) : undefined;
	const steps = directus ? scenario.directus : scenario.backoffice;
	const recorded = await recordWrites(page, directus ? directusUrl : apiUrl, () => steps(page, ids));
	const db = before
		? scopeChanges((await changesSince(before, INSIGHTS_TABLES)) as Record<string, unknown>, INSIGHTS_TABLES, TAGS)
		: undefined;
	return { writes: normalizeInsightsBody(normalize(recorded, ids)), db };
}

async function compare(browser: Browser, page: Page, scenario: Scenario): Promise<Result> {
	try {
		await cleanup();
		const dirIds = (await scenario.setup?.('dir')) ?? [];
		const dir = await onDirectusApp(browser, (p) => run(p, scenario, dirIds, true));

		await cleanup();
		const boIds = (await scenario.setup?.('bo')) ?? [];
		await signInBackoffice(page, api);
		const bo = await run(page, scenario, boIds, false);
		return { bo: bo.writes, dir: dir.writes, boDb: bo.db, dirDb: dir.db };
	} finally {
		await cleanup();
	}
}

/** The writes and the rows of both apps are the same; the Directus app sent `expected` (sorted like the writes). */
function same(result: Result, expected: string[]) {
	expect(calls(result.dir)).toEqual(expected);
	expect(calls(result.bo)).toEqual(calls(result.dir));
	expect(result.bo).toEqual(result.dir);
	expect(result.boDb).toEqual(result.dirDb);
	// The scoped rows hold the rows of the run (markers), not an empty diff.
	if (result.dirDb !== undefined) expect(JSON.stringify(result.dirDb)).toContain('<id1>');
}

/* ------------------------------------------------------------------------------------------- app steps */

const dirRowMenu = async (page: Page, name: string, entry: string) => {
	await page.locator('.table-row', { hasText: name }).locator('.ctx-toggle').click();
	await chooseInMenu(page, entry);
};

const boRowMenu = async (page: Page, name: string, entry: string) => {
	await page.getByRole('button', { name: `Options for ${name}`, exact: true }).click();
	await page.getByRole('menuitem', { name: entry }).click();
};

const boTile = (page: Page, type: string) => page.locator(`[data-panel-type="${type}"]`).first();

async function boEdit(page: Page) {
	await page.getByRole('button', { name: 'Edit Panels' }).click();
	await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
}

async function boSave(page: Page) {
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('button', { name: 'Edit Panels' })).toBeVisible({ timeout: 30_000 });
}

async function dirEditMode(page: Page) {
	await expect(page.locator('.v-workspace-tile').first()).toBeVisible({ timeout: 15_000 });
	await dirEditPanels(page);
}

/** "+" in edit mode: picks `type` in the panel drawer, sets `options` (`[field key, option label]`), Done. */
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

async function boPointerDrag(page: Page, from: { x: number; y: number }, cells: { dx: number; dy: number }) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await moveAndRelease(page, from, { x: from.x + cells.dx * GRID, y: from.y + cells.dy * GRID });
}

async function boTileMenu(page: Page, type: string, entry: string) {
	await boTile(page, type)
		.getByRole('button', { name: /^Options for/ })
		.click();
	await page.getByRole('menuitem', { name: entry }).click();
}

/* ------------------------------------------------------------------------------------------- scenarios */

test('(1) create a dashboard in the dialog (#185)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: () => '/insights',
		db: true,
		async directus(p) {
			await headerButton(p, 'add').click();
			await card(p).getByPlaceholder('Dashboard Name').fill(nameOf('dir', 'create'));
			await card(p).getByRole('button', { name: 'Save', exact: true }).click();
			await expect(p).toHaveURL(/\/insights\/[0-9a-f-]{36}$/, { timeout: 30_000 });
		},
		async backoffice(p) {
			await p.getByRole('button', { name: 'Create Dashboard' }).first().click();
			const dialog = p.getByRole('dialog');
			await dialog.getByLabel('Dashboard Name').fill(nameOf('bo', 'create'));
			await dialog.getByRole('button', { name: 'Save' }).click();
			await expect(p).toHaveURL(/\/insights\/[0-9a-f-]{36}$/, { timeout: 30_000 });
		},
	});
	same(result, ['POST /dashboards?{"fields":["id"]}']);
});

test('(2) "+" a metric and a bar chart, Save: one POST /panels (#187, #188)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: ([id]) => `/insights/${id}`,
		setup: (run) => dashboardWith(nameOf(run, 'add')),
		db: true,
		async directus(p) {
			await dirEditPanels(p);
			await p.getByRole('banner').getByRole('link', { name: 'add', exact: true }).click();
			await dirPanelDrawer(p, 'Metric', [
				['Collection', 'Bo Insights Data'],
				['Field', 'ID'],
				['Aggregate Function', 'Count'],
			]);
			await p.getByRole('banner').getByRole('link', { name: 'add', exact: true }).click();
			await dirPanelDrawer(p, 'Bar Chart', [
				['Collection', 'Bo Insights Data'],
				['X-Axis', 'Status'],
				['Y-Axis', 'Amount'],
				['Y-Axis Function', 'Sum'],
			]);
			await dirSaveFlow(p);
		},
		async backoffice(p) {
			await boEdit(p);
			await boAddPanel(p, 'Metric', [
				['collection', 'Bo Insights Data'],
				['field', 'ID'],
				['function', 'Count'],
			]);
			await boAddPanel(p, 'Bar Chart', [
				['collection', 'Bo Insights Data'],
				['xAxis', 'Status'],
				['yAxis', 'Amount'],
				['function', 'Sum'],
			]);
			await boSave(p);
		},
	});
	expect(calls(result.dir).filter((c) => !c.startsWith('POST /graphql'))).toEqual(['POST /panels']);
	same(result, calls(result.dir));
});

test('(3) drag the bar chart to (13,1), resize the metric to 8×4, Save: one PATCH /panels (#188)', async ({
	browser,
	page,
}) => {
	const result = await compare(browser, page, {
		start: ([id]) => `/insights/${id}`,
		setup: (run) =>
			dashboardWith(nameOf(run, 'move'), [
				panelRow('metric', 1, 1, 6, 2, METRIC),
				panelRow('bar-chart', 1, 1, 12, 10, BAR),
			]),
		db: true,
		async directus(p) {
			await dirEditMode(p);
			const bar = (await dirSized(p, 12, 10).boundingBox())!;
			await dirDragBy(p, { x: bar.x + bar.width / 2, y: bar.y + bar.height / 2 }, { dx: 12, dy: 0 });
			await expect(dirSized(p, 12, 10)).toHaveAttribute('style', /--pos-x: 13; --pos-y: 1;/);
			const handle = (await dirSized(p, 6, 2).locator('.resize-handlers .bottom-right').boundingBox())!;
			await dirDragBy(p, { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, { dx: 2, dy: 2 });
			await expect(dirSized(p, 8, 4)).toHaveCount(1);
			await dirSaveFlow(p);
		},
		async backoffice(p) {
			await boEdit(p);
			const bar = boTile(p, 'bar-chart');
			const box = (await bar.boundingBox())!;
			await boPointerDrag(p, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, { dx: 12, dy: 0 });
			await expect(bar).toHaveAttribute('data-pos-x', '13');
			const metric = boTile(p, 'metric');
			await metric.hover();
			const handle = (await metric.locator('[data-resize="bottom-right"]').boundingBox())!;
			await boPointerDrag(p, { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, { dx: 2, dy: 2 });
			await expect(metric).toHaveAttribute('data-width', '8');
			await expect(metric).toHaveAttribute('data-height', '4');
			await boSave(p);
		},
	});
	expect(calls(result.dir).filter((c) => !c.startsWith('POST /graphql'))).toEqual(['PATCH /panels']);
	same(result, calls(result.dir));
});

test('(4) Duplicate the metric, Delete the bar chart, Save (#187, #189)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: ([id]) => `/insights/${id}`,
		setup: (run) =>
			dashboardWith(nameOf(run, 'duplicate'), [
				panelRow('metric', 1, 1, 8, 4, METRIC),
				panelRow('bar-chart', 13, 1, 12, 10, BAR),
			]),
		db: true,
		async directus(p) {
			await dirEditMode(p);
			await dirTileMenu(p, dirSized(p, 8, 4), 'Duplicate');
			await expect(dirSized(p, 8, 4)).toHaveCount(2);
			await dirTileMenu(p, dirSized(p, 12, 10), 'Delete');
			await expect(dirSized(p, 12, 10)).toHaveCount(0);
			await dirSaveFlow(p);
		},
		async backoffice(p) {
			await boEdit(p);
			await boTileMenu(p, 'metric', 'Duplicate');
			await expect(p.locator('[data-panel-type="metric"]')).toHaveCount(2);
			await boTileMenu(p, 'bar-chart', 'Delete');
			await expect(p.locator('[data-panel-type="bar-chart"]')).toHaveCount(0);
			await boSave(p);
		},
	});
	expect(calls(result.dir).filter((c) => !c.startsWith('POST /graphql'))).toEqual(['DELETE /panels', 'POST /panels']);
	same(result, calls(result.dir));
});

test('(5) Copy To another dashboard, Save (#187)', async ({ browser, page }) => {
	const target = (run: Run) => nameOf(run, 'copy-target');
	const result = await compare(browser, page, {
		start: ([id]) => `/insights/${id}`,
		setup: async (run) => [
			...(await dashboardWith(nameOf(run, 'copy'), [panelRow('metric', 1, 1, 8, 4, METRIC)])),
			...(await dashboardWith(target(run))),
		],
		db: true,
		async directus(p) {
			await dirEditMode(p);
			await dirTileMenu(p, dirSized(p, 8, 4), 'Copy To...');
			const dialog = card(p);
			await expect(dialog).toContainText('Copy To...');
			await dialog.locator('.v-select .v-input').click();
			await chooseInMenu(p, target('dir'));
			await dialog.getByRole('button', { name: 'Copy', exact: true }).click();
			await expect(p.locator('.v-card', { hasText: 'Copy To...' })).toHaveCount(0);
			await dirSaveFlow(p);
		},
		async backoffice(p) {
			await boEdit(p);
			await boTileMenu(p, 'metric', 'Copy To');
			const dialog = p.getByRole('dialog');
			await dialog.getByRole('combobox').click();
			await p.getByRole('option', { name: target('bo') }).click();
			await dialog.getByRole('button', { name: 'Copy', exact: true }).click();
			await expect(dialog).toBeHidden();
			await boSave(p);
		},
	});
	expect(calls(result.dir).filter((c) => !c.startsWith('POST /graphql'))).toEqual(['POST /panels']);
	same(result, calls(result.dir));
});

test('(6) edit a dashboard from the row menu (#186)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: () => '/insights',
		setup: (run) => dashboardWith(nameOf(run, 'edit')),
		db: true,
		async directus(p) {
			await dirRowMenu(p, nameOf('dir', 'edit'), 'Edit Dashboard');
			await card(p).getByPlaceholder('Note').fill('edited');
			await card(p).getByRole('button', { name: 'Save', exact: true }).click();
			await expect(p.locator('.v-card', { hasText: 'Edit Dashboard' })).toHaveCount(0);
		},
		async backoffice(p) {
			await boRowMenu(p, nameOf('bo', 'edit'), 'Edit Dashboard');
			const dialog = p.getByRole('dialog');
			await dialog.getByLabel('Note').fill('edited');
			await dialog.getByRole('button', { name: 'Save' }).click();
			await expect(dialog).toBeHidden();
		},
	});
	same(result, ['PATCH /dashboards/<id1>?{"fields":["id"]}']);
});

test('(7) duplicate a dashboard with its panels (#185)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: () => '/insights',
		setup: (run) => dashboardWith(nameOf(run, 'dup'), [panelRow('label', 1, 1, 6, 2, { text: 'x' })]),
		db: true,
		async directus(p) {
			await dirRowMenu(p, nameOf('dir', 'dup'), 'Duplicate Dashboard');
			await expect(p.locator('.table-row', { hasText: `${nameOf('dir', 'dup')} (copy)` })).toHaveCount(1, {
				timeout: 30_000,
			});
		},
		async backoffice(p) {
			await boRowMenu(p, nameOf('bo', 'dup'), 'Duplicate Dashboard');
			await expect(p.getByRole('row').filter({ hasText: `${nameOf('bo', 'dup')} (copy)` })).toHaveCount(1, {
				timeout: 30_000,
			});
		},
	});
	same(result, ['POST /dashboards?{"fields":["id"]}']);
});

test('(8) export a dashboard: the same GET /dashboards?export=json (#191)', async ({ browser, page }) => {
	/** The export GET of `steps`, read on the context (the Directus app opens it in a new tab). */
	const exportGet = async (p: Page, api: string, steps: () => Promise<void>, ids: string[]) => {
		const request = p.context().waitForEvent('request', (r: Request) => r.url().includes('export=json'));
		await steps();
		const url = (await request).url();
		for (const other of p.context().pages()) if (other !== p) await other.close();
		return canonicalPath(`${apiPath(url, api)}${new URL(url).search}`).replaceAll(ids[0]!, '<dashboard>');
	};

	await cleanup();
	let ids = await dashboardWith(nameOf('dir', 'export'), [panelRow('label', 1, 1, 6, 2, { text: 'x' })]);
	const dir = await onDirectusApp(browser, async (p) => {
		await p.goto(`${directusUrl}/admin/insights`);
		await expect(p.locator('.table-row', { hasText: nameOf('dir', 'export') })).toBeVisible({ timeout: 15_000 });
		return exportGet(p, directusUrl, () => dirRowMenu(p, nameOf('dir', 'export'), 'Export Dashboard'), ids);
	});

	await cleanup();
	ids = await dashboardWith(nameOf('bo', 'export'), [panelRow('label', 1, 1, 6, 2, { text: 'x' })]);
	await signInBackoffice(page, api);
	await page.goto('/admin/insights');
	await expect(page.getByRole('row').filter({ hasText: nameOf('bo', 'export') })).toBeVisible({ timeout: 15_000 });
	const bo = await exportGet(page, apiUrl, () => boRowMenu(page, nameOf('bo', 'export'), 'Export Dashboard'), ids);
	await cleanup();

	expect(dir).toContain('"export":"json"');
	expect(bo).toEqual(dir);
});

test('(9) import a dashboard file from the sidebar (#192)', async ({ browser, page }) => {
	const file = (run: Run) => ({
		name: `${nameOf(run, 'import')}.json`,
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify([
				{ name: nameOf(run, 'import'), icon: 'dashboard', panels: [panelRow('label', 1, 1, 6, 2, { text: 'x' })] },
			]),
		),
	});
	const result = await compare(browser, page, {
		start: () => '/insights',
		db: true,
		async directus(p) {
			await openSidebarSection(p, 'Import');
			await sidebar(p).locator('input#import-file').setInputFiles(file('dir'));
			await sidebar(p).getByRole('button', { name: 'Start Import' }).click();
			await expect(p.locator('.table-row', { hasText: nameOf('dir', 'import') })).toHaveCount(1, { timeout: 30_000 });
		},
		async backoffice(p) {
			await openSidebar(p);
			if ((await p.locator('[data-import-file]').count()) === 0)
				await p.getByRole('button', { name: 'Import', exact: true }).click();
			await p.locator('[data-import-file]').setInputFiles(file('bo'));
			await p.getByRole('button', { name: 'Start Import' }).click();
			await expect(p.getByRole('row').filter({ hasText: nameOf('bo', 'import') })).toHaveCount(1, {
				timeout: 30_000,
			});
		},
	});
	same(result, ['POST /utils/import/directus_dashboards']);
});

test('(10) delete a dashboard from the row menu (#185)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: () => '/insights',
		setup: (run) => dashboardWith(nameOf(run, 'delete'), [panelRow('label', 1, 1, 6, 2, { text: 'x' })]),
		db: true,
		async directus(p) {
			await dirRowMenu(p, nameOf('dir', 'delete'), 'Delete Dashboard');
			await card(p).getByRole('button', { name: 'Delete' }).click();
			await expect(p.locator('.table-row', { hasText: nameOf('dir', 'delete') })).toHaveCount(0);
		},
		async backoffice(p) {
			await boRowMenu(p, nameOf('bo', 'delete'), 'Delete Dashboard');
			await p.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
			await expect(p.getByRole('row').filter({ hasText: nameOf('bo', 'delete') })).toHaveCount(0);
		},
	});
	same(result, ['DELETE /dashboards/<id1>']);
});

/* ------------------------------------------------------------------------------------------- GraphQL reads */

/** The GraphQL documents `page` sends to `api` while `steps` run: `<path> <normalizeGraphql(query)>`, sorted. */
async function graphqlReads(page: Page, api: string, steps: () => Promise<void>): Promise<string[]> {
	const seen: string[] = [];
	const onRequest = (request: Request) => {
		const path = apiPath(request.url(), api);
		if (request.method() !== 'POST' || !path || !/^\/graphql(\/system)?$/.test(path)) return;
		seen.push(`${path} ${normalizeGraphql((request.postDataJSON() as { query: string }).query)}`);
	};
	page.on('request', onRequest);
	try {
		await steps();
		await page.waitForTimeout(1_500);
	} finally {
		page.off('request', onRequest);
	}
	return seen.sort();
}

test('bo_dash_all and bo_dash_system: the same GraphQL documents (SC-002, SC-005)', async ({ browser, page }) => {
	const ids = [await dashboardId(api, DASHBOARDS.all), await dashboardId(api, DASHBOARDS.system)];
	const dir = await onDirectusApp(browser, async (p) => {
		const out: string[][] = [];
		for (const id of ids)
			out.push(
				await graphqlReads(p, directusUrl, async () => {
					await p.goto(`${directusUrl}/admin/insights/${id}`);
					await expect(p.locator('.v-workspace-tile').first()).toBeVisible({ timeout: 15_000 });
				}),
			);
		return out;
	});

	await signInBackoffice(page, api);
	const bo: string[][] = [];
	for (const id of ids)
		bo.push(
			await graphqlReads(page, apiUrl, async () => {
				await page.goto(`/admin/insights/${id}`);
				await expect(page.locator('[data-panel-id]').first()).toBeVisible({ timeout: 15_000 });
			}),
		);

	expect(dir[0]!.length).toBeGreaterThan(0);
	expect(bo).toEqual(dir);
});

test('bo_dash_vars: the same GraphQL documents for each variable value (SC-003)', async ({ browser, page }) => {
	const id = await dashboardId(api, DASHBOARDS.vars);
	const dir = await onDirectusApp(browser, async (p) => {
		const steps: Record<string, string[]> = {};
		steps['open'] = await graphqlReads(p, directusUrl, async () => {
			await p.goto(`${directusUrl}/admin/insights/${id}`);
			await expect(dirTile(p, 'Owners')).toBeVisible({ timeout: 15_000 });
		});
		await dirTile(p, 'Owners').getByRole('button', { name: 'Add Existing' }).click();
		const users = p.locator('.v-drawer').last();
		await users.locator('.table-row', { hasText: ADMIN.email }).click();
		steps['owner'] = await graphqlReads(p, directusUrl, () =>
			users.getByRole('button', { name: 'check', exact: true }).click(),
		);
		for (const status of ['draft', 'archived']) {
			steps[status] = await graphqlReads(p, directusUrl, async () => {
				await dirTile(p, 'Status').locator('.v-input').first().click();
				await chooseInMenu(p, status);
			});
		}
		return steps;
	});

	await signInBackoffice(page, api);
	const bo: Record<string, string[]> = {};
	const tile = (type: string) => boTile(page, type);
	bo['open'] = await graphqlReads(page, apiUrl, async () => {
		await page.goto(`/admin/insights/${id}`);
		await expect(tile('relational-variable')).toBeVisible({ timeout: 15_000 });
	});
	await tile('relational-variable').getByRole('button', { name: 'Add Existing' }).click();
	const drawer = page.getByRole('dialog');
	await drawer.getByRole('button', { name: 'Search', exact: true }).click();
	await drawer.getByRole('searchbox').fill(ADMIN.email);
	await expect(drawer.getByRole('row').filter({ hasText: ADMIN.email })).toHaveCount(1);
	await drawer.getByRole('row').filter({ hasText: ADMIN.email }).getByRole('checkbox').click();
	bo['owner'] = await graphqlReads(page, apiUrl, async () => {
		await drawer.getByRole('button', { name: 'Save' }).click();
		await expect(drawer).toBeHidden();
	});
	for (const status of ['draft', 'archived']) {
		bo[status] = await graphqlReads(page, apiUrl, async () => {
			await tile('variable').getByRole('combobox').click();
			await page.getByRole('option', { name: status, exact: true }).click();
		});
	}

	expect(dir['owner']!.length).toBeGreaterThan(0);
	expect(bo).toEqual(dir);
});
