// Feature 010 (spec FR-012, FR-103, contracts/parity.md §7, research R13): the first-run screen of the Directus app
// on the setup pair (profile `setup`, its own Postgres with no user). Directus alone answers POST /server/setup in the
// first run; in the second, page.route sends that request to the Backoffice app of the pair. Both runs start from the
// same empty database and must leave the same rows in the five tables setup writes.
import { expect, type Page, test } from '@playwright/test';
import knex, { type Knex } from 'knex';

const DIRECTUS = 'http://127.0.0.1:10455';
const BACKOFFICE = 'http://127.0.0.1:10456';
const OWNER = ['project_owner', 'project_usage', 'org_name', 'product_updates', 'project_status'];
const DATES = new Set(['date_created', 'date_updated', 'last_access']);

const db: Knex = knex({
	client: 'pg',
	connection: { database: 'directus', user: 'postgres', password: 'secret', host: '127.0.0.1', port: 6112 },
});

let base: Record<'roles' | 'policies' | 'access', string[]>;
const ids = async (table: string) => (await db.select('id').from(table)).map((row) => String(row['id']));

/** Removes what a setup wrote, so the database has no user again (like system/setup.test.ts of the parity suite). */
async function reset() {
	await db('directus_sessions').delete();
	await db('directus_access').whereNotIn('id', base.access).delete();
	await db('directus_users').delete();
	await db('directus_policies').whereNotIn('id', base.policies).delete();
	await db('directus_roles').whereNotIn('id', base.roles).delete();
	await db('directus_settings').update(
		Object.fromEntries(OWNER.map((c) => [c, c === 'product_updates' ? false : null])),
	);
}

/** The rows written since `base`, ids as markers in order of appearance, dates and the password hash as markers. */
async function written() {
	const rows = {
		roles: await db('directus_roles').whereNotIn('id', base.roles).orderBy('name'),
		policies: await db('directus_policies').whereNotIn('id', base.policies).orderBy('name'),
		access: await db('directus_access').whereNotIn('id', base.access),
		users: await db('directus_users').select('*'),
		settings: await db('directus_settings').select(OWNER).first(),
	};
	const markers = new Map<string, string>();
	const isId = (v: unknown) =>
		typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);

	return JSON.parse(JSON.stringify(rows), (key, value) => {
		if (DATES.has(key) && value !== null) return '<date>';
		if (key === 'password' && typeof value === 'string') return '<argon2>';
		if (key === 'token' && typeof value === 'string') return '<token>';
		if (isId(value)) {
			if (!markers.has(value)) markers.set(value, `<id${markers.size + 1}>`);
			return markers.get(value);
		}

		return value;
	});
}

async function fillSetup(page: Page) {
	await page.getByRole('textbox', { name: 'First Name' }).fill('Ada');
	await page.getByRole('textbox', { name: 'Last Name' }).fill('Setup');
	await page.getByRole('textbox', { name: 'Email Address' }).fill('setup-e2e@example.com');
	await page.getByRole('textbox', { name: 'Password' }).nth(0).fill('setup-password-1');
	await page.getByRole('textbox', { name: 'Password' }).nth(1).fill('setup-password-1');
	await page.locator('.v-input', { has: page.locator('input[placeholder="Select an item..."]') }).click();
	await page
		.getByRole('button')
		.filter({ hasText: /Personal/ })
		.first()
		.click();
	await page.getByRole('checkbox', { name: /I accept the terms/ }).click();
}

test.beforeAll(async () => {
	base = {
		roles: await ids('directus_roles'),
		policies: await ids('directus_policies'),
		access: await ids('directus_access'),
	};
	await reset();
});

test.afterAll(async () => {
	await reset();
	await db.destroy();
});

test('first-run setup: the admin account screen writes the same rows at Directus and at the new app', async ({
	browser,
}) => {
	const runs: Record<string, unknown> = {};

	for (const app of ['directus', 'backoffice'] as const) {
		await reset();
		const context = await browser.newContext();
		const page = await context.newPage();

		try {
			if (app === 'backoffice') {
				// The app calls its own origin: send POST /server/setup to the Backoffice app of the pair instead.
				await page.route('**/server/setup', async (route) => {
					const response = await route.fetch({ url: `${BACKOFFICE}/server/setup` });
					await route.fulfill({ response });
				});
			}

			await page.goto(`${DIRECTUS}/admin`);
			await expect(page).toHaveURL(/\/admin\/setup$/, { timeout: 30_000 });
			await fillSetup(page);

			const setup = page.waitForResponse((r) => new URL(r.url()).pathname === '/server/setup');
			await page.getByRole('button', { name: /Launch Directus/ }).click();
			expect((await setup).status()).toBe(204);
			await expect(page).toHaveURL(/\/admin\/(content|login|users)/, { timeout: 30_000 });
		} finally {
			await context.close();
		}

		runs[app] = await written();
	}

	expect(runs['backoffice']).toEqual(runs['directus']);
	expect((runs['directus'] as any).users).toEqual([
		expect.objectContaining({ email: 'setup-e2e@example.com', first_name: 'Ada', status: 'active' }),
	]);
	expect((runs['directus'] as any).settings).toMatchObject({ project_owner: 'setup-e2e@example.com' });
});
