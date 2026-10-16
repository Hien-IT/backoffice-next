// Feature 015 US6 (T092; US6-1 to US6-3, FR-100 to FR-103): the reused 014 parts on the two system collections and the
// permissions. bo-viewer (read only) sees the create, invite, delete, move, replace and save controls off or absent in
// both modules (the exact match with the Directus app is files-users-parity-ui.spec.ts); a vi-VN user reads the user
// page in Vietnamese; the directory searches, exports and imports CSV like the Content module.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, DATA_PREFIX } from './helpers/config.js';
import { openSidebar } from './helpers/content.js';
import { closeHostDb } from './helpers/db-rows.js';
import { Fixtures, type TestUser } from './helpers/fixtures.js';
import { openFiles } from './helpers/files.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';
import { clearCreatedUsers, openUsers, userEmail } from './helpers/users.js';

// Test values of the fixture users, from apps/web/fixtures/interfaces/lib.mjs (USERS).
const VIEWER = { email: 'bo-viewer@example.com', password: 'bo-viewer-test-password' };

let api: AdminApi;
let fixtures: Fixtures;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	fixtures = new Fixtures(api);
});

test.afterEach(async () => {
	await clearCreatedUsers(api);
	await resetLastPage(api);
});

test.afterAll(async () => {
	await fixtures.cleanup();
	await closeHostDb();
});

async function signIn(page: Page, user: { email: string; password: string }, id?: string) {
	if (id) await api.call('PATCH', `/users/${id}`, { data: { last_page: null } });
	await resetLastPage(api);
	await page.goto('/admin/login');
	await login(page, user);
	await expect(page).not.toHaveURL(/\/admin\/login/);
}

const one = async (path: string) => (await api.call<{ id: string }[]>('GET', path))[0]!.id;

test('bo-viewer: create, upload, invite, delete, move, replace and save are off or absent (US6-3) @core', async ({ page }) => {
	await signIn(page, VIEWER, await one(`/users?fields=id&filter[email][_eq]=${VIEWER.email}`));

	await openFiles(page);
	// Create folder and upload: disabled and named "Not Allowed" (Directus tooltip).
	const notAllowed = page.getByRole('button', { name: 'Not Allowed' });
	await expect(notAllowed).toHaveCount(2);
	for (const button of await notAllowed.all()) await expect(button).toBeDisabled();

	await openFiles(page, `/files/${await one('/files?fields=id&filter[title][_eq]=bo-edit')}`);
	await expect(page.getByRole('button', { name: 'Replace File' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
	for (const button of await page.getByRole('button', { name: 'Not Allowed' }).all()) await expect(button).toBeDisabled();

	await openUsers(page);
	await expect(page.getByRole('button', { name: 'Invite Users' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Not Allowed' }).first()).toBeDisabled();
});

test('a vi-VN user reads the user page in Vietnamese (US6, FR-102)', async ({ page }) => {
	const role = await fixtures.role('vi', { updateSelf: ['*'] });
	const user: TestUser = await fixtures.user('vi', { role, language: 'vi-VN', first_name: 'Vy' });
	await signIn(page, user, user.id);

	await page.goto(`/admin/users/${user.id}`);
	await expect(page.locator('html')).toHaveAttribute('lang', 'vi-VN');
	await expect(page.getByLabel('Họ', { exact: true })).toBeVisible();
});

test('directory: search, export the page as CSV, import a CSV of users (US6-1, US6-2)', async ({ page }) => {
	await signIn(page, ADMIN);
	await openUsers(page, '/users/all');

	await page.getByRole('button', { name: 'Search', exact: true }).click();
	await page.getByRole('searchbox', { name: 'Search Items...' }).fill('bo-active');
	await expect(page.getByRole('main').getByRole('table').locator('tbody tr')).toHaveCount(1);

	await openSidebar(page);
	await page.getByRole('button', { name: /^Import \/ Export/ }).click();
	// As the Directus app: the users list gives no page download handler, so "Download Page as CSV" is off.
	await expect(page.getByRole('button', { name: 'Download Page as CSV' })).toBeDisabled();
	await page.getByRole('button', { name: 'Export Items' }).click();
	const exportDialog = page.getByRole('dialog', { name: 'Export Items' });
	const exported = page.waitForRequest((r) => r.url().includes('/users?') && r.url().includes('export=csv'));
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		exportDialog.getByRole('button', { name: 'Download File' }).click(),
	]);
	await exported;
	expect(download.suggestedFilename()).toMatch(/\.csv$/);
	if (await exportDialog.isVisible()) await page.keyboard.press('Escape');
	await expect(exportDialog).toBeHidden();

	const csv = ['email,status', userEmail('import-1') + ',active', userEmail('import-2') + ',active'].join('\n');
	await page
		.locator('input#import-file')
		.setInputFiles({ name: `${DATA_PREFIX}.csv`, mimeType: 'text/csv', buffer: Buffer.from(csv) });
	const imported = page.waitForResponse(
		(r) => r.request().method() === 'POST' && r.url().includes('/utils/import/directus_users'),
	);
	await page.getByRole('button', { name: 'Start Import' }).click();
	expect((await imported).ok()).toBe(true);

	const rows = await api.call<unknown[]>(
		'GET',
		`/users?fields=id&filter[email][_starts_with]=${encodeURIComponent(`${DATA_PREFIX}-import`)}`,
	);
	expect(rows).toHaveLength(2);
});
