// Feature 014 US6 (T079; US6-4 to US6-6, FR-044, FR-095 to FR-099): batch edit, archive and delete on bo_content, the
// Archive section (?archived, ?all) and the Refresh section. Items carry DATA_PREFIX and are deleted afterwards.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, DATA_PREFIX } from './helpers/config.js';
import { openCollection, openSidebar, waitForTable } from './helpers/content.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;
let ids: number[] = [];
let me: string;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	me = (await api.call<{ id: string }>('GET', '/users/me?fields=id')).id;
});

test.beforeEach(async () => {
	ids = [];
	for (const n of [1, 2]) {
		ids.push(
			(
				await api.call<{ id: number }>('POST', '/items/bo_content', {
					data: { title: `${DATA_PREFIX} batch ${n}`, status: 'draft' },
				})
			).id,
		);
	}
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
	await api.call('POST', '/utils/cache/clear');
});

test.afterEach(async ({ page }) => {
	// Close the page first: its preset auto-save (450 ms debounce) must not land after the restore below.
	await page.waitForTimeout(600);
	await page.close();
	const rows = await api.call<{ id: number }[]>(
		'GET',
		`/items/bo_content?fields=id&limit=-1&filter[title][_starts_with]=${encodeURIComponent(DATA_PREFIX)}`,
	);
	if (rows.length) await api.call('DELETE', '/items/bo_content', { data: rows.map((r) => r.id) });
	// The search typed in selectBoth and the refresh interval are saved in the admin preset (FR-011, FR-099): put back
	// the seeded values (search, filter and refresh_interval null, snapshot presets.json), whatever an earlier run left.
	const presets = await api.call<{ id: number }[]>(
		'GET',
		`/presets?fields=id&filter[collection][_eq]=bo_content&filter[user][_eq]=${me}&filter[bookmark][_null]=true`,
	);
	for (const preset of presets)
		await api.call('PATCH', `/presets/${preset.id}`, { data: { search: null, filter: null, refresh_interval: null } });
	await api.call('POST', '/utils/cache/clear');
});

async function signIn(page: Page) {
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(/\/admin\/(?!login)/);
}

/** The table filtered to this test's two rows, both selected. */
async function selectBoth(page: Page) {
	await page.getByRole('searchbox', { name: 'Search Items...' }).fill(`${DATA_PREFIX} batch`);
	const table = page.getByRole('main').getByRole('table');
	await expect(table.locator('tbody tr')).toHaveCount(2);
	const boxes = table.getByRole('checkbox', { name: 'Select Item' });
	await boxes.nth(0).check();
	await boxes.nth(1).check();
}

test('batch edit: PATCH with the keys and the edited field (US6-4, FR-096)', async ({ page }) => {
	await signIn(page);
	await openCollection(page, 'bo_content');
	await waitForTable(page);
	await selectBoth(page);

	await page.getByRole('main').getByRole('button', { name: 'Edit', exact: true }).click();
	const drawer = page.getByRole('dialog', { name: /Batch Editing 2 Items/ });
	const status = drawer.locator('[data-field="status"]');
	await status.getByRole('checkbox').first().click();
	await status.getByRole('combobox').click();
	await page.getByRole('option', { name: 'Published' }).click();

	const patched = page.waitForRequest((r) => r.method() === 'PATCH' && /\/items\/bo_content$/.test(r.url()));
	await drawer.getByRole('button', { name: 'Save' }).click();
	const body = (await patched).postDataJSON();
	expect([...body.keys].sort()).toEqual([...ids].sort());
	expect(body.data).toEqual({ status: 'published' });
});

test('batch archive, then the Archive section shows them (US6-5, FR-044, FR-097)', async ({ page }) => {
	await signIn(page);
	await openCollection(page, 'bo_content');
	await waitForTable(page);
	await selectBoth(page);

	await page.getByRole('main').getByRole('button', { name: 'Archive', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
	const patched = page.waitForRequest((r) => r.method() === 'PATCH' && /\/items\/bo_content$/.test(r.url()));
	await dialog.getByRole('button', { name: 'Archive' }).click();
	expect((await patched).postDataJSON().data).toEqual({ status: 'archived' });
	await expect(page.getByRole('main').getByRole('table').locator('tbody tr')).toHaveCount(0);

	await page.goto(`/admin/content/bo_content?archived`);
	await page.getByRole('searchbox', { name: 'Search Items...' }).fill(`${DATA_PREFIX} batch`);
	await expect(page.getByRole('main').getByRole('table').locator('tbody tr')).toHaveCount(2);
});

test('batch delete with confirmation (US6-6, FR-095)', async ({ page }) => {
	await signIn(page);
	await openCollection(page, 'bo_content');
	await waitForTable(page);
	await selectBoth(page);

	await page.getByRole('main').getByRole('button', { name: 'Delete', exact: true }).click();
	const deleted = page.waitForRequest((r) => r.method() === 'DELETE' && /\/items\/bo_content$/.test(r.url()));
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	expect([...(await deleted).postDataJSON()].sort()).toEqual([...ids].sort());
	await expect(page.getByRole('main').getByRole('table').locator('tbody tr')).toHaveCount(0);
});

test('auto refresh asks the items again with the detail popover closed and dots the toggle (US6-6, FR-099, D-199)', async ({
	page,
}) => {
	await signIn(page);
	await openCollection(page, 'bo_content');
	await waitForTable(page);
	await openSidebar(page);
	await page.getByRole('button', { name: 'Auto Refresh', exact: true }).click();
	await page.getByRole('combobox', { name: 'Refresh Interval' }).click();
	await page.getByRole('option', { name: 'Every 10 Seconds' }).click();
	// The timer belongs to the page (2026-10-28): it keeps running once the popover is closed.
	await page.keyboard.press('Escape');
	await expect(page.getByRole('combobox', { name: 'Refresh Interval' })).toHaveCount(0);
	// D-199: the toggle shows a dot while the page auto refreshes; the name stays, the dot is its description.
	const toggle = page.getByRole('button', { name: 'Open sidebar', exact: true });
	await expect(toggle.locator('[data-auto-refresh-dot]')).toBeVisible();
	await expect(toggle).toHaveAccessibleDescription('Auto Refresh');

	const again = await page.waitForRequest(
		(request) => request.method() === 'GET' && /\/items\/bo_content$/.test(new URL(request.url()).pathname),
		{ timeout: 15_000 },
	);
	expect(again).toBeTruthy();
});
