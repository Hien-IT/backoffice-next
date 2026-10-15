// Feature 015 US4 (T082; FR-080 to FR-083, CHK031): the `system-token` and `system-mfa-setup` interfaces on the user
// page. Token: generate (the new token signs API calls), regenerate after the confirmation (the old one stops working),
// remove. TFA: a password user turns it on with an OTP from the shown secret and off again; an admin turns it off for
// another user. The SSO branch (localStorage key + sign-out) is covered by SystemMfaSetup.browser.test.ts: E2E cannot
// sign in an SSO user without the identity provider. Users are temporary admins of this configuration.
import type { Page } from '@playwright/test';
import { authenticator } from 'otplib';
import { AdminApi } from './helpers/api.js';
import { ADMIN, apiUrl } from './helpers/config.js';
import { closeHostDb } from './helpers/db-rows.js';
import { Fixtures, TFA_SECRET, type TestUser } from './helpers/fixtures.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';
import { openUsers } from './helpers/users.js';

let api: AdminApi;
let fixtures: Fixtures;
let adminRole: string;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	fixtures = new Fixtures(api);
	adminRole = await fixtures.role('tfa-token', { admin: true });
});

test.beforeEach(async () => {
	await resetLastPage(api);
});

test.afterAll(async () => {
	await fixtures.cleanup();
	await resetLastPage(api);
	await closeHostDb();
});

async function signIn(page: Page, user: { email: string; password: string }) {
	await page.goto('/admin/login');
	await login(page, user);
	await expect(page).not.toHaveURL(/\/admin\/login/);
}

async function whoAmI(token: string) {
	const response = await fetch(`${apiUrl}/users/me?fields=email`, { headers: { Authorization: `Bearer ${token}` } });
	return response.ok ? ((await response.json()) as { data: { email: string } }).data.email : response.status;
}

test('token: generate signs API calls, regenerate replaces it, remove clears it (FR-083)', async ({ page }) => {
	const user: TestUser = await fixtures.user('token', { role: adminRole });
	await signIn(page, ADMIN);
	await openUsers(page, `/users/${user.id}`);

	const token = page.getByRole('textbox', { name: 'Token' });
	await page.getByRole('button', { name: 'Generate Token' }).click();
	await expect(page.getByText('Token was saved successfully.')).toBeVisible();
	const first = await token.inputValue();
	expect(first).toMatch(/^\S{16,}$/);
	expect(await whoAmI(first)).toBe(user.email);

	await page.getByRole('button', { name: 'Regenerate Token' }).click();
	await page.getByRole('dialog', { name: 'Regenerate Token' }).getByRole('button', { name: 'Regenerate Token' }).click();
	await expect.poll(() => token.inputValue()).not.toBe(first);
	const second = await token.inputValue();
	expect(await whoAmI(second)).toBe(user.email);
	expect(await whoAmI(first)).toBe(401);

	await page.getByRole('button', { name: 'Remove Token' }).click();
	await page.getByRole('dialog', { name: 'Remove Token' }).getByRole('button', { name: 'Remove Token' }).click();
	await expect.poll(async () => (await api.call<{ token: string | null }>('GET', `/users/${user.id}?fields=token`)).token).toBeNull();
	expect(await whoAmI(second)).toBe(401);
});

test('TFA: a password user turns it on with the OTP of the shown secret, then off with an OTP (FR-081)', async ({ page }) => {
	const user: TestUser = await fixtures.user('tfa-self', { role: adminRole });
	await signIn(page, user);
	await page.goto('/admin/users/me');
	await expect(page).toHaveURL(new RegExp(`/admin/users/${user.id}$`));

	const checkbox = page.getByRole('checkbox', { name: /Two-Factor Authentication|Disabled|Enabled/ }).first();
	await checkbox.click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Password', { exact: true }).fill(user.password);
	await dialog.getByRole('button', { name: 'Next' }).click();

	const secret = (await dialog.getByTestId('tfa-secret').textContent())!.trim();
	await dialog.getByLabel('One-Time Password', { exact: true }).fill(authenticator.generate(secret));
	await dialog.getByRole('button', { name: 'Done' }).click();
	await expect(dialog).toBeHidden();
	await expect
		.poll(async () => (await api.call<{ tfa_secret: string | null }>('GET', `/users/${user.id}?fields=tfa_secret`)).tfa_secret)
		.not.toBeNull();

	await checkbox.click();
	const disable = page.getByRole('dialog', { name: 'Enter the OTP to disable 2FA' });
	await disable.getByLabel('One-Time Password', { exact: true }).fill(authenticator.generate(secret));
	await disable.getByRole('button', { name: 'Disable 2FA' }).click();
	await expect(disable).toBeHidden();
	await expect
		.poll(async () => (await api.call<{ tfa_secret: string | null }>('GET', `/users/${user.id}?fields=tfa_secret`)).tfa_secret)
		.toBeNull();
});

test('TFA: an admin turns it off for another user without an OTP (FR-082, CHK022)', async ({ page }) => {
	const user: TestUser = await fixtures.user('tfa-other', { role: adminRole, tfa_secret: TFA_SECRET });
	await signIn(page, ADMIN);
	await openUsers(page, `/users/${user.id}`);

	const checkbox = page.getByRole('checkbox', { name: /Two-Factor Authentication|Enabled/ }).first();
	await expect(checkbox).toBeChecked();
	await checkbox.click();
	const disable = page.getByRole('dialog', { name: 'Disable 2FA' });
	await disable.getByRole('button', { name: 'Disable 2FA' }).click();
	await expect(disable).toBeHidden();
	await expect
		.poll(async () => (await api.call<{ tfa_secret: string | null }>('GET', `/users/${user.id}?fields=tfa_secret`)).tfa_secret)
		.toBeNull();
});
