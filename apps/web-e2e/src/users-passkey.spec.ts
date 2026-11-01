// Spec 029 (US2, US3, T047): the Passkeys card of the user page with a CDP virtual authenticator, chromium only. At
// proxy-api the pages open on http://localhost:8162 (RP ID localhost of the backoffice-api-passkey replica): add with the
// password and a name, rename, delete; an admin deletes another user's passkey; none for an SSO user. At proxy-directus
// (the API is Directus) and cors (another host than the RP ID) the card is not there.
import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, e2eConfig, passkeyWebUrl } from './helpers/config.js';
import { Fixtures, type TestUser } from './helpers/fixtures.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';
import { openOwnPage } from './helpers/users.js';
import { addVirtualAuthenticator } from './helpers/webauthn.js';

const LIVE = e2eConfig === 'proxy-api';

/** Like login.spec.ts: the sign-out has finished once the login page shows reason=SIGN_OUT. */
async function signOut(page: Page) {
	await page.goto('/admin/logout');
	await expect(page).toHaveURL(/reason=SIGN_OUT/);
}

test.use({ baseURL: passkeyWebUrl, apiUrl: new URL(passkeyWebUrl).origin });
test.skip(({ browserName }) => browserName !== 'chromium', 'WebAuthn virtual authenticator is chromium only');

let api: AdminApi;
let fixtures: Fixtures;
let owner: TestUser;
let sso: TestUser;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	fixtures = new Fixtures(api);
	// Admin so the own page shows every field the card needs (provider) without extra permissions.
	owner = await fixtures.user('passkey-owner', { role: await fixtures.role('passkey owner', { admin: true }) });
	sso = await fixtures.user('passkey-sso', { provider: 'openid', external_identifier: `passkey-sso-${Date.now()}` });
});

// Outside chromium every test is skipped and beforeAll does not run, but afterAll does (CI 41305198458).
test.afterAll(async () => {
	await fixtures?.cleanup();
});

async function signIn(page: Page, user: { email: string; password: string }) {
	await page.goto('/admin/login');
	await login(page, user);
	await expect(page).not.toHaveURL(/\/login/);
}

const card = (page: Page) => page.getByTestId('user-passkeys');

async function scan(page: Page) {
	await page.addStyleTag({
		content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
	});
	const results = await new AxeBuilder({ page })
		.include('[data-testid="user-passkeys"], [role="dialog"]')
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
		.analyze();
	return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
}

test('no Passkeys card where passkeys cannot be used (proxy-directus, cors)', async ({ page }) => {
	test.skip(LIVE, 'proxy-api shows the card');
	await signIn(page, ADMIN);
	await openOwnPage(page);
	await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
	await expect(card(page)).toHaveCount(0);
});

test('add with the password and a name, rename, delete (US2)', async ({ page }) => {
	test.skip(!LIVE, 'passkeys need the backoffice-api-passkey replica of proxy-api');
	const authenticator = await addVirtualAuthenticator(page);
	await signIn(page, owner);
	await openOwnPage(page);

	await expect(card(page)).toBeVisible();
	await expect(card(page)).toContainText('No passkeys yet');
	expect(await scan(page)).toEqual([]);

	await card(page).getByRole('button', { name: 'Add passkey' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toContainText('Enter your password to add a passkey');

	await dialog.getByLabel('Password', { exact: true }).fill('wrong-password');
	await page.keyboard.press('Enter');
	await expect(dialog.getByRole('alert')).toBeVisible();
	expect(await authenticator.credentialCount()).toBe(0);

	await dialog.getByLabel('Password', { exact: true }).fill(owner.password);
	await page.keyboard.press('Enter');
	const name = dialog.getByLabel('Name', { exact: true });
	await expect(name).toHaveValue(/^Passkey on /);
	expect(await scan(page)).toEqual([]);

	await name.fill('E2E laptop');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toHaveCount(0);
	await expect(card(page)).toContainText('E2E laptop');
	await expect(card(page)).toContainText('Never used');
	expect(await authenticator.credentialCount()).toBe(1);

	await expect
		.poll(async () =>
			(await api.call<{ name: string }[]>('GET', `/backoffice/users/${owner.id}/passkeys`)).map((p) => p.name),
		)
		.toEqual(['E2E laptop']);

	await card(page).getByRole('button', { name: 'Passkey actions: E2E laptop' }).click();
	await page.getByRole('menuitem', { name: 'Rename' }).click();
	await dialog.getByLabel('Name', { exact: true }).fill('Work');
	await page.keyboard.press('Enter');
	await expect(card(page)).toContainText('Work');

	await card(page).getByRole('button', { name: 'Passkey actions: Work' }).click();
	await page.getByRole('menuitem', { name: 'Delete passkey' }).click();
	await expect(dialog).toContainText('Delete "Work"?');
	await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(card(page)).toContainText('No passkeys yet');
});

test("an admin sees another user's passkeys and deletes one; no card for an SSO user (US3)", async ({ page }) => {
	test.skip(!LIVE, 'passkeys need the backoffice-api-passkey replica of proxy-api');
	const authenticator = await addVirtualAuthenticator(page);
	await signIn(page, owner);
	await openOwnPage(page);
	await card(page).getByRole('button', { name: 'Add passkey' }).click();
	await page.getByRole('dialog').getByLabel('Password', { exact: true }).fill(owner.password);
	await page.keyboard.press('Enter');
	await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Phone');
	await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
	await expect(card(page)).toContainText('Phone');
	expect(await authenticator.credentialCount()).toBe(1);

	await signOut(page);
	await signIn(page, ADMIN);
	await page.goto(`/admin/users/${owner.id}`);
	await expect(card(page)).toContainText('Phone');
	await expect(card(page).getByRole('button', { name: 'Add passkey' })).toHaveCount(0);

	await card(page).getByRole('button', { name: 'Delete passkey: Phone' }).click();
	await expect(page.getByRole('dialog')).toContainText('The user will have to add a new passkey');
	await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(card(page)).toContainText('No passkeys yet');

	await page.goto(`/admin/users/${sso.id}`);
	await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
	await expect(card(page)).toHaveCount(0);
});
