// Spec 020 US6 (T176; FR-086 to FR-088, recipes Q-42, Q-43): Settings > Marketplace on the fake registry of the
// parity env (tests/parity/registry/fixtures). The registry list with search, type filter and sort in the route query;
// an extension page with its metadata and compatibility; Install, then Manage leads to Settings > Extensions; the
// account page of a publisher. MARKETPLACE_TRUST is the default (`sandbox`), so the list shows the sandboxed fixtures.
// Runs in the three configurations.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL } from './helpers/config.js';
import { closeHostDb, hostDb } from './helpers/db-rows.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

test.describe.configure({ mode: 'serial' });

const EXTENSION = 'e0000000-0000-4000-8000-000000000002'; // parity-display-badge
const ACCOUNT = 'a1b2c3d4-0000-4000-8000-000000000001'; // parity-alice

let api: AdminApi;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
});

test.afterAll(async () => {
	await hostDb()('directus_extensions').where({ id: EXTENSION }).delete();
	await closeHostDb();
});

async function open(page: Page, path = '') {
	await resetLastPage(api);
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
	await page.goto(`/admin/settings/marketplace${path}`);
}

const rows = (page: Page) => page.locator('main a[href*="/settings/marketplace/extension/"]');

test('the registry: the sandboxed fixtures, search and type in the route query', async ({ page }) => {
	await open(page);

	await expect(rows(page)).toHaveCount(3);
	await expect(rows(page).first()).toContainText('Parity Interface Color');

	await page.getByRole('searchbox').or(page.getByPlaceholder('Search Extensions...')).first().fill('badge');
	await expect(page).toHaveURL(/search=badge/);
	await expect(rows(page)).toHaveCount(1);
	await expect(rows(page)).toContainText('Parity Display Badge');

	await page.goto('/admin/settings/marketplace?type=bundle');
	await expect(rows(page)).toHaveCount(1);
	await expect(rows(page)).toContainText('Parity Bundle Tools');
});

test('an extension: metadata, compatibility; Install then Manage opens Settings > Extensions', async ({ page }) => {
	await hostDb()('directus_extensions').where({ id: EXTENSION }).delete();
	await open(page, `/extension/${EXTENSION}`);

	await expect(page.getByRole('heading', { name: 'Parity Display Badge' })).toBeVisible();
	await expect(page.getByText('Compatible with your Project')).toBeVisible();

	const installed = page.waitForResponse(
		(response) => response.request().method() === 'POST' && response.url().endsWith('/extensions/registry/install'),
	);
	await page.getByRole('button', { name: 'Install Extension' }).click();
	expect((await installed).status()).toBe(204);
	expect(await hostDb()('directus_extensions').where({ id: EXTENSION }).first('source')).toEqual({
		source: 'registry',
	});

	await page.getByRole('link', { name: 'Manage' }).click();
	await expect(page).toHaveURL(/\/admin\/settings\/extensions$/);
	await expect(page.locator(`[data-extension-id="${EXTENSION}"]`)).toBeVisible();

	await api.call('DELETE', `/extensions/registry/uninstall/${EXTENSION}`);
});

test('an account: the publisher and their extensions', async ({ page }) => {
	await open(page, `/account/${ACCOUNT}`);

	await expect(page.getByText('Alice Parity').first()).toBeVisible();
	await expect(rows(page).filter({ hasText: 'Parity Interface Color' })).toHaveCount(1);
});
