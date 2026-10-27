// US5 (T060, contracts/e2e.md §2): password reset, invitation and first-run setup (no share page since spec 025). No
// mail is sent in the parity environment (D-23, D-33): tokens are signed with SECRET like
// directus/api/src/services/users.ts.
import knex, { type Knex } from 'knex';
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { CONTENT_URL, isCors } from './helpers/config.js';
import { closeHostDb, hostDb } from './helpers/db-rows.js';
import { Fixtures, PASSWORD, type TestUser } from './helpers/fixtures.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';
import { inviteToken, passwordResetToken } from './helpers/tokens.js';

const CONTACT_ADMIN = /administrator/i;
const NEW_PASSWORD = 'web-e2e-Reset-Password3';

let api: AdminApi;
let fixtures: Fixtures;
let role: string;
let resetUser: TestUser;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	fixtures = new Fixtures(api);
	role = await fixtures.role('password invite');
	resetUser = await fixtures.user('reset', { role });
});

test.afterAll(async () => {
	await fixtures.cleanup();
	await closeHostDb();
});

async function signIn(page: Page, user: { email: string; password: string }) {
	await page.goto('/admin/login');
	await login(page, user);
	await expect(page).toHaveURL(CONTENT_URL);
}

test('forgot password: request notice with the contact-administrator line (US5-1, D-42)', async ({ page }) => {
	await page.goto('/admin/reset-password');
	await page.getByLabel('Email', { exact: true }).fill(resetUser.email);
	await page.getByRole('button', { name: 'Reset' }).click();

	const status = page.getByRole('status');
	await expect(status.first()).toBeVisible();
	await expect(page.getByText(CONTACT_ADMIN)).toBeVisible();
});

test('reset with a token, then sign in with the new password (US5-2)', async ({ page }) => {
	const row = await hostDb()('directus_users').where({ id: resetUser.id }).first();
	const token = passwordResetToken(resetUser.email, row?.['password'] ?? null);

	await page.goto(`/admin/reset-password?token=${token}`);
	await expect(page.getByLabel('Email', { exact: true })).toHaveValue(resetUser.email);
	await page.getByLabel('Password', { exact: true }).fill(NEW_PASSWORD);
	await page.getByRole('button', { name: 'Reset' }).click();
	await expect(page.getByRole('link', { name: 'Sign In' }).first()).toBeVisible();

	await signIn(page, { email: resetUser.email, password: NEW_PASSWORD });
});

test('accept an invitation, then sign in; a broken token shows the error and the contact line (US5-3)', async ({
	page,
}) => {
	const invited = await fixtures.user('invited', { role, status: 'invited', password: null });

	await page.goto(`/admin/accept-invite?token=${inviteToken(invited.email)}`);
	await expect(page.getByLabel('Email', { exact: true })).toHaveValue(invited.email);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Create' }).click();
	await expect(page.getByText('Account Created Successfully')).toBeVisible();

	await signIn(page, { email: invited.email, password: PASSWORD });

	await page.goto('/admin/logout');
	await expect(page).toHaveURL(/reason=SIGN_OUT/);
	await page.goto('/admin/accept-invite?token=not-a-token');
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Create' }).click();
	await expect(page.getByRole('alert')).toBeVisible();
	await expect(page.getByText(CONTACT_ADMIN)).toBeVisible();
});

test('the register link target says registration is not available yet (D-44)', async ({ page }) => {
	await page.goto('/admin/register');
	await expect(page.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/admin/login');
});

// Backoffice (spec 025, FR-029, D-189.4): no share page; a share link is a private route like any other.
test('a share link /admin/shared/<id> has no page of its own: the sign-in page', async ({ page }) => {
	await page.goto('/admin/shared/0b9fd2a4-7c5e-4d31-9f0e-2a6f1d5e8c47');
	await expect(page).toHaveURL(/\/admin\/login\?redirect=/);
});

test.describe('first-run setup on the setup pair (own empty Postgres)', () => {
	// The setup pair (10455 Directus, 10456 new API) is another site for every web container: the cross-site
	// configuration reaches it (CORS for http://localhost:8181 in env/profile-setup.env).
	test.skip(!isCors, 'the setup pair is reached cross-site: cors configuration only');

	let setupDb: Knex;
	let base: Record<'roles' | 'policies' | 'access', string[]>;

	const ids = async (table: string) => (await setupDb.select('id').from(table)).map((row) => String(row['id']));

	test.beforeAll(async () => {
		setupDb = knex({
			client: 'pg',
			connection: { database: 'directus', user: 'postgres', password: 'secret', host: '127.0.0.1', port: 6112 },
		});
		base = {
			roles: await ids('directus_roles'),
			policies: await ids('directus_policies'),
			access: await ids('directus_access'),
		};
	});

	test.afterAll(async () => {
		// Back to a database without users, like tests/parity/src/system/setup.test.ts reset().
		await setupDb('directus_sessions').delete();
		await setupDb('directus_access').whereNotIn('id', base.access).delete();
		await setupDb('directus_users').delete();
		await setupDb('directus_policies').whereNotIn('id', base.policies).delete();
		await setupDb('directus_roles').whereNotIn('id', base.roles).delete();
		await setupDb('directus_settings').update({
			project_owner: null,
			project_usage: null,
			org_name: null,
			product_updates: false,
			project_status: null,
		});
		await setupDb.destroy();
	});

	for (const [name, apiUrl] of [['new API', 'http://127.0.0.1:10456']] as const) {
		test(`creates the first admin and signs in (${name}, US5-4, FR-053)`, async ({ page }) => {
			test.info().annotations.push({ type: 'apiUrl', description: apiUrl });
			await page.route('**/admin/config.json', (route) => route.fulfill({ json: { apiUrl } }));

			await page.goto('/admin/');
			await expect(page).toHaveURL(/\/admin\/setup$/);
			await page.getByLabel('First Name', { exact: true }).fill('Setup');
			await page.getByLabel('Last Name', { exact: true }).fill('Admin');
			await page.getByLabel('Admin Email', { exact: true }).fill('web-e2e-setup@example.com');
			await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
			await page.getByLabel('Confirm Password', { exact: true }).fill(PASSWORD);
			await page.getByRole('button', { name: 'Launch Backoffice' }).click();

			await expect(page).toHaveURL(CONTENT_URL);
		});
	}
});
