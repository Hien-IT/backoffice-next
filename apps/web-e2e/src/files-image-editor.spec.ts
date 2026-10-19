// Feature 015 US5 (T054; FR-040 to FR-046, SC-006): the shared image editor on copies of the fixture `bo-edit.png`
// (400×300) made by this configuration: crop 200×100 at (10, 20) through Cropper.js `setData` (dragging is mouse
// only, FR-046) then rotate -90°, save over the file and save as a new file, from the file page and from the
// `file-image` interface of bo_rel. At proxy-api the same steps run in the Directus app on another copy and the saved
// images are compared pixel by pixel after decoding, with their width, height and focal point (SC-006). The spec drives
// the Directus app, so it runs on chromium-1280 only (DIRECTUS_APP_SPECS).
import type { Locator, Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, DATA_PREFIX, e2eConfig } from './helpers/config.js';
import { goto, headerButton, onDirectusApp } from './helpers/directus-app.js';
import { clearCreatedFiles, folderId, openFiles } from './helpers/files.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

type FileRow = { id: string; width: number; height: number; folder: string | null; focal_point_x: number | null };

let api: AdminApi;
let png: Buffer;
const relItems: number[] = [];

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	const [edit] = await api.call<{ id: string }[]>('GET', '/files?fields=id&filter[title][_eq]=bo-edit');
	if (!edit) throw new Error('No fixture file bo-edit: seed the fixture set first');
	png = await api.bytes(`/assets/${edit.id}`);
});

test.beforeEach(async ({ page }) => {
	await resetLastPage(api);
	await clearCreatedFiles(api);
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).not.toHaveURL(/\/admin\/login/);
});

test.afterEach(async () => {
	while (relItems.length) await api.call('DELETE', `/items/bo_rel/${relItems.pop()}`);
	await clearCreatedFiles(api);
	await resetLastPage(api);
});

/** A copy of bo-edit.png in the `bo-files-sub` folder, named for this configuration. */
async function copy(name: string): Promise<FileRow> {
	const folder = await folderId(api, 'bo-files-sub');
	return api.call<FileRow>('POST', '/files', {
		multipart: {
			folder,
			title: `${DATA_PREFIX} ${name}`,
			file: { name: `${DATA_PREFIX}-${name}.png`, mimeType: 'image/png', buffer: png },
		},
	});
}

const row = (id: string) => api.call<FileRow>('GET', `/files/${id}?fields=id,width,height,folder,focal_point_x`);

/** Crop box 200×100 at (10, 20) in image pixels on the Cropper.js instance of the editor image. */
async function crop(image: Locator) {
	await image.evaluate((el) =>
		(el as HTMLImageElement & { cropper: { setData: (d: object) => void } }).cropper.setData({
			x: 10,
			y: 20,
			width: 200,
			height: 100,
		}),
	);
}

/** The Backoffice editor: crop tool, crop box, rotate, then save (or save as a new file). */
async function editInBackoffice(page: Page, saveAsNew = false) {
	const dialog = page.getByRole('dialog', { name: 'Editing Image' });
	await expect(dialog.locator('.cropper-container')).toBeVisible();

	await dialog.getByRole('button', { name: 'Crop Tool' }).click();
	await crop(dialog.locator('.editor > img'));
	await dialog.getByRole('button', { name: 'Rotate' }).click();
	// Directus computes the size line from the crop event and swaps it on rotation; the saved image keeps the crop box as
	// shown (Cropper.js rotates the image under the box), so it is 200×100.
	await expect(dialog.locator('.dimensions')).toHaveText('400x300 -> 100x200');

	if (saveAsNew) {
		await dialog.getByRole('button', { name: 'Options' }).click();
		await page.getByRole('menuitem', { name: 'Save as New File' }).click();
	} else {
		await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	}

	await expect(dialog).toBeHidden();
}

test('file page: crop and rotate saves over the file (FR-040 to FR-043)', async ({ page }) => {
	const file = await copy('edit');
	await openFiles(page, `/files/${file.id}`);

	await page.getByRole('button', { name: 'Edit', exact: true }).click();
	await editInBackoffice(page);

	await expect.poll(async () => [(await row(file.id)).width, (await row(file.id)).height]).toEqual([200, 100]);
});

test('file page: save as a new file adds it to the same folder and opens it; the original is unchanged (FR-044)', async ({
	page,
}) => {
	const file = await copy('edit');
	await openFiles(page, `/files/${file.id}`);

	await page.getByRole('button', { name: 'Edit', exact: true }).click();
	await editInBackoffice(page, true);

	await expect(page).not.toHaveURL(new RegExp(`/admin/files/${file.id}$`));
	const newId = /\/admin\/files\/([^/?#]+)$/.exec(page.url())![1]!;
	const created = await row(newId);
	expect([created.width, created.height, created.folder]).toEqual([200, 100, file.folder]);
	const original = await row(file.id);
	expect([original.width, original.height]).toEqual([400, 300]);
});

test('file-image of bo_rel: the edit image button opens the editor; the saved file is reloaded (FR-045)', async ({
	page,
}) => {
	const file = await copy('rel');
	const { id } = await api.call<{ id: number }>('POST', '/items/bo_rel', {
		data: { title: `${DATA_PREFIX} image editor`, file_image: file.id },
	});
	relItems.push(id);

	await page.goto(`/admin/content/bo_rel/${id}`);
	await page.getByRole('button', { name: 'Edit Image' }).click();
	await editInBackoffice(page);

	await expect.poll(async () => [(await row(file.id)).width, (await row(file.id)).height]).toEqual([200, 100]);
});

test('the Directus app saves the same pixels, size and focal point (SC-006)', async ({ browser, page }) => {
	test.skip(e2eConfig !== 'proxy-api', 'the pixel comparison runs at proxy-api (contracts/tests.md)');

	const ours = await copy('pixels-bo');
	const theirs = await copy('pixels-dir');

	await openFiles(page, `/files/${ours.id}`);
	await page.getByRole('button', { name: 'Edit', exact: true }).click();
	await editInBackoffice(page);

	await onDirectusApp(browser, async (p) => {
		await goto(p, `/files/${theirs.id}`);
		await headerButton(p, 'tune').click();
		const drawer = p.locator('.v-drawer');
		await expect(drawer.locator('.cropper-container')).toBeVisible();
		// Clickable v-icons are buttons named by their ligature.
		await drawer.getByRole('button', { name: 'crop', exact: true }).click();
		await crop(drawer.locator('.editor > img'));
		await drawer.getByRole('button', { name: 'rotate_90_degrees_ccw', exact: true }).click();
		await drawer.getByRole('button', { name: 'check', exact: true }).click();
		await expect(drawer).toBeHidden();
	});

	await expect.poll(async () => (await row(theirs.id)).width).toBe(200);
	const [a, b] = [await row(ours.id), await row(theirs.id)];
	expect([a.width, a.height, a.focal_point_x]).toEqual([b.width, b.height, b.focal_point_x]);

	// Decoded RGBA of both saved images, byte for byte.
	const pixels = async (id: string) => {
		const base64 = (await api.bytes(`/assets/${id}`)).toString('base64');
		return page.evaluate(async (data) => {
			// A Blob, not fetch('data:...'): the app sends the Directus CSP, whose connect-src has no data: (feature 019).
			const png = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
			const bitmap = await createImageBitmap(new Blob([png], { type: 'image/png' }));
			const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
			const context = canvas.getContext('2d')!;
			context.drawImage(bitmap, 0, 0);
			const bytes = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
			let hash = 0;
			for (const byte of bytes) hash = (hash * 31 + byte) >>> 0;
			return { width: bitmap.width, height: bitmap.height, length: bytes.length, hash };
		}, base64);
	};

	expect(await pixels(ours.id)).toEqual(await pixels(theirs.id));
});
