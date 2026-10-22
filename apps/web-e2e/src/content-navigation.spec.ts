// Feature 014 US1 (T027; US1-1, US1-2, FR-001 to FR-005, FR-004b, FR-009): the collection tree of the Content module
// on the fixture set bo_* (apps/web/fixtures/interfaces), redirects of /content and of system collections.
// Not tagged @core: chromium only (SC-001).
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL, DATA_PREFIX } from './helpers/config.js';
import { openCollection } from './helpers/content.js';
import { moduleNavigation } from './helpers/layout.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;
// Folders (no schema) added so the tree has more than 20 collections and shows its search input (Directus rule).
const FOLDERS = Array.from({ length: 9 }, (_, i) => `${DATA_PREFIX.replaceAll('-', '_')}_folder_${i}`);

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
});

test.beforeEach(async () => {
	// Sign-in lands on last_page when set (012 FR-018): start from /content.
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
	// The parity APIs cache /users/me (CACHE_ENABLED): drop it so the sign-in reads the reset last_page.
	await api.call('POST', '/utils/cache/clear');
});

async function signIn(page: Page) {
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
}

const tree = (page: Page) => page.getByRole('tree', { name: 'Collections' });

/** Opens collection in the Content module; below `xl` the navigation (with the tree) is a drawer to open first. */
async function openTree(page: Page, collection: string) {
	await openCollection(page, collection);
	await moduleNavigation(page);
	await expect(tree(page)).toBeVisible();
}
const link = (page: Page, collection: string) => tree(page).locator(`a[href="/admin/content/${collection}"]`);

test('folders, locked groups and hidden collections (US1-1, FR-004)', async ({ page }) => {
	await signIn(page);
	await openTree(page, 'bo_std');

	// bo_folder is a locked folder: no toggle, its child bo_content always listed.
	await expect(tree(page).getByText('Bo Folder', { exact: true })).toBeVisible();
	await expect(tree(page).getByRole('button', { name: /^(Expand|Collapse) Bo Folder$/ })).toHaveCount(0);
	await expect(link(page, 'bo_content')).toBeVisible();
	await expect(link(page, 'bo_std')).toHaveAttribute('aria-current', 'page');

	// Hidden collections (the junction tables) only with the toggle on.
	await expect(link(page, 'bo_junction_files')).toHaveCount(0);
	const toggle = page.getByRole('button', { name: 'Show Hidden Collections' });
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await expect(link(page, 'bo_junction_files')).toBeVisible();
	await toggle.click();
	await expect(link(page, 'bo_junction_files')).toHaveCount(0);
});

test.describe('with more than 20 collections', () => {
	test.beforeAll(async () => {
		for (const collection of FOLDERS) {
			await api.call('POST', '/collections', { data: { collection, meta: { icon: 'folder' }, schema: null } });
		}
	});

	test.afterAll(async () => {
		for (const collection of FOLDERS) await api.call('DELETE', `/collections/${collection}`).catch(() => undefined);
	});

	test('search filters from 3 characters (FR-005)', async ({ page }) => {
		await signIn(page);
		await openTree(page, 'bo_std');

		const search = page.getByRole('searchbox', { name: 'Search Collection' });
		await search.fill('bo_');
		await expect(link(page, 'bo_rel')).toBeVisible();
		// Folder names show title-cased ("Web E2e … Folder 0").
		const folder = tree(page).getByText(/folder 0$/i);
		await expect(folder).toHaveCount(0);

		await search.fill('bo');
		await expect(folder).toBeVisible();

		await search.fill('no-such-collection');
		await expect(page.getByRole('status').filter({ hasText: 'No Results' })).toBeAttached();
		await expect(tree(page).getByRole('treeitem')).toHaveCount(0);
	});
});

test('/content opens the last accessed collection (US1-2, FR-002)', async ({ page }) => {
	await signIn(page);
	await openCollection(page, 'bo_rel');
	await page.goto('/admin/content');
	await expect(page).toHaveURL(/\/admin\/content\/bo_rel$/);
});

test('system collections go to their module or are not found (FR-009)', async ({ page }) => {
	await signIn(page);
	await page.goto('/admin/content/directus_users');
	await expect(page).toHaveURL(/\/admin\/users$/);

	await page.goto('/admin/content/directus_revisions');
	await expect(page.getByRole('heading', { level: 1, name: 'Page Not Found' })).toBeVisible();
});

test('keyboard: arrows move between rows, Enter opens (FR-004b)', async ({ page }) => {
	await signIn(page);
	await openTree(page, 'bo_std');

	await link(page, 'bo_std').focus();
	await page.keyboard.press('Home');
	const first = await page.evaluate(() => document.activeElement?.getAttribute('href'));
	await page.keyboard.press('ArrowDown');
	const second = await page.evaluate(() => document.activeElement?.getAttribute('href'));
	expect(second).not.toBe(first);

	// Enter on a collection row opens it (folder rows toggle instead).
	await link(page, 'bo_rel').focus();
	await page.keyboard.press('ArrowDown');
	const next = await page.evaluate(() => document.activeElement?.getAttribute('href'));
	expect(next).toMatch(/^\/admin\/content\/bo_/);
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(new RegExp(`${next}$`));
});
