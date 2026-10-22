// Feature 015 US4 (T082; US4-1 to US4-6, FR-070 to FR-076): the user page. The user box and the form of a directory user,
// your own profile at /users/<id> (language applies at once), archive, new users from /users/+ and from a role,
// deleting another user and deleting yourself (logout). Tagged @core: chromium, firefox and webkit (SC-001).
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN } from './helpers/config.js';
import { closeHostDb } from './helpers/db-rows.js';
import { Fixtures, type TestUser } from './helpers/fixtures.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';
import { clearCreatedUsers, openUsers, roleId, userEmail } from './helpers/users.js';
import { moduleBar } from './helpers/layout.js';

let api: AdminApi;
let fixtures: Fixtures;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	fixtures = new Fixtures(api);
});

test.beforeEach(async ({ page }) => {
	await resetLastPage(api);
	await clearCreatedUsers(api);
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).not.toHaveURL(/\/admin\/login/);
});

test.afterEach(async () => {
	await clearCreatedUsers(api);
	await resetLastPage(api);
});

test.afterAll(async () => {
	await fixtures.cleanup();
	await closeHostDb();
});

const title = (page: Page) => page.getByRole('main').getByRole('heading', { level: 1 });
const save = (page: Page) => page.getByRole('button', { name: 'Save', exact: true });

async function userId(email: string): Promise<string> {
	const [user] = await api.call<{ id: string }[]>('GET', `/users?fields=id&filter[email][_eq]=${encodeURIComponent(email)}`);
	return user!.id;
}

test('the user box and the form of a directory user; saving sends only the changed field (US4-1) @core', async ({ page }) => {
	const created = await api.createUser({ email: userEmail('box'), first_name: 'Box', last_name: 'User', status: 'active' });
	await openUsers(page, `/users/${created.id}`);

	const box = page.locator('.user-box');
	await expect(box.getByText('Box User')).toBeVisible();
	await expect(box.getByText(userEmail('box'))).toBeVisible();
	await expect(title(page)).toHaveText('Box User');

	const patch = page.waitForRequest((r) => r.method() === 'PATCH' && new URL(r.url()).pathname.endsWith(`/users/${created.id}`));
	await page.getByRole('textbox', { name: 'Title' }).fill('Engineer');
	await save(page).click();
	expect((await patch).postDataJSON()).toEqual({ title: 'Engineer' });
	await expect(page).toHaveURL(/\/admin\/users$/);
});

test('the avatar menu links to your own page /users/<id> (US4-2, D-86) @core', async ({ page }) => {
	const me = (await api.call<{ id: string }>('GET', '/users/me?fields=id')).id;

	await openUsers(page);
	// The avatar menu is at the end of the top bar (D-157).
	await moduleBar(page);
	await page.getByRole('button', { name: 'Admin User' }).click();
	await page.getByRole('menuitem', { name: /Profile/ }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/users/${me}$`));
	await expect(page.locator('.user-box')).toBeVisible();
});

test('archive sets the status and goes to the directory (US4-3)', async ({ page }) => {
	const created = await api.createUser({ email: userEmail('archive'), status: 'active' });
	await openUsers(page, `/users/${created.id}`);

	await page.getByRole('button', { name: 'Archive' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click();
	await expect(page).toHaveURL(/\/admin\/users$/);
	expect((await api.call<{ status: string }>('GET', `/users/${created.id}?fields=status`)).status).toBe('archived');
});

test('new users from /users/+ and from a role (US4-4)', async ({ page }) => {
	await openUsers(page, '/users/+');
	await expect(title(page)).toHaveText('Adding User');
	await page.getByRole('textbox', { name: 'Email' }).fill(userEmail('plain'));
	await save(page).click();
	await expect(page).toHaveURL(/\/admin\/users$/);
	expect(await userId(userEmail('plain'))).toBeTruthy();

	const sub = await roleId(api, 'bo-sub');
	await openUsers(page, `/users/roles/${sub}/+`);
	await page.getByRole('textbox', { name: 'Email' }).fill(userEmail('in-role'));
	await save(page).click();
	await expect(page).toHaveURL(/\/admin\/users$/);
	const [inRole] = await api.call<{ role: string }[]>('GET', `/users?fields=role&filter[email][_eq]=${userEmail('in-role')}`);
	expect(inRole!.role).toBe(sub);
});

test('delete another user goes back to the directory (US4-5)', async ({ page }) => {
	const created = await api.createUser({ email: userEmail('delete'), status: 'active' });
	await openUsers(page, `/users/${created.id}`);

	await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(page).toHaveURL(/\/admin\/users$/);
	expect(await api.call<unknown[]>('GET', `/users?filter[id][_eq]=${created.id}`)).toHaveLength(0);
});

test('deleting yourself signs you out (US4-6)', async ({ page }) => {
	// A temporary admin that deletes itself.
	const adminRole = (await api.call<{ role: string }>('GET', '/users/me?fields=role')).role;
	const temp: TestUser = await fixtures.user('self-delete', { role: adminRole });

	await page.context().clearCookies();
	await page.goto('/admin/login');
	await login(page, temp);
	await expect(page).not.toHaveURL(/\/admin\/login/);
	await openUsers(page, `/users/${temp.id}`);

	await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(page).toHaveURL(/\/admin\/login/);
	expect(await api.call<unknown[]>('GET', `/users?filter[id][_eq]=${temp.id}`)).toHaveLength(0);
});
