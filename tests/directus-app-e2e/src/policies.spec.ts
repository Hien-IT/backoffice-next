// Feature 004 (FR-106, SC-008, T078): Settings > Access Policies of the Directus app through the proxy writes the same
// rows as Directus alone: create an app access policy, a custom read permission on directus_users (filter on
// $CURRENT_USER, some fields), full update, attach a user, rename, delete.
import { expect, test } from '@playwright/test';
import { deleteOpenItem, field, pickInDrawer, save } from './helpers/app.js';
import { closeHostDb, hostDb } from './helpers/db-rows.js';
import { bothRuns } from './helpers/scenario.js';

const run = Date.now().toString(36);
const userEmail = `e2e-policies-user-${run}@example.com`;

test.beforeAll(async () => {
	await hostDb()('directus_users').insert({ id: crypto.randomUUID(), email: userEmail, status: 'active' });
});

test.afterAll(async () => {
	await hostDb()('directus_access')
		.whereIn('user', hostDb()('directus_users').select('id').where({ email: userEmail }))
		.delete();
	await hostDb()('directus_users').where({ email: userEmail }).delete();
	await hostDb()('directus_policies').where('name', 'like', 'e2e-%').delete();
	await closeHostDb();
});

test('create a policy with permissions, attach a user, rename, delete', async ({ browser }) => {
	const changes = await bothRuns(browser, async (page, url, tag) => {
		await page.goto(`${url}/admin/settings/policies/+`);
		const dialog = page.locator('.v-card', { hasText: 'Create Policy' });
		await dialog.getByPlaceholder('Policy Name...').fill(`${tag}-policy`);
		// App Access (the first of the two checkboxes).
		await dialog.getByRole('checkbox').first().click();
		const created = page.waitForResponse((r) => r.url().endsWith('/policies') && r.request().method() === 'POST');
		await dialog.getByRole('button', { name: 'Save' }).click();
		const id = ((await (await created).json()) as any).data.id as string;
		await expect(page).toHaveURL(new RegExp(`/admin/settings/policies/${id}`));

		const users = page.locator('tr.permissions-row[data-collection="directus_users"]');

		// Read: custom, the prefilled id rule on $CURRENT_USER, two fields.
		await users.getByRole('button', { name: 'Read' }).click();
		await page.locator('.v-menu-content .v-list-item', { hasText: 'Use Custom' }).click();
		const drawer = page.locator('.v-drawer').last();
		await drawer.locator('input[placeholder="--"]').first().fill('$CURRENT_USER');
		await drawer.getByRole('button', { name: 'Field Permissions' }).click();
		// Fields the app minimal permissions do not already grant (those checkboxes are disabled).
		for (const name of ['Text Direction', 'Email Notifications']) {
			await drawer.getByRole('checkbox', { name }).click();
		}
		await drawer
			.locator('header button, .header-bar button')
			.filter({ has: page.locator('i[data-icon="check"]') })
			.first()
			.click();

		// Update: all access.
		await users.getByRole('button', { name: 'Update' }).click();
		await page.locator('.v-menu-content .v-list-item', { hasText: 'All Access' }).click();

		// A user through directus_access.
		await field(page, 'Users').getByRole('button', { name: 'Add Existing' }).click();
		await pickInDrawer(page, userEmail);

		const patched = page.waitForResponse(
			(r) => r.url().includes(`/policies/${id}`) && r.request().method() === 'PATCH',
		);
		await save(page);
		expect((await patched).status()).toBe(200);

		// Rename.
		await page.goto(`${url}/admin/settings/policies/${id}`);
		await field(page, 'Policy Name').locator('input').fill(`${tag}-renamed`);
		const renamed = page.waitForResponse(
			(r) => r.url().includes(`/policies/${id}`) && r.request().method() === 'PATCH',
		);
		await save(page);
		expect((await renamed).status()).toBe(200);

		// Saving quits to the list: open the policy again to delete it.
		await page.goto(`${url}/admin/settings/policies/${id}`);
		const deleted = page.waitForResponse(
			(r) => r.url().includes(`/policies/${id}`) && r.request().method() === 'DELETE',
		);
		await deleteOpenItem(page);
		expect((await deleted).status()).toBe(204);
	});

	expect((changes['prx'] as any).activity.length).toBeGreaterThan(2);
	expect(changes['prx']).toEqual(changes['dir']);
});
