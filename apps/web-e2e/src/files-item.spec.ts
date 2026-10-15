// Feature 015 US2 (T047; US2-4 to US2-8, FR-030 to FR-039): the file page on a file this configuration uploads through
// the API: metadata save (quit, stay, copy), move to a folder, download link, replace, delete, file details, revisions
// and the unsaved-changes dialog. Tagged @core: chromium, firefox and webkit (SC-001).
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, DATA_PREFIX } from './helpers/config.js';
import { openSidebar } from './helpers/content.js';
import { clearCreatedFiles, folderId, openFiles, resetLastPage } from './helpers/files.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

type FileRow = { id: string; title: string; description: string | null; folder: string | null; filesize: number; type: string };

let api: AdminApi;
let file: FileRow;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
});

test.beforeEach(async ({ page }) => {
	await resetLastPage(api);
	await clearCreatedFiles(api);
	file = await api.call<FileRow>('POST', '/files', {
		multipart: {
			title: `${DATA_PREFIX} item`,
			file: { name: `${DATA_PREFIX}-item.txt`, mimeType: 'text/plain', buffer: Buffer.from('file page') },
		},
	});
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).not.toHaveURL(/\/admin\/login/);
});

test.afterEach(async () => {
	await clearCreatedFiles(api);
	await resetLastPage(api);
});

const row = (id: string) => api.call<FileRow>('GET', `/files/${id}?fields=id,title,description,folder,filesize,type`);
const heading = (page: Page) => page.getByRole('main').getByRole('heading', { level: 1 });
const titleInput = (page: Page) => page.getByRole('textbox', { name: 'Title' });
const save = (page: Page) => page.getByRole('button', { name: 'Save', exact: true });

async function saveOption(page: Page, name: string) {
	await page.getByRole('button', { name: 'More Save Options' }).click();
	await page.getByRole('menuitem', { name }).click();
}

test('save and quit, save and stay, save as copy (US2-4, FR-031, FR-032)', { tag: '@core' }, async ({ page }) => {
	await openFiles(page, `/files/${file.id}`);
	await expect(heading(page)).toHaveText(`${DATA_PREFIX} item`);
	// The fields shown in the detail panel stay out of the form (Directus fieldsDenyList).
	await expect(page.getByRole('main').getByText('Filesize', { exact: true })).toHaveCount(0);

	await titleInput(page).fill(`${DATA_PREFIX} stay`);
	await saveOption(page, 'Save and Stay');
	await expect.poll(async () => (await row(file.id)).title).toBe(`${DATA_PREFIX} stay`);
	await expect(page).toHaveURL(new RegExp(`/admin/files/${file.id}$`));
	await expect(heading(page)).toHaveText(`${DATA_PREFIX} stay`);

	await titleInput(page).fill(`${DATA_PREFIX} copy`);
	await saveOption(page, 'Save as Copy');
	await expect(page).not.toHaveURL(new RegExp(`/admin/files/${file.id}$`));
	const copyId = /\/admin\/files\/([^/]+)$/.exec(page.url())![1]!;
	const copy = await row(copyId);
	expect(copy.title).toBe(`${DATA_PREFIX} copy`);
	expect(copy.filesize).toBe(file.filesize);
	// The original is unchanged by the copy.
	expect((await row(file.id)).title).toBe(`${DATA_PREFIX} stay`);

	await page.goto(`/admin/files/${file.id}`);
	await titleInput(page).fill(`${DATA_PREFIX} quit`);
	await save(page).click();
	await expect(page).toHaveURL(/\/admin\/files$/);
	expect((await row(file.id)).title).toBe(`${DATA_PREFIX} quit`);
});

test('move to a folder, download link, file details and revisions (US2-5, US2-6, FR-033 to FR-036)', async ({ page }) => {
	const sub = await folderId(api, 'bo-files-sub');
	await openFiles(page, `/files/${file.id}`);

	await page.getByRole('button', { name: 'Move to Folder' }).click();
	const dialog = page.getByRole('dialog', { name: 'Move to Folder' });
	await dialog.getByRole('button', { name: 'Expand bo-files', exact: true }).click();
	await dialog.locator('[data-tree-row]', { hasText: 'bo-files-sub' }).click();
	await dialog.getByRole('button', { name: 'Move', exact: true }).click();
	await expect(page.getByText('File Moved', { exact: true })).toBeVisible();
	await expect.poll(async () => (await row(file.id)).folder).toBe(sub);
	await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'File Library' })).toHaveAttribute(
		'href',
		`/admin/files/folders/${sub}`,
	);

	await expect(page.getByRole('link', { name: 'Download' })).toHaveAttribute(
		'href',
		new RegExp(`/assets/${file.id}\\?download`),
	);

	await openSidebar(page);
	await page.getByRole('button', { name: 'File Details', exact: true }).click();
	const details = page.locator('#sidebar');
	await expect(details.getByText('Open "bo-files-sub" folder')).toBeVisible();
	await expect(details.getByRole('link', { name: /Open in New Window/ })).toHaveAttribute('target', '_blank');

	await page.getByRole('button', { name: /^Revisions/ }).click();
	await expect(details.getByText(/Updated|Created/).first()).toBeVisible();
});

test('replace the file, then delete it (US2-7, US2-8, FR-037, FR-038)', async ({ page }) => {
	await openFiles(page, `/files/${file.id}`);

	await page.getByRole('button', { name: 'Replace File' }).click();
	const dialog = page.getByRole('dialog', { name: 'Replace File' });
	await dialog
		.locator('input[type="file"]')
		.setInputFiles({ name: `${DATA_PREFIX}-replaced.txt`, mimeType: 'text/plain', buffer: Buffer.from('replaced content') });
	await expect.poll(async () => Number((await row(file.id)).filesize)).toBe('replaced content'.length);

	await page.getByRole('button', { name: 'Delete' }).first().click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(page).toHaveURL(/\/admin\/files$/);
	expect(await api.call<unknown[]>('GET', `/files?filter[id][_eq]=${file.id}`)).toHaveLength(0);
});

test('leaving with edits asks first; Keep Editing stays (FR-039)', async ({ page }) => {
	await openFiles(page, `/files/${file.id}`);
	await titleInput(page).fill(`${DATA_PREFIX} unsaved`);

	await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'File Library' }).click();
	const dialog = page.getByRole('dialog', { name: 'Unsaved Changes' });
	await expect(dialog.getByRole('button').first()).toHaveText('Keep Editing');
	await dialog.getByRole('button', { name: 'Keep Editing' }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/files/${file.id}$`));

	await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'File Library' }).click();
	await page.getByRole('dialog', { name: 'Unsaved Changes' }).getByRole('button', { name: 'Discard Changes' }).click();
	await expect(page).toHaveURL(/\/admin\/files$/);
	expect((await row(file.id)).title).toBe(`${DATA_PREFIX} item`);
});
