// Feature 015 US2 (T047; US2-1 to US2-3, FR-020 to FR-029): the add-file dialog of the `+` route (three files, import
// from URL) and the window drop zone of the library (notice, progress, reload). The URL import is fetched by the API, so
// it reads the `files-fixtures` service of the parity environment (feature 007) instead of a browser stub.
import { AdminApi } from './helpers/api.js';
import { ADMIN, DATA_PREFIX } from './helpers/config.js';
import { clearAdminPresets } from './helpers/content.js';
import { clearCreatedFiles, folderId, openFiles, resetLastPage } from './helpers/files.js';
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

const text = (name: string) => ({ name: `${DATA_PREFIX}-${name}.txt`, mimeType: 'text/plain', buffer: Buffer.from(name) });

async function filesIn(folder: string) {
	return api.call<{ filename_download: string; title: string }[]>(
		'GET',
		`/files?fields=filename_download,title&sort=filename_download&filter[folder][_eq]=${folder}&filter[filename_download][_starts_with]=${DATA_PREFIX}`,
	);
}

test('the + dialog uploads three files into the current folder and closes to it (US2-1)', async ({ page }) => {
	const sub = await folderId(api, 'bo-files-sub');
	await openFiles(page, `/files/folders/${sub}`);

	await page.getByRole('link', { name: 'Upload File' }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/files/folders/${sub}/\\+$`));
	const dialog = page.getByRole('dialog', { name: 'Add File' });
	await dialog.locator('input[type="file"]').setInputFiles([text('a'), text('b'), text('c')]);

	await expect.poll(async () => (await filesIn(sub)).map((f) => f.filename_download)).toEqual([
		`${DATA_PREFIX}-a.txt`,
		`${DATA_PREFIX}-b.txt`,
		`${DATA_PREFIX}-c.txt`,
	]);

	// Like Directus (`@input="close"`), the dialog closes once the upload is done and the library reloads.
	await expect(page).toHaveURL(new RegExp(`/admin/files/folders/${sub}$`));
	for (const { title } of await filesIn(sub)) await expect(page.getByRole('main').getByText(title, { exact: true })).toBeVisible();
});

test('the + route opened by URL imports a file from a URL (US2-2)', async ({ page }) => {
	// A folder of this configuration: the imported file keeps its name `photo.jpg`, so it is found and deleted by folder.
	const { id: folder } = await api.call<{ id: string }>('POST', '/folders', { data: { name: `${DATA_PREFIX} import` } });
	const imported = () =>
		api.call<{ id: string }[]>('GET', `/files?fields=id&filter[folder][_eq]=${folder}&filter[filename_download][_eq]=photo.jpg`);

	try {
		await page.goto(`/admin/files/folders/${folder}/+`);

		const dialog = page.getByRole('dialog', { name: 'Add File' });
		await dialog.getByRole('button', { name: 'Options' }).click();
		await page.getByRole('menuitem', { name: 'Import File from URL' }).click();
		const url = page.getByRole('dialog', { name: 'Import File from URL' });
		await url.getByLabel('URL').fill('http://files-fixtures/photo.jpg');
		await url.getByRole('button', { name: 'Import' }).click();

		await expect.poll(imported).toHaveLength(1);
	} finally {
		const files = await imported();
		if (files.length) await api.call('DELETE', '/files', { data: files.map((f) => f.id) });
	}
});

test('dropping two files on the library shows the notice and the progress, then reloads (US2-3)', async ({ page }) => {
	const sub = await folderId(api, 'bo-files-sub');
	await openFiles(page, `/files/folders/${sub}`);

	const transfer = await page.evaluateHandle((prefix) => {
		const data = new DataTransfer();
		for (const name of ['d', 'e']) data.items.add(new File([name], `${prefix}-${name}.txt`, { type: 'text/plain' }));
		return data;
	}, DATA_PREFIX);

	await page.dispatchEvent('main', 'dragenter', { dataTransfer: transfer });
	await expect(page.getByText('Drop to Upload', { exact: true })).toBeVisible();

	await page.dispatchEvent('main', 'drop', { dataTransfer: transfer });
	await expect(page.getByText('Drop to Upload', { exact: true })).toHaveCount(0);

	await expect.poll(async () => (await filesIn(sub)).length).toBe(2);
	for (const { title } of await filesIn(sub)) await expect(page.getByRole('main').getByText(title, { exact: true })).toBeVisible();
});
