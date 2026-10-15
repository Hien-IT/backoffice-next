// Feature 015: the Files module pages of the fixture set (`bo-files` folder tree of apps/web/fixtures/interfaces), opened
// as the admin. Accessible names are the en-US strings of the Directus app.
import { expect, type Locator, type Page } from '@playwright/test';
import type { AdminApi } from './api.js';
import { DATA_PREFIX } from './config.js';
import { moduleBar } from './layout.js';

/** Opens a Files route (`/files`, `/files/folders/<id>`, `/files/<id>`) and waits for the page title. */
export async function openFiles(page: Page, path = '/files'): Promise<void> {
	await page.goto(`/admin${path}`);
	await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
}

/** The folder tree of the sub-menu (below `xl` the navigation is a drawer to open first). */
export async function folderTree(page: Page): Promise<Locator> {
	await moduleBar(page);
	const tree = page.getByRole('tree', { name: 'File Library' });
	await expect(tree).toBeVisible();
	return tree;
}

/** The id of a fixture folder by name. */
export async function folderId(api: AdminApi, name: string): Promise<string> {
	const folders = await api.call<{ id: string }[]>('GET', `/folders?fields=id&filter[name][_eq]=${encodeURIComponent(name)}`);
	if (!folders[0]) throw new Error(`No folder ${name}: seed the fixture set first`);
	return folders[0].id;
}

/** Deletes the folders and files this configuration created (names and titles start with DATA_PREFIX). */
export async function clearCreatedFiles(api: AdminApi): Promise<void> {
	const files = await api.call<{ id: string }[]>(
		'GET',
		`/files?fields=id&limit=-1&filter[_or][0][title][_starts_with]=${DATA_PREFIX}&filter[_or][1][filename_download][_starts_with]=${DATA_PREFIX}`,
	);
	if (files.length) await api.call('DELETE', '/files', { data: files.map((f) => f.id) });

	const folders = await api.call<{ id: string }[]>(
		'GET',
		`/folders?fields=id&limit=-1&filter[name][_starts_with]=${DATA_PREFIX}`,
	);
	if (folders.length) await api.call('DELETE', '/folders', { data: folders.map((f) => f.id) });
}

/** Closes the navigation drawer that folderTree opened below `xl` (it hides the page from assistive technology). */
export async function closeNavigation(page: Page): Promise<void> {
	const drawer = page.getByRole('dialog', { name: 'Navigation' });
	if (!(await drawer.isVisible())) return;
	await page.keyboard.press('Escape');
	await expect(drawer).toBeHidden();
}
