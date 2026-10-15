// Feature 014 US2 (T040; FR-063 to FR-069): the live preview of bo_content (preview_url on preview.example, stubbed by
// helpers/external-hosts.ts). Not tagged @core: chromium only (SC-001).
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL } from './helpers/config.js';
import { openItem } from './helpers/content.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

test.beforeEach(async ({ page, playwright }) => {
	const api = new AdminApi(await playwright.request.newContext());
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
	await api.call('POST', '/utils/cache/clear');
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
});

test('split preview: toggle, iframe attributes, keyboard resize, stored mode and size (FR-063 to FR-065, FR-069)', async ({
	page,
}, testInfo) => {
	test.skip(!testInfo.project.name.endsWith('-1280'), 'the split needs more than `sm`');
	await openItem(page, 'bo_content', 1);

	await page.getByRole('button', { name: 'Enable Preview' }).click();
	const frame = page.locator('iframe#frame');
	await expect(frame).toHaveAttribute('src', 'https://preview.example/1?v=main');
	await expect(frame).toHaveAttribute('title', 'Live Website Preview');
	expect(await frame.evaluate((f) => f.getAttributeNames().sort())).toEqual(['class', 'id', 'src', 'title'].sort());

	const handle = page.getByRole('separator', { name: 'Change Display Dimensions' });
	const before = Number(await handle.getAttribute('aria-valuenow'));
	await handle.focus();
	await page.keyboard.press('ArrowLeft');
	await expect(handle).not.toHaveAttribute('aria-valuenow', String(before));

	expect(await page.evaluate(() => localStorage.getItem('backoffice-live-preview-mode'))).toBe('split');

	await page.getByRole('button', { name: 'Disable Preview' }).click();
	await expect(frame).toHaveCount(0);
});

test('popup: opens /preview in a named window; closing it goes back to split (FR-066, FR-067)', async ({
	page,
	context,
}, testInfo) => {
	test.skip(!testInfo.project.name.endsWith('-1280'), 'the split needs more than `sm`');
	await openItem(page, 'bo_content', 1);
	await page.getByRole('button', { name: 'Enable Preview' }).click();

	const popup = context.waitForEvent('page');
	await page.getByRole('button', { name: 'Display Options' }).click();
	await page.getByRole('menuitem', { name: 'Open in New Window' }).click();
	const win = await popup;
	await expect(win).toHaveURL(/\/admin\/content\/bo_content\/1\/preview$/);
	await expect(win.locator('iframe#frame')).toHaveAttribute('src', 'https://preview.example/1?v=main');

	await win.close();
	await expect(page.locator('iframe#frame')).toBeVisible({ timeout: 5000 });
});
