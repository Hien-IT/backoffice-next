// Feature 015 US3 (T067; US3-1 to US3-5, FR-050 to FR-066): the user directory on the fixture set: the sub-menu and the
// role tree (bo-editor > bo-sub), the lists by status and role, invite without email (D-83), a new user from a role,
// batch delete, the empty state; the "edit role" menu opens the 016 role page (D-85).
import { AdminApi } from './helpers/api.js';
import { ADMIN, DATA_PREFIX } from './helpers/config.js';
import { clearAdminPresets } from './helpers/content.js';
import { closeNavigation } from './helpers/files.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';
import { clearCreatedUsers, openUsers, roleId, roleTree, userEmail } from './helpers/users.js';

let api: AdminApi;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
});

test.beforeEach(async ({ page }) => {
	await resetLastPage(api);
	await clearAdminPresets(api, 'directus_users');
	await clearCreatedUsers(api);
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).not.toHaveURL(/\/admin\/login/);
});

test.afterEach(async () => {
	await clearCreatedUsers(api);
	await resetLastPage(api);
});

const title = (page: import('@playwright/test').Page) => page.getByRole('main').getByRole('heading', { level: 1 });

test('sub-menu: status lists and the role tree; a role lists its users (US3-1, US3-2) @core', async ({ page }) => {
	await openUsers(page);
	await expect(title(page)).toHaveText('Active Users');
	await expect(page.getByRole('main').getByText('bo-active@example.com')).toBeVisible();
	await expect(page.getByRole('main').getByText('bo-suspended@example.com')).toHaveCount(0);

	const tree = await roleTree(page);
	await tree.getByRole('button', { name: 'Expand bo-editor' }).click();
	await tree.getByRole('link', { name: 'bo-sub' }).click();
	await closeNavigation(page);

	const sub = await roleId(api, 'bo-sub');
	await expect(page).toHaveURL(new RegExp(`/admin/users/roles/${sub}$`));
	await expect(title(page)).toHaveText('bo-sub');
	await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveCount(0); // D-101 of 016

	for (const [path, heading, email] of [
		['/users/suspended', 'Suspended Users', 'bo-suspended@example.com'],
		['/users/invited', 'Invited Users', 'bo-invited@example.com'],
	] as const) {
		await openUsers(page, path);
		await expect(title(page)).toHaveText(heading);
		await expect(page.getByRole('main').getByText(email)).toBeVisible();
	}
});

test('the "edit role" menu of a role opens the real role page, not the frame (US4-2, D-85)', async ({ page }) => {
	await openUsers(page);
	const tree = await roleTree(page);
	await tree.getByRole('button', { name: 'Options for bo-editor' }).click();
	await page.getByRole('menuitem', { name: 'Edit Role' }).click();

	const editor = await roleId(api, 'bo-editor');
	await expect(page).toHaveURL(new RegExp(`/admin/settings/roles/${editor}$`));
	await expect(title(page)).toHaveText('bo-editor Role');
	await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveCount(0); // D-101 of 016
});

test('invite two new emails and a known one: two invited users, the known user unchanged, the notice (US3-3, D-83)', async ({
	page,
}) => {
	await openUsers(page, '/users/invited');
	await page.getByRole('button', { name: 'Invite Users' }).click();
	const dialog = page.getByRole('dialog', { name: 'Invite Users' });

	// Directus UsersService.inviteUser skips a known user that is not invited: no error, no change.
	await dialog.getByLabel('Emails').fill(`${userEmail('invite-1')},\n${userEmail('invite-2')}, bo-active@example.com`);
	await dialog.getByRole('button', { name: 'Invite' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByText(/does not send email/)).toBeVisible();
	await expect(page.getByRole('main').getByText(userEmail('invite-1'))).toBeVisible();

	const invited = await api.call<{ status: string }[]>(
		'GET',
		`/users?fields=status&filter[email][_in]=${userEmail('invite-1')},${userEmail('invite-2')}`,
	);
	expect(invited.map((u) => u.status)).toEqual(['invited', 'invited']);
	const [known] = await api.call<{ status: string }[]>('GET', '/users?fields=status&filter[email][_eq]=bo-active@example.com');
	expect(known!.status).toBe('active');
});

test('create a user from a role: the form starts with the role (US3-4)', async ({ page }) => {
	const sub = await roleId(api, 'bo-sub');
	await openUsers(page, `/users/roles/${sub}`);
	await page.getByRole('link', { name: 'Create Item' }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/users/roles/${sub}/\\+$`));
	await expect(title(page)).toHaveText('Adding User');

	await page.getByRole('textbox', { name: 'Email' }).fill(userEmail('created'));
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/users$/);

	const [created] = await api.call<{ role: string }[]>('GET', `/users?fields=role&filter[email][_eq]=${userEmail('created')}`);
	expect(created!.role).toBe(sub);
});

test('batch delete after the confirmation removes the users and reloads the list (US3-5, FR-062)', async ({ page }) => {
	for (const name of ['delete-1', 'delete-2']) await api.createUser({ email: userEmail(name), status: 'active' });

	await openUsers(page);
	await page.getByRole('button', { name: 'Search', exact: true }).click();
	await page.getByRole('searchbox', { name: 'Search Items...' }).fill(`${DATA_PREFIX}-delete`);
	const table = page.getByRole('main').getByRole('table');
	await expect(table.locator('tbody tr')).toHaveCount(2);
	const boxes = table.getByRole('checkbox', { name: 'Select Item' });
	await boxes.nth(0).check();
	await boxes.nth(1).check();

	await page.getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	// The list reloads without the rows. The item count keeps its memoized value, as in Directus (use-items
	// `useMemoize` on the aggregate request), so the "No Results" state is not asserted here.
	await expect(page.getByRole('main').getByText(userEmail('delete-1'))).toHaveCount(0);
	expect(
		await api.call<unknown[]>('GET', `/users?fields=id&filter[email][_starts_with]=${DATA_PREFIX}-delete`),
	).toHaveLength(0);
});
