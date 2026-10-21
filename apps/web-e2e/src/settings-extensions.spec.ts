// Spec 020 US5 (T095; FR-083 to FR-085, recipe Q-41): Settings > Extensions on the fixture extensions loaded from the
// shared storage. The list grouped by type with the bundle entries nested; disabling an app extension shows the
// persistent "reload required" notice and the row state, enabling it again restores it; a row whose folder is gone is
// listed under Missing and removed from its menu. Runs in the three configurations.
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { ADMIN, CONTENT_URL } from './helpers/config.js';
import { closeHostDb, hostDb } from './helpers/db-rows.js';
import { AdminApi } from './helpers/api.js';
import { loadedEverywhere } from './helpers/extensions.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

test.describe.configure({ mode: 'serial' });

let api: AdminApi;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
});

test.afterAll(async () => {
	await closeHostDb();
});

async function open(page: Page) {
	// Sign-in lands on last_page, which the previous test left on this screen.
	await resetLastPage(api);
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
	await page.goto('/admin/settings/extensions');
	await expect(page.getByRole('heading', { level: 1, name: 'Extensions' })).toBeVisible();
}

const row = (page: Page, name: string) => page.locator(`[data-extension="${name}"]`);

async function menu(page: Page, name: string, item: string | RegExp) {
	await row(page, name)
		.getByRole('button', { name: /options/i })
		.click();
	await page.getByRole('menuitem', { name: item }).click();
}

test('the list: groups by type, the bundle entries nested, the sub-menu row', async ({ page }) => {
	await open(page);

	// The groups follow the order of the /extensions rows (lodash groupBy, as Directus), which differs between the APIs.
	for (const group of ['Interfaces', 'Displays', 'Layouts', 'Modules', 'Panels', 'Hooks']) {
		await expect(page.locator('main h2', { hasText: group })).toHaveCount(1);
	}
	await expect(row(page, 'parity-interface-color')).toContainText('Enabled');

	const bundle = row(page, 'parity-bundle-tools').locator('xpath=..');
	await expect(bundle.locator('[data-extension]')).toHaveCount(4);

	// The Settings sub-menu is in the sidebar, collapsed below xl (1280 px).
	if ((page.viewportSize()?.width ?? 0) >= 1280) {
		await expect(
			page.getByRole('navigation', { name: 'Settings' }).getByRole('link', { name: 'Extensions' }),
		).toHaveAttribute('aria-current', 'page');
	}
});

test('disable then enable an app extension: the state, the reload notice', async ({ page }) => {
	await open(page);

	await menu(page, 'parity-display-badge', 'Disable');
	await expect(row(page, 'parity-display-badge')).toContainText('Disabled');
	await expect(page.getByRole('button', { name: /Reload Now/i })).toBeVisible();

	await menu(page, 'parity-display-badge', 'Enable');
	await expect(row(page, 'parity-display-badge')).toContainText('Enabled');
});

test('a row whose folder is gone is under Missing; Remove deletes it without a confirmation', async ({ page }) => {
	const id = randomUUID();
	const folder = `e2e-missing-${id.slice(0, 8)}`;
	await hostDb()('directus_extensions').insert({ id, enabled: true, folder, source: 'local', bundle: null });

	try {
		await open(page);
		await expect(page.locator('main h2').last()).toContainText('Missing');
		await expect(row(page, folder)).toBeVisible();

		await menu(page, folder, 'Remove');
		await expect(row(page, folder)).toHaveCount(0);
		expect(await hostDb()('directus_extensions').where({ id })).toEqual([]);
	} finally {
		await hostDb()('directus_extensions').where({ id }).delete();
	}
});

test('a registry extension: Uninstall through the fake registry (T096, #207; Reinstall is on Missing rows only)', async ({
	page,
	request,
}) => {
	// parity-interface-color of tests/parity/registry/fixtures (sandboxed, so MARKETPLACE_TRUST=sandbox downloads it).
	const extension = 'e0000000-0000-4000-8000-000000000001';
	await hostDb()('directus_extensions').where({ id: extension }).delete();
	await api.call('POST', '/extensions/registry/install', {
		data: { extension, version: 'f0000000-0000-4000-8000-000000000001' },
	});
	await loadedEverywhere(request, extension);

	try {
		await open(page);
		const registryRow = page.locator(`[data-extension-id="${extension}"]`);
		await expect(registryRow).toBeVisible();

		await registryRow.getByRole('button', { name: /options/i }).click();
		await page.getByRole('menuitem', { name: 'Uninstall' }).click();
		await expect(registryRow).toHaveCount(0);
		expect(await hostDb()('directus_extensions').where({ id: extension })).toEqual([]);
	} finally {
		await hostDb()('directus_extensions').where({ id: extension }).delete();
	}
});
