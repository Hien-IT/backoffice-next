// Feature 004 (FR-106, SC-008, T075): signing in through the reverse proxy, the app loads and the User module opens.
import { expect, test } from '@playwright/test';
import { dismissOwnerDialog } from './helpers/app.js';
import { hostDb, closeHostDb } from './helpers/db-rows.js';
import { ADMIN, login } from './helpers/login.js';

test.beforeEach(async () => {
	await hostDb()('directus_users').where({ email: ADMIN.email }).update({ last_page: null });
});

test.afterAll(closeHostDb);

test('sign in through the proxy, the app loads, the User module lists users', async ({ page, baseURL }) => {
	await login(page, baseURL!);
	await dismissOwnerDialog(page);

	await page.goto(`${baseURL}/admin/users`);
	await dismissOwnerDialog(page);
	await expect(page.getByText('admin@example.com').first()).toBeVisible({ timeout: 30_000 });
});
