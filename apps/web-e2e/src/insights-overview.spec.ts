// Feature 018 US1 (T039; US1-1 to US1-7, FR-010 to FR-015): the dashboards table and the dashboard dialog in the three
// configurations. The table shows the fixture dashboards sorted by name, the search filters by name, a dashboard made in
// the dialog is stored with its values and opens its page, the row menu edits, duplicates (with the panels), exports and
// deletes; several rows are deleted at once. Every dashboard a test creates is named `${DATA_PREFIX}-overview-<n>` and
// deleted after the file.
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { openSidebar } from './helpers/content.js';
import {
	createTempDashboard,
	dashboardRow,
	DASHBOARDS,
	deleteTempDashboards,
	openInsights,
	tempDashboardName,
} from './helpers/insights.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;

test.describe.configure({ mode: 'serial' });

type Dashboard = { id: string; name: string; icon: string; color: string | null; note: string | null };

const dashboardByName = async (name: string) =>
	(await api.call<Dashboard[]>('GET', `/dashboards?filter[name][_eq]=${encodeURIComponent(name)}&fields=*`))[0];

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	await deleteTempDashboards(api, 'overview');
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
});

test.afterAll(async () => {
	await deleteTempDashboards(api, 'overview');
});

async function openOverview(page: Page) {
	await openInsights(page);
	await expect(page.getByRole('heading', { level: 1, name: 'Insights' })).toBeVisible();
}

async function rowMenu(page: Page, name: string, entry: string) {
	await page.getByRole('button', { name: `Options for ${name}`, exact: true }).click();
	await page.getByRole('menuitem', { name: entry }).click();
}

test('the table: the fixture dashboards sorted by name, the search, the sub-menu (US1-1, US1-2)', async ({ page }) => {
	await openOverview(page);

	const names = await page.locator('main tbody tr td:nth-child(3)').allInnerTexts();
	const fixture = names.map((name) => name.trim()).filter((name) => name.startsWith('bo_dash_'));
	expect(fixture).toEqual([...Object.values(DASHBOARDS)].sort());

	await page.getByRole('searchbox').or(page.locator('main input').first()).fill('SYSTEM');
	await expect(page.locator('main tbody tr')).toHaveCount(1);
	await expect(dashboardRow(page, DASHBOARDS.system)).toBeVisible();

	const toggle = page.getByRole('button', { name: 'Open navigation', exact: true });
	if (await toggle.isVisible()) await toggle.click();
	await expect(
		page.getByRole('navigation', { name: 'Insights' }).getByRole('link', { name: DASHBOARDS.all }),
	).toBeVisible();
});

test('create: the dialog stores name, icon, note, then opens the dashboard page (US1-3)', async ({ page }) => {
	await openOverview(page);
	const name = tempDashboardName('overview', 'create');

	await page.getByRole('button', { name: 'Create Dashboard' }).first().click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Dashboard Name').fill(name);
	await dialog.getByLabel('Note').fill('made by the E2E');
	await dialog.getByRole('button', { name: 'Save' }).click();

	await expect.poll(() => dashboardByName(name)).toBeTruthy();
	const stored = await dashboardByName(name);
	expect(stored).toMatchObject({ name, icon: 'space_dashboard', note: 'made by the E2E' });
	await expect(page).toHaveURL(new RegExp(`/admin/insights/${stored!.id}$`));
});

test('row menu: edit, duplicate with the panels, export, delete (US1-4)', async ({ page }) => {
	const name = tempDashboardName('overview', 'menu');
	await createTempDashboard(api, name, [
		{ type: 'label', position_x: 1, position_y: 1, width: 6, height: 2, options: { text: 'x' } },
	]);
	await openOverview(page);

	await rowMenu(page, name, 'Edit Dashboard');
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Note').fill('edited');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();
	await expect.poll(async () => (await dashboardByName(name))?.note).toBe('edited');

	await rowMenu(page, name, 'Duplicate Dashboard');
	await expect(dashboardRow(page, `${name} (copy)`)).toBeVisible();
	const copy = await dashboardByName(`${name} (copy)`);
	const copyPanels = await api.call<unknown[]>('GET', `/panels?filter[dashboard][_eq]=${copy!.id}&fields=id`);
	expect(copyPanels).toHaveLength(1);

	const download = page.waitForEvent('download');
	await rowMenu(page, name, 'Export Dashboard');
	const file = await download;
	const exported = JSON.parse(readFileSync(await file.path(), 'utf8'));
	expect(exported[0]).toMatchObject({ name, note: 'edited' });
	expect(exported[0].panels).toHaveLength(1);

	// Import the exported file back (FR-014): a second dashboard with the same name and its panel.
	await openSidebar(page);
	const importSection = page.getByRole('button', { name: 'Import', exact: true });
	if ((await page.locator('[data-import-file]').count()) === 0) await importSection.click();
	await page.locator('[data-import-file]').setInputFiles({
		name: 'dashboards.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(exported)),
	});
	await page.getByRole('button', { name: 'Start Import' }).click();
	await expect(page.getByText('Data successfully imported from dashboards.json')).toBeVisible();
	await expect
		.poll(
			async () =>
				(await api.call<unknown[]>('GET', `/dashboards?filter[name][_eq]=${encodeURIComponent(name)}&fields=id`))
					.length,
		)
		.toBe(2);
	// Below xl the sidebar is a modal drawer that hides the table from the accessibility tree.
	const close = page.getByRole('button', { name: 'Close sidebar', exact: true });
	if (await close.isVisible()) await close.click();

	await rowMenu(page, `${name} (copy)`, 'Delete Dashboard');
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(dashboardRow(page, `${name} (copy)`)).toHaveCount(0);
	await expect.poll(() => dashboardByName(`${name} (copy)`)).toBeUndefined();
});

test('several rows: batch delete after confirming (US1-5)', async ({ page }) => {
	const names = [tempDashboardName('overview', 'batch-1'), tempDashboardName('overview', 'batch-2')];
	for (const name of names) await createTempDashboard(api, name);
	await openOverview(page);

	for (const name of names) await dashboardRow(page, name).getByRole('checkbox').click();
	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

	for (const name of names) await expect(dashboardRow(page, name)).toHaveCount(0);
	for (const name of names) await expect.poll(() => dashboardByName(name)).toBeUndefined();
});
