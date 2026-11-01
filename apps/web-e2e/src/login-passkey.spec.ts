// Spec 029 (US1, T048): sign in with a passkey, chromium only, with a CDP virtual authenticator on
// http://localhost:8162 (proxy-api, the backoffice-api-passkey replica). A TFA user is not asked for the OTP; a user of a
// role enforcing TFA is not sent to /tfa-setup, also after a reload, while a password sign-in still is (D-207.3,
// D-207.5); a cancelled dialog leaves the form as it was. At proxy-directus and cors there is no passkey button.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { e2eConfig, passkeyWebUrl } from './helpers/config.js';
import { Fixtures, TFA_SECRET, type TestUser, totp } from './helpers/fixtures.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';
import { openOwnPage } from './helpers/users.js';
import { addVirtualAuthenticator, type VirtualAuthenticator } from './helpers/webauthn.js';

const LIVE = e2eConfig === 'proxy-api';
// After a sign-in the app opens the last page of the user (last_page, like DR): Content, or the own user page where the
// passkey was added when that page was saved as last_page before the sign-out (CI 41305198458).
const SIGNED_IN = /\/admin\/(content|users)(\/[^/?#]+)?$/;

/** Like login.spec.ts: the sign-out has finished once the login page shows reason=SIGN_OUT. */
async function signOut(page: Page) {
	await page.goto('/admin/logout');
	await expect(page).toHaveURL(/reason=SIGN_OUT/);
}

test.use({ baseURL: passkeyWebUrl, apiUrl: new URL(passkeyWebUrl).origin });
test.skip(({ browserName }) => browserName !== 'chromium', 'WebAuthn virtual authenticator is chromium only');

let api: AdminApi;
let fixtures: Fixtures;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	fixtures = new Fixtures(api);
});

// Outside chromium every test is skipped and beforeAll does not run, but afterAll does (CI 41305198458).
test.afterAll(async () => {
	await fixtures?.cleanup();
});

const passkeyButton = (page: Page) => page.getByRole('button', { name: 'Sign in with a passkey' });

async function openLogin(page: Page) {
	await page.goto('/admin/login');
	await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
}

/** Signs in with the password (and OTP), adds a passkey from the own page, signs out. */
async function registerPasskey(page: Page, user: TestUser, otp?: string) {
	await openLogin(page);
	await login(page, { ...user, ...(otp ? { otp } : {}) });
	await expect(page).not.toHaveURL(/\/login/);
	await openOwnPage(page);
	await page.getByTestId('user-passkeys').getByRole('button', { name: 'Add passkey' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Password', { exact: true }).fill(user.password);
	await page.keyboard.press('Enter');
	await dialog.getByLabel('Name', { exact: true }).fill('E2E');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByTestId('user-passkeys')).toContainText('E2E');
	await signOut(page);
}

test('no passkey button where passkeys cannot be used (proxy-directus, cors)', async ({ page }) => {
	test.skip(LIVE, 'proxy-api shows the button');
	await openLogin(page);
	// The probe has answered once the page settled.
	await page.waitForLoadState('networkidle');
	await expect(passkeyButton(page)).toHaveCount(0);
});

test.describe('proxy-api', () => {
	test.skip(!LIVE, 'passkeys need the backoffice-api-passkey replica of proxy-api');

	let authenticator: VirtualAuthenticator;

	test.beforeEach(async ({ page }) => {
		authenticator = await addVirtualAuthenticator(page);
	});

	test('a TFA user signs in with the passkey without the OTP; a cancelled dialog changes nothing (US1)', async ({
		page,
	}) => {
		const user = await fixtures.user('passkey-tfa', {
			role: await fixtures.role('passkey tfa', { admin: true }),
			tfa_secret: TFA_SECRET,
		});

		// Cancel first: an authenticator with no credential for this RP answers NotAllowedError, as a cancelled dialog does.
		await openLogin(page);
		await passkeyButton(page).click();
		await expect(passkeyButton(page)).toBeEnabled();
		await expect(passkeyButton(page)).toBeFocused();
		await expect(page.getByRole('alert')).toHaveCount(0);
		await expect(page).toHaveURL(/\/admin\/login/);

		await registerPasskey(page, user, totp());
		expect(await authenticator.credentialCount()).toBe(1);

		await openLogin(page);
		await passkeyButton(page).click();
		await expect(page).toHaveURL(SIGNED_IN);
		await expect(page.getByLabel('One-Time Password', { exact: true })).toHaveCount(0);
	});

	test('a role enforcing TFA: no /tfa-setup after a passkey sign-in, also after a reload; a password sign-in still goes there (D-207.5)', async ({
		page,
	}) => {
		const role = await fixtures.role('passkey enforce', { admin: true });
		const user = await fixtures.user('passkey-enforce', { role });
		await registerPasskey(page, user);

		// Enforce TFA now, so the passkey could be added from the own page first.
		const [access] = await api.call<{ policy: string }[]>('GET', `/access?filter[role][_eq]=${role}&fields=policy`);
		await api.call('PATCH', `/policies/${access!.policy}`, { data: { enforce_tfa: true } });
		await api.call('POST', '/utils/cache/clear');

		await openLogin(page);
		await passkeyButton(page).click();
		await expect(page).toHaveURL(SIGNED_IN);
		await page.reload();
		await expect(page).toHaveURL(SIGNED_IN);
		await expect(page).not.toHaveURL(/tfa-setup/);

		await signOut(page);
		await openLogin(page);
		await login(page, user);
		await expect(page).toHaveURL(/\/admin\/tfa-setup/);
	});
});
