// Feature 007 (T053, SC-002): the Files module of the Directus app through the proxy, where /files, /folders and
// /assets go to the new app, writes the same rows as Directus alone: upload through the file input, import from a URL,
// the thumbnails of the library (cards layout) and of the file page, edit the title, create a folder, move the file
// into it, download the folder as a zip (folder menu), delete the file.
import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { deleteOpenItem, field, saveButton } from './helpers/app.js';
import { closeHostDb } from './helpers/db-rows.js';
import { bothRuns } from './helpers/scenario.js';

const PHOTO = readFileSync(new URL('../../parity/fixtures/files/photo.jpg', import.meta.url));
const TABLES = ['directus_files', 'directus_folders'];

test.afterAll(closeHostDb);

const responseOf = (page: Page, method: string, path: RegExp) =>
	page.waitForResponse((r) => r.request().method() === method && path.test(new URL(r.url()).pathname));

/** The button of the Add File dialog whose icon is `icon` (file_upload, folder_open, link). */
const uploadButton = (page: Page, icon: string) =>
	page.locator('.v-upload button').filter({ has: page.locator(`i[data-icon="${icon}"]`) });

test('upload, import, thumbnails, edit, folder, move, zip and delete', async ({ browser }) => {
	const zips: Record<string, string[]> = {};

	const changes = await bothRuns(
		browser,
		async (page, url, tag) => {
			// Upload through the file input of the Add File dialog.
			await page.goto(`${url}/admin/files/+`);
			const uploaded = responseOf(page, 'POST', /^\/files$/);
			await page.locator('.v-upload input.browse').setInputFiles({
				name: `${tag}.jpg`,
				mimeType: 'image/jpeg',
				buffer: PHOTO,
			});
			const upload = await uploaded;
			expect(upload.status()).toBe(200);
			const id = ((await upload.json()) as any).data.id as string;

			// Import from a URL (files-fixtures serves tests/parity/fixtures/files).
			await page.goto(`${url}/admin/files/+`);
			await uploadButton(page, 'link').click();
			await page.getByRole('textbox', { name: 'URL' }).fill('http://files-fixtures/photo.jpg');
			const imported = responseOf(page, 'POST', /^\/files\/import$/);
			await page.getByRole('button', { name: 'Import', exact: true }).click();
			expect((await imported).status()).toBe(200);

			// The file page loads the preview of the file.
			const preview = page.waitForResponse((r) => r.url().includes(`/assets/${id}`));
			await page.goto(`${url}/admin/files/${id}`);
			expect((await preview).status()).toBe(200);

			await field(page, 'Title').locator('input').fill(`${tag} edited`);
			const patched = responseOf(page, 'PATCH', new RegExp(`^/files/${id}$`));
			await saveButton(page).click();
			expect((await patched).status()).toBe(200);

			// A folder, then the file moved into it from its page.
			await page.goto(`${url}/admin/files`);
			await page
				.locator('header button')
				.filter({ has: page.locator('i[data-icon="create_new_folder"]') })
				.click();
			await page.getByRole('textbox', { name: 'Folder Name...' }).fill(`${tag}-folder`);
			const folderCreated = responseOf(page, 'POST', /^\/folders$/);
			await page.locator('.v-card', { hasText: 'Create Folder' }).getByRole('button', { name: 'Save' }).click();
			const folder = await folderCreated;
			expect(folder.status()).toBe(200);
			const folderId = ((await folder.json()) as any).data.id as string;

			await page.goto(`${url}/admin/files/${id}`);
			await page
				.locator('header button')
				// folder_move is one of the app's own SVG icons (no data-icon).
				.filter({ has: page.locator('.custom-icon-svg') })
				.click();
			const dialog = page.locator('.v-card', { hasText: 'Move to Folder' });
			await dialog.locator('.v-list-item', { hasText: `${tag}-folder` }).click();
			const moved = responseOf(page, 'PATCH', new RegExp(`^/files/${id}$`));
			await dialog.getByRole('button', { name: 'Move', exact: true }).click();
			expect((await moved).status()).toBe(200);

			// The folder (cards layout) holds only this file: its card loads the thumbnail of a system preset.
			const card = page.waitForResponse((r) => r.url().includes(`/assets/${id}?key=system-medium-cover`));
			await page.goto(`${url}/admin/files/folders/${folderId}`);
			expect((await card).status()).toBe(200);

			// Download Folder from the folder menu of the navigation: POST /assets/folder/:id, a zip of the file.
			await page.goto(`${url}/admin/files`);
			const zip = page.waitForResponse((r) => r.url().includes('/assets/folder/'));
			await page
				.locator('.v-list-item', { hasText: `${tag}-folder` })
				.first()
				.click({ button: 'right' });
			await page.locator('.v-menu-content .v-list-item', { hasText: 'Download Folder' }).click();
			const archive = await zip;
			expect(archive.status()).toBe(200);
			expect(archive.headers()['content-type']).toBe('application/zip');
			// The name ends with the date and time of the request.
			zips[tag.slice(-3)] = [
				archive
					.headers()
					['content-disposition']!.split(tag)
					.join('e2e-<run>')
					.replace(/-\d{8}-\d+\.zip/, '-<time>.zip'),
			];

			await page.goto(`${url}/admin/files/${id}`);
			const deleted = responseOf(page, 'DELETE', new RegExp(`^/files/${id}$`));
			await deleteOpenItem(page);
			expect((await deleted).status()).toBe(204);

			// The next run signs in on last_page (cached by Directus): leave it in the content module like the other specs.
			await page.goto(`${url}/admin/content`);
		},
		TABLES,
	);

	// The object names of the uploads are `<id>.jpg`: the ids are markers already, the names are not.
	const named = (value: unknown) =>
		JSON.parse(JSON.stringify(value).replace(/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.jpg/g, '<id>.jpg'));

	expect(zips['prx']).toEqual(zips['dir']);
	expect(named(changes['prx'])).toEqual(named(changes['dir']));
});
