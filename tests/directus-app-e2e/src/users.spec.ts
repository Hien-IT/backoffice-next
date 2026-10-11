// Feature 004 (FR-106, SC-008, T076): the User module of the Directus app through the proxy writes the same rows as
// Directus alone: create a user with a role, edit it, invite an email, delete the user.
import { expect, test } from '@playwright/test';
import { dismissOwnerDialog, field, save } from './helpers/app.js';
import { closeHostDb, hostDb } from './helpers/db-rows.js';
import { bothRuns } from './helpers/scenario.js';

let roleName: string;

test.beforeAll(async () => {
	roleName = `e2e-users-role-${Date.now().toString(36)}`;
	await hostDb()('directus_roles').insert({ id: crypto.randomUUID(), name: roleName, icon: 'badge' });
});

test.afterAll(async () => {
	await hostDb()('directus_users').where('email', 'like', 'e2e-%').delete();
	await hostDb()('directus_roles').where({ name: roleName }).delete();
	await closeHostDb();
});

test('create, edit, invite and delete users', async ({ browser }) => {
	const changes = await bothRuns(browser, async (page, url, tag) => {
		// Create with first name, email, password and role.
		await page.goto(`${url}/admin/users/+`);
		await dismissOwnerDialog(page);
		await field(page, 'First Name').locator('input').fill('E2E');
		await field(page, 'Email').locator('input').fill(`${tag}@example.com`);
		await field(page, 'Password').locator('input').fill('e2e-password-1');

		await field(page, 'Role').locator('.many-to-one > button').click();
		const drawer = page.locator('.v-drawer').last();
		await drawer.locator('button.icon-search').click();
		await drawer.locator('input[placeholder="Search Items..."]').fill(roleName);
		await drawer.locator('tr.table-row', { hasText: roleName }).click();
		await drawer
			.locator('button')
			.filter({ has: page.locator('i[data-icon="check"]') })
			.first()
			.click();

		const created = page.waitForResponse((r) => r.url().includes('/users') && r.request().method() === 'POST');
		await save(page);
		const id = ((await (await created).json()) as any).data.id as string;

		// Edit the last name.
		await page.goto(`${url}/admin/users/${id}`);
		await dismissOwnerDialog(page);
		await field(page, 'Last Name').locator('input').fill('Edited');
		const edited = page.waitForResponse((r) => r.url().includes(`/users/${id}`) && r.request().method() === 'PATCH');
		await save(page);
		expect((await edited).status()).toBe(200);

		// Invite an email with the role.
		await page.goto(`${url}/admin/users`);
		await dismissOwnerDialog(page);
		await page
			.locator('header button')
			.filter({ has: page.locator('i[data-icon="person_add"]') })
			.click();
		const dialog = page.locator('.v-card', { hasText: 'Invite Users' });
		await dialog.locator('textarea').fill(`${tag}-invited@example.com`);
		await dialog.locator('.v-select').click();
		await page.getByText(roleName, { exact: true }).last().click();
		const invited = page.waitForResponse((r) => r.url().includes('/users/invite'));
		await dialog.getByRole('button', { name: 'Invite' }).click();
		expect((await invited).status()).toBe(204);

		// Delete the created user.
		await page.goto(`${url}/admin/users/${id}`);
		await dismissOwnerDialog(page);
		await page
			.locator('header button')
			.filter({ has: page.locator('i[data-icon="delete"]') })
			.click();
		const deleted = page.waitForResponse((r) => r.url().includes(`/users/${id}`) && r.request().method() === 'DELETE');
		await page.locator('.v-card').getByRole('button', { name: 'Delete' }).click();
		expect((await deleted).status()).toBe(204);
	});

	expect(JSON.stringify((changes['prx'] as any).directus_users.added)).toContain('e2e-<run>-invited@example.com');
	expect((changes['prx'] as any).activity.length).toBeGreaterThan(3);
	expect(changes['prx']).toEqual(changes['dir']);
});
