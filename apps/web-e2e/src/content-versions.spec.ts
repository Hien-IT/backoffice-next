// Feature 014 US5 (T065; US5-4, US5-5, FR-070 to FR-073): versions of bo_content/1 (seeded `draft` and `local-1`).
// Versions a test creates carry DATA_PREFIX in their key and are deleted afterwards. Not tagged @core.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, DATA_PREFIX } from './helpers/config.js';
import { openItem } from './helpers/content.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;
const KEY = `${DATA_PREFIX}-v`.toLowerCase();

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
	await api.call('POST', '/utils/cache/clear');
});

test.afterEach(async () => {
	const mine = await api.call<{ id: string }[]>('GET', `/versions?fields=id&filter[key][_starts_with]=${KEY}`);
	if (mine.length) await api.call('DELETE', '/versions', { data: mine.map((v) => v.id) });
});

async function signIn(page: Page) {
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(/\/admin\/(?!login)/);
}

const versionMenu = (page: Page) => page.getByRole('button', { name: /^Version: / });

test('the menu lists main, draft and local-1; switching sets ?version= and hides delete (US5-4, FR-070, FR-071)', async ({
	page,
}) => {
	await signIn(page);
	await openItem(page, 'bo_content', 1);

	await versionMenu(page).click();
	const menu = page.getByRole('menu');
	await expect(menu.getByRole('menuitemradio', { name: /Main/ })).toBeVisible();
	await expect(menu.getByRole('menuitemradio', { name: /Draft|draft/ })).toBeVisible();
	await menu.getByRole('menuitemradio', { name: /local-1|Local 1/i }).click();

	await expect(page).toHaveURL(/\?version=local-1$/);
	await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Save Version' })).toBeVisible();
});

test('create a version: the key `draft` is reserved, another key is saved (US5-5, FR-070)', async ({ page }) => {
	await signIn(page);
	await openItem(page, 'bo_content', 1);

	await versionMenu(page).click();
	await page.getByRole('menuitem', { name: 'Create Version' }).click();
	const dialog = page.getByRole('dialog');
	const textboxes = dialog.getByRole('textbox');

	await textboxes.first().fill('draft');
	await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();

	await textboxes.first().fill(KEY);
	const created = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/versions'));
	await dialog.getByRole('button', { name: 'Save' }).click();
	expect((await created).postDataJSON()).toMatchObject({ key: KEY, collection: 'bo_content', item: '1' });
	await expect(page).toHaveURL(new RegExp(`\\?version=${KEY}$`));
});
