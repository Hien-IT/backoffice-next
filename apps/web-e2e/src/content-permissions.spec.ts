// Feature 014 US7 (T083; US7-1, FR-100 to FR-103, CHK091): what bo-viewer and bo-editor see in the Content module of
// the fixture set: the tree lists only readable collections, actions are disabled, forms are read-only, and a vi-VN user
// gets translated counts. Test values of the fixture users from apps/web/fixtures/interfaces/lib.mjs (USERS).
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { Fixtures, type TestUser } from './helpers/fixtures.js';
import { openCollection, openItem } from './helpers/content.js';
import { moduleBar } from './helpers/layout.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

const VIEWER = { email: 'bo-viewer@example.com', password: 'bo-viewer-test-password' };
const EDITOR = { email: 'bo-editor@example.com', password: 'bo-editor-test-password' };

let api: AdminApi;
let fixtures: Fixtures;
let reader: TestUser;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	fixtures = new Fixtures(api);
	reader = await fixtures.user('content-reader', {
		role: await fixtures.role('content reader', { read: ['bo_content'] }),
	});
});

test.afterAll(async () => {
	await fixtures.cleanup();
});

test.beforeEach(async () => {
	await api.call('POST', '/utils/cache/clear');
});

async function signIn(page: Page, user: { email: string; password: string }) {
	await page.goto('/admin/login');
	await login(page, user);
	await expect(page).toHaveURL(/\/admin\/(?!login)/);
}

test('a user reading only bo_content: the tree lists it alone (US7-1, FR-100)', async ({ page }) => {
	await signIn(page, reader);
	await openCollection(page, 'bo_content');
	await moduleBar(page);

	const tree = page.getByRole('tree', { name: 'Collections' });
	await expect(tree.locator('a[href="/admin/content/bo_content"]')).toBeVisible();
	// Collection links only: the global bookmark of the fixture set is listed under bo_content too.
	await expect(tree.locator('a[href^="/admin/content/"]:not([href*="bookmark"])')).toHaveCount(1);
});

test('viewer: create disabled, read-only form, no delete (US7-1, FR-101)', async ({ page }) => {
	await signIn(page, VIEWER);
	// The viewer has no user or role preset: the global preset of the fixture set opens the cards layout.
	await openCollection(page, 'bo_content');
	await expect(page.getByRole('checkbox', { name: /^Select \d+$/ }).first()).toBeVisible();

	await expect(page.getByRole('button', { name: 'Not Allowed' }).first()).toBeDisabled();
	await expect(page.getByRole('link', { name: 'Create Item' })).toHaveCount(0);

	await openItem(page, 'bo_content', 2);
	await expect(page.getByRole('textbox', { name: 'Title' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
});

test('editor: can edit but not delete (US7-1, FR-102)', async ({ page }) => {
	await signIn(page, EDITOR);
	await openItem(page, 'bo_content', 2);

	await expect(page.getByRole('textbox', { name: 'Title' })).toBeEnabled();
	const remove = page.getByRole('button', { name: 'Not Allowed' });
	await expect(remove.first()).toBeDisabled();
});

test('vi-VN user: translated item count (CHK091)', async ({ page }) => {
	const viewer = (
		await api.call<{ id: string }[]>('GET', `/users?filter[email][_eq]=${VIEWER.email}&fields=id,language`)
	)[0]!;
	await api.call('PATCH', `/users/${viewer.id}`, { data: { language: 'vi-VN' } });

	try {
		await signIn(page, VIEWER);
		await openCollection(page, 'bo_content');
		await expect(
			page
				.getByRole('status')
				.filter({ hasText: /bản ghi/ })
				.first(),
		).toBeAttached({ timeout: 10_000 });
	} finally {
		await api.call('PATCH', `/users/${viewer.id}`, { data: { language: null } });
	}
});
