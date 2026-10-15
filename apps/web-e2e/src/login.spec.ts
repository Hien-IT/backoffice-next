// US1 (T039, contracts/e2e.md §2): local sign-in with and without TFA, errors, redirect, session kept on reload, an
// ended session, sign-out and the enforced TFA setup, against the API of the configuration.
import { CONTENT_URL } from './helpers/config.js';
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { closeHostDb, hostDb } from './helpers/db-rows.js';
import { Fixtures, TFA_SECRET, type TestUser, totp } from './helpers/fixtures.js';
import { moduleBar } from './helpers/layout.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

let fixtures: Fixtures;
let appUser: TestUser;
let tfaUser: TestUser;
let suspended: TestUser;
let noAppAccess: TestUser;
let enforced: TestUser;

test.beforeAll(async ({ playwright }) => {
	fixtures = new Fixtures(new AdminApi(await playwright.request.newContext()));
	const app = await fixtures.role('login app');
	appUser = await fixtures.user('app', { role: app });
	tfaUser = await fixtures.user('tfa', { role: app, tfa_secret: TFA_SECRET });
	suspended = await fixtures.user('suspended', { role: app, status: 'suspended' });
	noAppAccess = await fixtures.user('no-app', { role: await fixtures.role('login no app', { app: false }) });
	enforced = await fixtures.user('enforced', {
		role: await fixtures.role('login enforced', { enforceTfa: true, ownTfa: true }),
	});
});

test.afterAll(async () => {
	await fixtures.cleanup();
	await closeHostDb();
});

const sessions = async (user: TestUser) =>
	Number((await hostDb()('directus_sessions').where({ user: user.id }).count({ n: '*' }).first())?.['n'] ?? 0);

/** Whether the session cookie of the page still refreshes (Directus 11 keeps a refreshed row for a grace period). */
async function sessionAlive(page: Page, apiUrl: string): Promise<boolean> {
	const response = await page.request.post(`${apiUrl}/auth/refresh`, { data: { mode: 'session' } });
	return response.ok();
}

async function openLogin(page: Page, query = '') {
	await page.goto(`/admin/login${query}`);
	await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
}

test('signs in with email and password, then signs out (US1-1, US1-6)', async ({ page, apiUrl }) => {
	await openLogin(page);
	await expect(page).toHaveTitle(/^Sign In · /);

	await login(page, appUser);
	await expect(page).toHaveURL(CONTENT_URL);
	expect(await sessions(appUser)).toBe(1);

	await page.goto('/admin/logout');
	await expect(page).toHaveURL(/\/admin\/login\?reason=SIGN_OUT$/);
	await expect(page.getByText('Signed out')).toBeVisible();
	expect(await sessionAlive(page, apiUrl)).toBe(false);
});

test('wrong password and suspended user show the translated API error (US1-3)', async ({ page }) => {
	await openLogin(page);
	await login(page, { ...appUser, password: 'wrong-password' });
	await expect(page.getByRole('alert')).toContainText('Wrong username or password');

	await openLogin(page);
	await login(page, suspended);
	await expect(page.getByRole('alert')).toContainText(/User Suspended|Wrong username or password/);
	await expect(page).toHaveURL(/\/admin\/login/);
});

test('TFA: the OTP field appears after INVALID_OTP and keeps the credentials (US1-2)', async ({ page }) => {
	await openLogin(page);
	await login(page, tfaUser);

	const otp = page.getByLabel('One-Time Password').or(page.getByPlaceholder('One-Time Password'));
	await expect(otp).toBeVisible();

	await otp.fill('000000');
	await page.getByRole('button', { name: 'Sign In', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('Wrong one-time password');

	await otp.fill(totp());
	await page.getByRole('button', { name: 'Sign In', exact: true }).click();
	await expect(page).toHaveURL(CONTENT_URL);
});

test('a user without app access sees the no-app-access screen and can sign out (US1-3)', async ({ page }) => {
	await openLogin(page);
	await login(page, noAppAccess);

	await expect(page.getByText('No App Access')).toBeVisible();
	await page.getByRole('link', { name: 'Sign Out' }).click();
	await expect(page).toHaveURL(/\/admin\/login/);
});

test('?redirect: an app path is followed, an outside URL stays in the app (US1-7, FR-013)', async ({
	page,
	baseURL,
}) => {
	await page.goto('/admin/settings/project');
	await expect(page).toHaveURL(/\/admin\/login\?redirect=/);

	await login(page, appUser);
	// The app user has no Settings module: the redirect lands on the private 404 of the app, still under /admin/.
	await expect(page).toHaveURL(/\/admin\/settings\/project$/);
	await page.goto('/admin/logout');
	await expect(page).toHaveURL(/reason=SIGN_OUT/);

	await openLogin(page, `?redirect=${encodeURIComponent('https://evil.test/')}`);
	await login(page, appUser);
	await expect(page).toHaveURL((url) => url.origin === new URL(baseURL!).origin && url.pathname.startsWith('/admin/'));
});

test('reload keeps the session; an ended session sends back to login (US1-4, US1-5)', async ({ page }) => {
	await openLogin(page);
	await login(page, appUser);
	await expect(page).toHaveURL(CONTENT_URL);

	await page.reload();
	await expect(page).toHaveURL(CONTENT_URL);
	await moduleBar(page);

	// Tab hidden then visible again: refresh() validates the session (FR-014) and finds it gone.
	await hostDb()('directus_sessions').where({ user: appUser.id }).delete();
	await page.evaluate(() => {
		const set = (state: string) => {
			Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
			document.dispatchEvent(new Event('visibilitychange'));
		};
		set('hidden');
		set('visible');
	});
	await expect(page).toHaveURL(/\/admin\/login\?reason=SESSION_EXPIRED$/);
	await expect(page.getByText('Session expired')).toBeVisible();

	// Reload with a dead cookie: like Directus (firstRefresh), back to login without a reason.
	await login(page, appUser);
	await expect(page).toHaveURL(CONTENT_URL);
	await moduleBar(page);
	await hostDb()('directus_sessions').where({ user: appUser.id }).delete();
	await page.reload();
	await expect(page).toHaveURL(/\/admin\/login\?redirect=/);
});

test('enforce_tfa sends to /tfa-setup; enabling TFA returns to the app (US1-8)', async ({ page }) => {
	await openLogin(page);
	await login(page, enforced);
	await expect(page).toHaveURL(/\/admin\/tfa-setup/);

	await page.getByLabel('Password', { exact: true }).fill(enforced.password);
	await page.keyboard.press('Enter');

	const secret = page.getByTestId('tfa-secret');
	await expect(secret).toBeVisible();
	const code = totp((await secret.innerText()).replace(/\s/g, ''));

	await page.getByLabel('One-Time Password', { exact: true }).fill(code);
	await page.keyboard.press('Enter');
	await expect(page).not.toHaveURL(/tfa-setup/);
	expect((await hostDb()('directus_users').where({ id: enforced.id }).first())?.['tfa_secret']).not.toBeNull();
});
