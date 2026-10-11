// Feature 004 (FR-106, SC-008, T077): Settings > Roles of the Directus app through the proxy writes the same rows as
// Directus alone: create a role, set its parent, attach a policy, save, delete.
import { expect, test } from '@playwright/test';
import { deleteOpenItem, field, pickInDrawer, save } from './helpers/app.js';
import { closeHostDb, hostDb } from './helpers/db-rows.js';
import { bothRuns } from './helpers/scenario.js';

const run = Date.now().toString(36);
const parentName = `e2e-roles-parent-${run}`;
const policyName = `e2e-roles-policy-${run}`;

test.beforeAll(async () => {
	await hostDb()('directus_roles').insert({ id: crypto.randomUUID(), name: parentName, icon: 'badge' });
	await hostDb()('directus_policies').insert({ id: crypto.randomUUID(), name: policyName, icon: 'badge' });
});

test.afterAll(async () => {
	await hostDb()('directus_access')
		.whereIn('policy', hostDb()('directus_policies').select('id').where({ name: policyName }))
		.delete();
	await hostDb()('directus_roles').where('name', 'like', 'e2e-%').delete();
	await hostDb()('directus_policies').where({ name: policyName }).delete();
	await closeHostDb();
});

test('create a role, set its parent, attach a policy, delete it', async ({ browser }) => {
	const changes = await bothRuns(browser, async (page, url, tag) => {
		await page.goto(`${url}/admin/settings/roles/+`);
		await page.getByPlaceholder('Role Name...').fill(`${tag}-role`);
		const created = page.waitForResponse((r) => r.url().includes('/roles') && r.request().method() === 'POST');
		await page.locator('.v-card').getByRole('button', { name: 'Save' }).click();
		const id = ((await (await created).json()) as any).data.id as string;
		await expect(page).toHaveURL(new RegExp(`/admin/settings/roles/${id}`));

		await field(page, 'Parent Role').locator('.many-to-one > button').click();
		await pickInDrawer(page, parentName);

		await field(page, 'Policies').getByRole('button', { name: 'Add Existing' }).click();
		await pickInDrawer(page, policyName);

		const patched = page.waitForResponse((r) => r.url().includes(`/roles/${id}`) && r.request().method() === 'PATCH');
		await save(page);
		expect((await patched).status()).toBe(200);

		await page.goto(`${url}/admin/settings/roles/${id}`);
		const deleted = page.waitForResponse((r) => r.url().includes(`/roles/${id}`) && r.request().method() === 'DELETE');
		await deleteOpenItem(page);
		expect((await deleted).status()).toBe(204);
	});

	expect((changes['prx'] as any).activity.length).toBeGreaterThan(2);
	expect(changes['prx']).toEqual(changes['dir']);
});
