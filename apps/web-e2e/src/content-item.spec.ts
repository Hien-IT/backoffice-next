// Feature 014 US2 (T039; US2-1 to US2-8, FR-050 to FR-062, FR-115c/d): the item page on the fixture set bo_*. Items a
// test creates carry DATA_PREFIX in their title and are deleted in afterAll; the singleton value is restored.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL, DATA_PREFIX } from './helpers/config.js';
import { e2eName, openItem } from './helpers/content.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

// Test values of the fixture users, from apps/web/fixtures/interfaces/lib.mjs (USERS).
const VIEWER = { email: 'bo-viewer@example.com', password: 'bo-viewer-test-password' };

let api: AdminApi;
let tagline: string | null;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	tagline = (await api.call<{ tagline: string | null }>('GET', '/items/bo_singleton')).tagline;
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
	await api.call('POST', '/utils/cache/clear');
});

test.afterAll(async () => {
	const created = await api.call<{ id: number }[]>(
		'GET',
		`/items/bo_content?fields=id&limit=-1&filter[title][_starts_with]=${encodeURIComponent(DATA_PREFIX)}`,
	);
	if (created.length) await api.call('DELETE', '/items/bo_content', { data: created.map((i) => i.id) });
	await api.call('PATCH', '/items/bo_singleton', { data: { tagline } });
});

async function signIn(page: Page, user = ADMIN) {
	await page.goto('/admin/login');
	await login(page, user);
	// The viewer's last_page is not reset (only the admin's): any landing page in the app will do.
	await expect(page).toHaveURL(user === ADMIN ? CONTENT_URL : /\/admin\/(?!login)/);
}

const title = (page: Page) => page.getByRole('textbox', { name: 'Title' });
const save = (page: Page) => page.getByRole('button', { name: 'Save', exact: true });

async function saveOption(page: Page, name: string) {
	await page.getByRole('button', { name: 'More Save Options' }).click();
	await page.getByRole('menuitem', { name }).click();
}

test('create, save and quit; save and stay goes to the new key (US2-1, FR-052)', { tag: '@core' }, async ({ page }) => {
	await signIn(page);
	await openItem(page, 'bo_content', '+');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creating Item in Bo Content');

	await title(page).fill(e2eName('created'));
	const created = page.waitForRequest((r) => r.method() === 'POST' && /\/items\/bo_content$/.test(r.url()));
	await save(page).click();
	expect((await created).postDataJSON()).toMatchObject({ title: e2eName('created') });
	await expect(page).toHaveURL(/\/admin\/content\/bo_content$/);

	await openItem(page, 'bo_content', '+');
	await title(page).fill(e2eName('stay'));
	await saveOption(page, 'Save and Stay');
	await expect(page).toHaveURL(/\/admin\/content\/bo_content\/\d+$/);
	await expect(title(page)).toHaveValue(e2eName('stay'));
});

test('save and create new; save as copy; discard (FR-053 to FR-056)', { tag: '@core' }, async ({ page }) => {
	await signIn(page);
	await openItem(page, 'bo_content', '+');
	await title(page).fill(e2eName('first'));
	await saveOption(page, 'Save and Create New');
	await expect(page).toHaveURL(/\/admin\/content\/bo_content\/\+$/);
	await expect(title(page)).toHaveValue('');

	await openItem(page, 'bo_content', 1);
	await title(page).fill(e2eName('copy'));
	const copy = page.waitForRequest((r) => r.method() === 'POST' && /\/items\/bo_content$/.test(r.url()));
	await saveOption(page, 'Save as Copy');
	const body = (await copy).postDataJSON();
	expect(body).toMatchObject({ title: e2eName('copy') });
	expect(body).not.toHaveProperty('id');
	await expect(page).not.toHaveURL(/\/bo_content\/1$/);
	await expect(page).toHaveURL(/\/admin\/content\/bo_content\/\d+$/);

	await openItem(page, 'bo_content', 2);
	await title(page).fill('changed');
	await saveOption(page, 'Discard All Changes');
	await expect(title(page)).toHaveValue('Content 02');
});

test('a required field blocks the save and shows the validation notice (FR-057)', { tag: '@core' }, async ({ page }) => {
	await signIn(page);
	await openItem(page, 'bo_content', '+');
	await page.getByRole('textbox', { name: 'Body' }).fill('no title');

	let posted = false;
	page.on('request', (r) => {
		if (r.method() === 'POST' && /\/items\/bo_content$/.test(r.url())) posted = true;
	});
	await save(page).click();

	await expect(page.getByText('The following fields have invalid values:')).toBeVisible();
	expect(posted).toBe(false);
});

test('leaving with edits asks first (FR-084 of 013, FR-060)', { tag: '@core' }, async ({ page }) => {
	await signIn(page);
	await openItem(page, 'bo_content', 2);
	await title(page).fill('unsaved');

	await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Bo Content' }).click();
	const dialog = page.getByRole('dialog', { name: 'Unsaved Changes' });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Keep Editing' }).click();
	await expect(page).toHaveURL(/\/bo_content\/2$/);

	await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Bo Content' }).click();
	await page.getByRole('dialog', { name: 'Unsaved Changes' }).getByRole('button', { name: 'Discard Changes' }).click();
	await expect(page).toHaveURL(/\/admin\/content\/bo_content$/);
});

test('archive, unarchive and delete with confirmations (FR-054, FR-055, FR-115d)', { tag: '@core' }, async ({ page }) => {
	const { id } = await api.call<{ id: number }>('POST', '/items/bo_content', {
		data: { title: e2eName('archive'), status: 'draft' },
	});
	await signIn(page);
	await openItem(page, 'bo_content', id);

	await page.getByRole('button', { name: 'Archive', exact: true }).click();
	const archive = page.getByRole('dialog', { name: 'Are you sure you want to archive this item?' });
	await expect(archive.getByRole('button', { name: 'Cancel' })).toBeFocused();
	await archive.getByRole('button', { name: 'Archive' }).click();
	await expect(page).toHaveURL(/\/admin\/content\/bo_content$/);

	await openItem(page, 'bo_content', id);
	await page.getByRole('button', { name: 'Unarchive', exact: true }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Unarchive' }).click();
	await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(page).toHaveURL(/\/admin\/content\/bo_content$/);
	await expect.poll(async () => (await api.call<unknown[]>('GET', `/items/bo_content?filter[id][_eq]=${id}`)).length).toBe(0);
});

test('singleton: the form at the collection URL, PATCH on the collection, no delete (FR-058)', { tag: '@core' }, async ({ page }) => {
	await signIn(page);
	await page.goto('/admin/content/bo_singleton');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bo Singleton');
	await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);

	await page.getByRole('textbox', { name: 'Tagline' }).fill(e2eName('tagline'));
	const patched = page.waitForRequest((r) => r.method() === 'PATCH' && /\/items\/bo_singleton$/.test(r.url()));
	await save(page).click();
	expect((await patched).postDataJSON()).toEqual({ tagline: e2eName('tagline') });

	await page.goto('/admin/content/bo_singleton/1');
	await expect(page.getByRole('heading', { level: 1, name: 'Page Not Found' })).toBeVisible();
});

test('tab title and a read-only form for a viewer (FR-051, FR-098)', { tag: '@core' }, async ({ page }) => {
	await signIn(page, VIEWER);
	await openItem(page, 'bo_content', 2);

	await expect(page).toHaveTitle('Bo Content | Content 02 · Backoffice');
	await expect(title(page)).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Not Allowed' }).first()).toBeDisabled();
});
