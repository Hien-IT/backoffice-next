// US4 (T054, contracts/e2e.md §2): LDAP and OpenID Connect sign-in against the `sso` pair of the parity environment,
// once with Directus 11.17.4 (8955) and once with the new API (8956). The pair is not behind the proxies, so the spec
// runs in the `cors` configuration only (web app on http://localhost:8181, config.json pointed at the pair). The test
// IdP is http://idp:9000 for the APIs; the spec runs the authorize step against 127.0.0.1:6110 for a chosen user (the
// IdP approves automatically) and hands the browser the callback URL.
import { randomBytes } from 'node:crypto';
import type { Page } from '@playwright/test';
import { Client } from 'ldapts';
import { AdminApi } from './helpers/api.js';
import { isCors } from './helpers/config.js';
import { Fixtures, TFA_SECRET, totp } from './helpers/fixtures.js';
import { expect, test } from './helpers/requests.js';

const IDP = 'http://127.0.0.1:6110';
const LDAP_URL = 'ldap://127.0.0.1:6109';
const USER_BASE_DN = 'ou=users,dc=my-domain,dc=com';
const LDAP_PASSWORD = 'web-e2e-ldap-password';

const PAIRS = [
	['Directus', 'http://127.0.0.1:8955'],
	['new API', 'http://127.0.0.1:8956'],
] as const;

test.skip(!isCors, 'the sso pair is reached from another site: cors configuration only');

async function idpUser(sub: string, claims: Record<string, unknown>) {
	// nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request -- the test IdP of the sso profile, local HTTP only
	const res = await fetch(`${IDP}/__users`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ sub, claims }),
	});

	expect(res.status).toBe(204);
}

async function ldapUser(uid: string) {
	const ldap = new Client({ url: LDAP_URL });
	await ldap.bind('cn=Manager,dc=my-domain,dc=com', 'secret');

	// A fresh OpenLDAP has no tree yet (like tests/parity/src/auth/sso-ldap.test.ts, entries that exist are kept).
	const add = async (dn: string, entry: Record<string, string | string[]>) =>
		ldap.add(dn, entry).catch((err: { code?: number }) => {
			if (err?.code !== 68) throw err; // entryAlreadyExists
		});

	await add('dc=my-domain,dc=com', { objectClass: ['top', 'domain', 'dcObject'], dc: 'my-domain' });
	await add('cn=Manager,dc=my-domain,dc=com', {
		objectClass: ['top', 'person', 'organizationalPerson'],
		cn: 'Manager',
		sn: 'Manager',
	});
	await add(USER_BASE_DN, { objectClass: ['top', 'organizationalUnit'], ou: 'users' });
	// AUTH_LDAP_GROUP_DN of env/profile-sso.env: the APIs search it at login.
	await add('ou=groups,dc=my-domain,dc=com', { objectClass: ['top', 'organizationalUnit'], ou: 'groups' });
	await ldap.add(`cn=${uid},${USER_BASE_DN}`, {
		objectClass: ['top', 'inetOrgPerson', 'organizationalPerson', 'person'],
		cn: uid,
		sn: 'E2E',
		givenName: 'LDAP',
		mail: `${uid}@example.com`,
		uid,
		userPassword: LDAP_PASSWORD,
	});
	await ldap.unbind();
}

/** The app talks to `apiUrl`; the IdP authorize step is answered for `sub`. */
async function openLogin(page: Page, apiUrl: string, sub?: string, query = '') {
	await page.route('**/admin/config.json', (route) => route.fulfill({ json: { apiUrl } }));

	if (sub) {
		// GET /auth/login/oidc answers 302 to http://idp:9000 (the name the APIs use); the IdP step runs here against
		// 127.0.0.1:6110 for `sub`, and the browser gets the API's answer (state cookie included) pointing at the callback.
		await page.route(
			(url) => url.href.startsWith(`${apiUrl}/auth/login/oidc`) && !url.pathname.endsWith('/callback'),
			async (route) => {
				const begin = await route.fetch({ maxRedirects: 0 });
				const authorize = new URL(begin.headers()['location']!);
				authorize.protocol = 'http:';
				authorize.host = new URL(IDP).host;
				authorize.searchParams.set('user', sub);
				const approved = await fetch(authorize, { redirect: 'manual' });
				await route.fulfill({
					response: begin,
					headers: { ...begin.headers(), location: approved.headers.get('location')! },
				});
			},
		);
	}

	await page.goto(`/admin/login${query}`);
	await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
}

for (const [name, apiUrl] of PAIRS) {
	test.describe(`sso pair, ${name}`, () => {
		test.use({ apiUrl });

		let fixtures: Fixtures;
		let role: string;

		test.beforeAll(async ({ playwright }) => {
			fixtures = new Fixtures(new AdminApi(await playwright.request.newContext(), apiUrl));
			// SSO and LDAP logins put the user in AUTH_*_DEFAULT_ROLE_ID of env/profile-sso.env (user info sync).
			role = await fixtures.fixedRole('d70c0943-5b55-4c5d-a613-f539a27a57f5', `sso default ${name}`);
		});

		test.afterAll(() => fixtures.cleanup());

		test('the provider select lists local and LDAP providers; SSO buttons link to the API (US4-1, FR-040, FR-041)', async ({
			page,
		}) => {
			await openLogin(page, apiUrl);

			await page.getByRole('combobox', { name: 'Provider' }).click();
			for (const option of ['Default', 'Local2', 'LDAP']) {
				await expect(page.getByRole('option', { name: option, exact: true })).toBeVisible();
			}
			await page.keyboard.press('Escape');

			const oidc = page.getByRole('link', { name: 'Log In with OIDC' });
			const href = new URL((await oidc.getAttribute('href'))!);
			expect(`${href.origin}${href.pathname}`).toBe(`${apiUrl}/auth/login/oidc`);
			expect(href.searchParams.get('redirect')).toMatch(/^http:\/\/localhost:8181\/admin\/login\?continue/);
		});

		test('LDAP: identifier and password through the LDAP provider (US4-1, FR-043)', async ({ page }) => {
			const uid = `web-e2e-ldap-${randomBytes(3).toString('hex')}`;
			await ldapUser(uid);
			await fixtures.user(`ldap-${uid}`, {
				email: `${uid}@example.com`,
				provider: 'ldap',
				external_identifier: `cn=${uid},${USER_BASE_DN}`,
				role,
				password: null,
			});

			await openLogin(page, apiUrl);
			await page.getByRole('combobox', { name: 'Provider' }).click();
			await page.getByRole('option', { name: 'LDAP', exact: true }).click();
			await page.getByLabel('Identifier', { exact: true }).fill(uid);
			await page.getByLabel('Password', { exact: true }).fill(LDAP_PASSWORD);
			await page.getByRole('button', { name: 'Sign In', exact: true }).click();

			await expect(page).toHaveURL(/\/admin\/content$/);
		});

		test('OpenID Connect: through the IdP and back with ?continue into the app (US4-2)', async ({ page }) => {
			const sub = `web-e2e-oidc-${randomBytes(3).toString('hex')}`;
			const email = `${sub}@example.com`;
			await idpUser(sub, { email, email_verified: true, given_name: 'OIDC', family_name: 'E2E' });
			await fixtures.user(`oidc-${sub}`, { email, provider: 'oidc', external_identifier: sub, role, password: null });

			await openLogin(page, apiUrl, sub);
			await page.getByRole('link', { name: 'Log In with OIDC' }).click();

			await expect(page).toHaveURL(/\/admin\/content$/);
		});

		test('OpenID Connect with TFA: INVALID_OTP comes back, the OTP goes to the saved provider (US4-2, FR-042)', async ({
			page,
		}) => {
			const sub = `web-e2e-oidc-tfa-${randomBytes(3).toString('hex')}`;
			const email = `${sub}@example.com`;
			await idpUser(sub, { email, email_verified: true });
			await fixtures.user(`oidc-tfa-${sub}`, {
				email,
				provider: 'oidc',
				external_identifier: sub,
				role,
				password: null,
				tfa_secret: TFA_SECRET,
			});

			await openLogin(page, apiUrl, sub);
			await page.getByRole('link', { name: 'Log In with OIDC' }).click();

			await expect(page).toHaveURL(/reason=INVALID_OTP/);
			await page.getByLabel('One-Time Password', { exact: true }).fill(totp());
			await expect(page).toHaveURL(/\/admin\/content$/);
		});

		test('an SSO error code is shown translated (US4-2, FR-042)', async ({ page }) => {
			await openLogin(page, apiUrl, undefined, '?reason=INVALID_PROVIDER');
			await expect(page.getByRole('alert')).toContainText(/provider/i);
		});
	});
}
