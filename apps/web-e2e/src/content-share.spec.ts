// Feature 014 US7 (T084; US7-2, FR-084): the share page /admin/shared/<id> opens the item route of the share in the
// Content module, with the permissions of the share. The seeded `bo-share` has five uses, so the tests sign in to
// temporary shares with its role, item and password (test value of apps/web/fixtures/interfaces/lib.mjs, SHARE),
// created through the admin API with DATA_PREFIX and deleted after the file. Not tagged @core: chromium only (SC-001).
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL, DATA_PREFIX } from './helpers/config.js';
import { moduleNavigation } from './helpers/layout.js';
import { login } from './helpers/login.js';
import { type ApiRequest, expect, test } from './helpers/requests.js';

const PASSWORD = 'bo-share-password';
const ITEM_URL = /\/admin\/content\/bo_content\/1$/;

let api: AdminApi;
let shareId: string;
let usedUpId: string;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	const [seeded] = await api.call<{ role: string }[]>('GET', '/shares?fields=role&filter[name][_eq]=bo-share');
	const share = { collection: 'bo_content', item: '1', role: seeded!.role, password: PASSWORD };
	shareId = (await api.createShare({ ...share, name: `${DATA_PREFIX} share` })).id;
	usedUpId = (await api.createShare({ ...share, name: `${DATA_PREFIX} used up`, max_uses: 1, times_used: 1 })).id;
});

test.afterAll(async () => {
	for (const id of [shareId, usedUpId]) await api.deleteShare(id).catch(() => undefined);
});

const calls = (requests: ApiRequest[], method: string, path: RegExp) =>
	requests.filter((r) => r.method === method && path.test(r.path));

async function shareLogin(page: Page, id: string) {
	await page.goto(`/admin/shared/${id}`);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Access Shared Page' }).click();
}

test('share login opens the item with the permissions of the share (US7-2, FR-084)', async ({ page, apiRequests }) => {
	await shareLogin(page, shareId);
	await expect(page).toHaveURL(ITEM_URL);
	await expect(page.getByRole('button', { name: /^(Save|Not Allowed)$/ }).first()).toBeVisible();

	// The tree lists only what the share reads: bo_content (in its folder), no bookmarks.
	await moduleNavigation(page);
	const tree = page.getByRole('tree', { name: 'Collections' });
	await expect(tree.locator('a[href="/admin/content/bo_content"]')).toBeVisible();
	await expect(tree.locator('a')).toHaveCount(1);

	// /content goes to the only readable collection; no bookmark controls for a share session.
	await page.goto('/admin/content');
	await expect(page).toHaveURL(/\/admin\/content\/bo_content$/);
	await expect(page.getByRole('main').getByRole('table')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Create Bookmark' })).toHaveCount(0);

	expect(calls(apiRequests, 'POST', /^\/shares\/auth$/)).toHaveLength(1);
	expect(apiRequests.filter((r) => r.path.startsWith('/presets'))).toEqual([]);
	expect(calls(apiRequests, 'PATCH', /^\/users\/me\/track\/page$/)).toEqual([]);
});

test('a used up share shows the uses left and no form', async ({ page, apiRequests }) => {
	await page.goto(`/admin/shared/${usedUpId}`);
	await expect(page.getByRole('status').filter({ hasText: 'There are currently 0 views remaining' })).toBeVisible();
	await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Access Shared Page' })).toHaveCount(0);
	expect(calls(apiRequests, 'POST', /^\/shares\/auth$/)).toEqual([]);
});

test('a signed-in user opening the share goes straight to the item (FR-084)', async ({ page, apiRequests }) => {
	// Sign-in lands on last_page when set (012 FR-018); the parity APIs cache /users/me.
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
	await api.call('POST', '/utils/cache/clear');
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);

	await page.goto(`/admin/shared/${shareId}`);
	await expect(page).toHaveURL(ITEM_URL);
	await expect(page.getByRole('button', { name: /^(Save|Not Allowed)$/ }).first()).toBeVisible();
	expect(calls(apiRequests, 'POST', /^\/shares\/auth$/)).toEqual([]);
});
