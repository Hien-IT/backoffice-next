// Feature 014: the Content module pages of the fixture set (apps/web/fixtures/interfaces, collections `bo_*`), opened as
// the admin. Accessible names are the en-US strings of the Directus app, so the same steps run against the Directus app
// behind proxy-directus.
import { expect, type Page } from '@playwright/test';
import type { AdminApi } from './api.js';
import { DATA_PREFIX } from './config.js';

/** Opens /admin/content/<collection> and waits for the page title. */
export async function openCollection(page: Page, collection: string): Promise<void> {
	await page.goto(`/admin/content/${collection}`);
	// The first visit of a layout loads its lazy chunk (maplibre, FullCalendar): slower than one assertion timeout.
	await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
}

/** Opens /admin/content/<collection>/<pk> (`+` for a new item) and waits for the loaded form (no busy grid). */
export async function openItem(page: Page, collection: string, pk: string | number): Promise<void> {
	await page.goto(`/admin/content/${collection}/${pk}`);
	await expect(page.getByRole('button', { name: /^(Save|Not Allowed)$/ }).first()).toBeVisible();
	await expect(page.getByRole('main').locator('[aria-busy="true"]')).toHaveCount(0);
}

/** The tabular layout's table, once its rows (or its empty state) show. */
export async function waitForTable(page: Page) {
	const table = page.getByRole('main').getByRole('table');
	await expect(table).toBeVisible();
	await expect(
		table
			.getByRole('row')
			.nth(1)
			.or(page.getByText('No Items', { exact: true }))
			.first(),
	).toBeVisible();
	return table;
}

/** Opens the detail panel when it is closed (below `xl` it is a drawer, closed on load like the Directus app). */
export async function openSidebar(page: Page): Promise<void> {
	const toggle = page.getByRole('button', { name: 'Open sidebar', exact: true });
	if (await toggle.isVisible()) await toggle.click();
	await expect(page.locator('#sidebar')).toBeVisible();
}

/** Picks a layout in the sidebar "Layout Options" (Directus `layout` select). */
export async function chooseLayout(page: Page, name: 'Table' | 'Cards' | 'Calendar' | 'Kanban' | 'Map'): Promise<void> {
	await openSidebar(page);
	const select = page.getByRole('combobox', { name: 'Layout', exact: true });
	if (!(await select.isVisible())) await page.getByRole('button', { name: 'Layout Options', exact: true }).click();
	await select.click();
	await page.getByRole('option', { name, exact: true }).click();
}

/** A bookmark or item title owned by this configuration (CHK019). */
export function e2eName(name: string): string {
	return `${DATA_PREFIX} ${name}`;
}

/**
 * Deletes the admin's preset and bookmarks of `collection`, so each spec starts from the default layout. Global and role
 * presets of the fixture set stay.
 */
export async function clearAdminPresets(api: AdminApi, collection: string): Promise<void> {
	const me = await api.call<{ id: string }>('GET', '/users/me?fields=id');
	const presets = await api.call<{ id: number }[]>(
		'GET',
		`/presets?fields=id&limit=-1&filter[collection][_eq]=${collection}&filter[user][_eq]=${me.id}`,
	);
	if (presets.length) await api.call('DELETE', '/presets', { data: presets.map((p) => p.id) });
}
