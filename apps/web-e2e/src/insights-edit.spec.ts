// Feature 018 US3 (T069; US3-1 to US3-6, FR-024 to FR-032): editing a temporary dashboard. "+" adds a metric and a bar
// chart through the panel drawer, the metric is dragged to (13,1) and resized to 8×4, Save sends one POST /panels with
// both (recordWrites); then Duplicate, Copy To a second temporary dashboard and Delete are staged and saved together;
// Clear Changes asks first; the unsaved changes guard; Ctrl/Cmd+S saves outside edit mode. Drag and resize follow the 017
// lessons (small pointer steps, two animation frames before release). Core spec: every browser at 1280 too.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { apiUrl } from './helpers/config.js';
import { moveAndRelease } from './helpers/flows.js';
import { createTempDashboard, deleteTempDashboards, openInsights, tempDashboardName } from './helpers/insights.js';
import { recordWrites } from './helpers/payload.js';
import { expect, test } from './helpers/requests.js';

const GRID = 18;

let api: AdminApi;
let mainId: string;
let targetId: string;

type PanelRow = {
	id: string;
	dashboard: string;
	type: string;
	position_x: number;
	position_y: number;
	width: number;
	height: number;
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	await deleteTempDashboards(api, 'edit');
	mainId = await createTempDashboard(api, tempDashboardName('edit', 'main'));
	targetId = await createTempDashboard(api, tempDashboardName('edit', 'target'));
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
});

test.afterAll(async () => {
	await deleteTempDashboards(api, 'edit');
});

const panelsOf = (dashboard: string) =>
	api.call<PanelRow[]>('GET', `/panels?filter[dashboard][_eq]=${dashboard}&fields=*&sort=position_y,position_x`);

const tiles = (page: Page) => page.locator('[data-panel-id]');
const tileOf = (page: Page, type: string) => page.locator(`[data-panel-type="${type}"]`).first();

async function openMain(page: Page) {
	await openInsights(page, `/${mainId}`);
	await expect(page.getByRole('heading', { level: 1, name: tempDashboardName('edit', 'main') })).toBeVisible();
}

async function addPanel(page: Page, typeName: string) {
	await page.getByRole('link', { name: 'Create Panel' }).click();
	const drawer = page.getByRole('dialog');
	await drawer.getByRole('button', { name: typeName, exact: false }).first().click();
	await drawer.getByRole('button', { name: 'Done' }).click();
	await expect(drawer).toBeHidden();
}

async function pointerDrag(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	// The tile reads pointermove through a 20 ms throttle and drops the pending call on release, as Directus: moves that
	// reach a busy browser in one burst (webkit on CI) moved the tile one cell. The last position is sent again once the
	// throttle is idle, so it is read before the release.
	const to = { x: from.x + dx, y: from.y + dy };
	for (let i = 1; i <= 10; i++) {
		await page.mouse.move(from.x + (dx * i) / 10, from.y + (dy * i) / 10);
		await page.waitForTimeout(40);
	}
	await page.waitForTimeout(100);
	await page.mouse.move(to.x + 1, to.y);
	await moveAndRelease(page, { x: to.x + 1, y: to.y }, to);
}

test('add a metric and a bar chart, drag and resize, Save sends one POST /panels (US3-1 to US3-5)', async ({
	page,
}) => {
	await openMain(page);
	await page.getByRole('button', { name: 'Edit Panels' }).click();

	await addPanel(page, 'Metric');
	await addPanel(page, 'Bar Chart');
	await expect(tiles(page)).toHaveCount(2);

	// Both start at (1,1): the later one is on top, so move the bar chart away first by its body. The small metric (2 rows)
	// is held on its header icon, away from its edit and menu buttons and from the bottom resize handle (webkit hit it).
	const bar = tileOf(page, 'bar-chart');
	const barBox = (await bar.boundingBox())!;
	await pointerDrag(page, { x: barBox.x + barBox.width / 2, y: barBox.y + barBox.height / 2 }, 0, 10 * GRID);
	await expect(bar).toHaveAttribute('data-pos-y', '11');

	const metric = tileOf(page, 'metric');
	const box = (await metric.boundingBox())!;
	await pointerDrag(page, { x: box.x + 12, y: box.y + 10 }, 12 * GRID, 0);
	await expect(metric).toHaveAttribute('data-pos-x', '13');

	await metric.hover();
	const handle = metric.locator('[data-resize="bottom-right"]');
	const handleBox = (await handle.boundingBox())!;
	await pointerDrag(
		page,
		{ x: handleBox.x + handleBox.width / 2, y: handleBox.y + handleBox.height / 2 },
		2 * GRID,
		2 * GRID,
	);
	await expect(metric).toHaveAttribute('data-width', '8');
	await expect(metric).toHaveAttribute('data-height', '4');

	const recorded = await recordWrites(page, apiUrl, async () => {
		await page.getByRole('button', { name: 'Save' }).click();
		await expect(page.getByRole('button', { name: 'Edit Panels' })).toBeVisible();
	});
	const posts = recorded.writes.filter((write) => write.method === 'POST' && write.path.startsWith('/panels'));
	expect(posts).toHaveLength(1);
	expect(recorded.writes.filter((write) => write.path.startsWith('/panels'))).toHaveLength(1);

	const rows = await panelsOf(mainId);
	expect(
		rows.map(({ type, position_x, position_y, width, height }) => ({ type, position_x, position_y, width, height })),
	).toEqual([
		{ type: 'metric', position_x: 13, position_y: 1, width: 8, height: 4 },
		{ type: 'bar-chart', position_x: 1, position_y: 11, width: 12, height: 10 },
	]);
});

test('Duplicate, Copy To and Delete are staged, then saved together (US3-3, US3-4)', async ({ page }) => {
	await openMain(page);
	await page.getByRole('button', { name: 'Edit Panels' }).click();

	const menu = (type: string) => tileOf(page, type).getByRole('button', { name: /^Options for/ });

	await menu('metric').click();
	await page.getByRole('menuitem', { name: 'Duplicate' }).click();
	await expect(page.locator('[data-panel-type="metric"]')).toHaveCount(2);

	await menu('bar-chart').click();
	await page.getByRole('menuitem', { name: 'Copy To' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('combobox').click();
	await page.getByRole('option', { name: tempDashboardName('edit', 'target') }).click();
	await dialog.getByRole('button', { name: 'Copy', exact: true }).click();
	await expect(dialog).toBeHidden();

	await menu('bar-chart').click();
	await page.getByRole('menuitem', { name: 'Delete' }).click();
	await expect(page.locator('[data-panel-type="bar-chart"]')).toHaveCount(0);

	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('button', { name: 'Edit Panels' })).toBeVisible();

	await expect.poll(async () => (await panelsOf(mainId)).map((row) => row.type)).toEqual(['metric', 'metric']);
	const duplicate = (await panelsOf(mainId))[1]!;
	expect(duplicate).toMatchObject({ position_x: 15, position_y: 3, width: 8, height: 4 });
	expect((await panelsOf(targetId)).map((row) => row.type)).toEqual(['bar-chart']);
});

test('Clear Changes asks first; the guard holds a navigation with edits; Ctrl/Cmd+S saves (US3-6)', async ({
	page,
}) => {
	await openMain(page);
	await page.getByRole('button', { name: 'Edit Panels' }).click();
	await addPanel(page, 'Label');
	await expect(tiles(page)).toHaveCount(3);

	await page.getByRole('button', { name: 'Clear Changes' }).click();
	const confirm = page.getByRole('dialog');
	await confirm.getByRole('button', { name: 'Discard Changes' }).click();
	await expect(tiles(page)).toHaveCount(2);
	await expect(page.getByRole('button', { name: 'Edit Panels' })).toBeVisible();

	await page.getByRole('button', { name: 'Edit Panels' }).click();
	await addPanel(page, 'Label');
	// Below xl the sub-menu is in the navigation drawer.
	const openNavigation = page.getByRole('button', { name: 'Open navigation' });
	const drawer = await openNavigation.isVisible();
	if (drawer) await openNavigation.click();
	await page
		.getByRole('navigation')
		.getByRole('link', { name: tempDashboardName('edit', 'target') })
		.click();
	await expect(page.getByRole('dialog')).toContainText('Unsaved Changes');
	await page.getByRole('dialog').getByRole('button', { name: 'Keep Editing' }).click();
	await expect(page).toHaveURL(new RegExp(mainId));
	if (drawer) await page.keyboard.press('Escape');

	await page.keyboard.press('ControlOrMeta+s');
	await expect(page.getByRole('button', { name: 'Edit Panels' })).toBeVisible();
	await expect.poll(async () => (await panelsOf(mainId)).length).toBe(3);
});
