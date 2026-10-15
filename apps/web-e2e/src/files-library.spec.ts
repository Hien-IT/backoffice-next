// Feature 015 US1 (T036; US1-1 to US1-6, FR-001 to FR-019): the file library on the fixture set (`bo-files` tree), its
// folder tree in the sub-menu, the special views, the folder cards, folder create / rename / download / delete and the
// empty state. Tagged @core: chromium, firefox and webkit (SC-001).
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, DATA_PREFIX } from './helpers/config.js';
import { clearAdminPresets, openSidebar } from './helpers/content.js';
import { clearCreatedFiles, closeNavigation, folderId, folderTree, openFiles, resetLastPage } from './helpers/files.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
});

test.beforeEach(async ({ page }) => {
	await clearAdminPresets(api, 'directus_files');
	await resetLastPage(api);
	await clearCreatedFiles(api);
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).not.toHaveURL(/\/admin\/login/);
});

test.afterEach(async () => {
	await clearCreatedFiles(api);
	await resetLastPage(api);
});

const title = (page: Page) => page.getByRole('main').getByRole('heading', { level: 1 });
const folderCard = (page: Page, name: string) => page.getByRole('main').getByRole('link', { name, exact: true });

test('folder tree, special views and folder cards (US1-1 to US1-3) @core', async ({ page }) => {
	await openFiles(page);
	await expect(title(page)).toHaveText('File Library');

	const tree = await folderTree(page);
	await expect(tree.getByRole('treeitem', { name: /File Library/ }).first()).toHaveAttribute('aria-selected', 'true');
	await expect(tree.getByRole('link', { name: /bo-files$/ })).toBeVisible();
	await closeNavigation(page);

	// The root folders are cards on the default cards layout (Directus systemDefaults).
	await expect(folderCard(page, 'bo-files')).toBeVisible();

	await folderCard(page, 'bo-files').click();
	const root = await folderId(api, 'bo-files');
	await expect(page).toHaveURL(new RegExp(`/admin/files/folders/${root}$`));
	await expect(title(page)).toHaveText('bo-files');
	await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'File Library' })).toBeVisible();
	await expect(folderCard(page, 'bo-files-sub')).toBeVisible();
	// The current folder's parents open in the tree and its row is selected.
	const opened = await folderTree(page);
	await expect(opened.locator(`[data-key="${root}"]`)).toHaveAttribute('aria-selected', 'true');
	await closeNavigation(page);

	for (const [label, path] of [
		['All Files', '/files/all'],
		['My Files', '/files/mine'],
		['Recent Files', '/files/recent'],
	] as const) {
		await page.goto(`/admin${path}`);
		await expect(title(page)).toHaveText(label);
		await expect(folderCard(page, 'bo-files')).toHaveCount(0);
	}
});

test('create a folder, open it empty, rename it from the tree, delete it (US1-5, US1-6)', async ({ page }) => {
	const root = await folderId(api, 'bo-files');
	await openFiles(page, `/files/folders/${root}`);

	const name = `${DATA_PREFIX} new folder`;
	await page.getByRole('button', { name: 'Create Folder' }).click();
	await page.getByRole('dialog').getByLabel('Folder Name').fill(name);
	await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();

	await expect(title(page)).toHaveText(name);
	await expect(page.getByText('No Files', { exact: true })).toBeVisible();
	const created = (await api.call<{ id: string; parent: string }[]>('GET', `/folders?fields=id,parent&filter[name][_eq]=${encodeURIComponent(name)}`))[0]!;
	expect(created.parent).toBe(root);

	// Rename through the row menu of the tree.
	const tree = await folderTree(page);
	await tree.getByRole('button', { name: `Options for ${name}` }).click();
	await page.getByRole('menuitem', { name: 'Rename Folder' }).click();
	await page.getByRole('dialog').getByLabel('Folder Name').fill(`${name} renamed`);
	await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
	await expect(tree.getByRole('link', { name: new RegExp(`${name} renamed$`) })).toBeVisible();

	// Delete (move the content up), then the library goes to the parent folder.
	await tree.getByRole('button', { name: `Options for ${name} renamed` }).click();
	await page.getByRole('menuitem', { name: 'Delete Folder' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/files/folders/${root}$`));
	expect(await api.call<unknown[]>('GET', `/folders?filter[id][_eq]=${created.id}`)).toHaveLength(0);
});

test('download a folder from its row menu (FR-004)', async ({ page }) => {
	const sub = await folderId(api, 'bo-files-sub');
	await openFiles(page, `/files/folders/${sub}`);

	const tree = await folderTree(page);
	const downloadPromise = page.waitForEvent('download');
	await tree.getByRole('button', { name: 'Options for bo-files-sub' }).click();
	await page.getByRole('menuitem', { name: 'Download Folder' }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toMatch(/\.zip$/);
});

test('select a folder card: only delete stays; the detail panel has layout and export (FR-011, FR-018)', async ({ page }) => {
	await openFiles(page);
	const root = await folderId(api, 'bo-files');
	await page.getByRole('main').getByRole('checkbox', { name: `Select ${root}` }).click({ force: true });

	await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Move to Folder' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Download' })).toHaveCount(0);

	await openSidebar(page);
	await expect(page.getByRole('button', { name: 'Layout Options', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Import / Export', exact: true })).toBeVisible();
});

test('a search without match shows No Results; Clear Filters brings the files back; no horizontal scroll (FR-015)', async ({ page }) => {
	const sub = await folderId(api, 'bo-files-sub');
	await openFiles(page, `/files/folders/${sub}`);

	await page.getByRole('button', { name: 'Search', exact: true }).click();
	await page.getByRole('searchbox', { name: 'Search Items...' }).fill(`${DATA_PREFIX} nothing matches`);
	await expect(page.getByText('No Results', { exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Clear Filters' }).click();
	await expect(page.getByText('No Results', { exact: true })).toHaveCount(0);
	await expect(page.getByRole('searchbox', { name: 'Search Items...' })).toHaveValue('');

	// The page itself never scrolls sideways, at 768 px too (the grid wraps).
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
