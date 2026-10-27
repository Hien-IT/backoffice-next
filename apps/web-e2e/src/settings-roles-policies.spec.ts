// Feature 016 US4 (T074; US4-1 to US4-8, FR-002, D-85 lifted): roles and policies of Settings. Role list with the Public
// row, create / edit / delete a role, the Public page; policy list, create a policy with app access (the minimal app
// permissions written with it), the permissions matrix (add a collection, read all, create custom with one field in
// the detail drawer) saved with the policy as `directus_permissions` rows, duplicate a policy; `/content/directus_roles`
// opens the role list. Every role and policy a test creates carries the configuration prefix and is deleted after the file.
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL, DATA_PREFIX, e2eConfig } from './helpers/config.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;
const P = DATA_PREFIX.replaceAll('-', '_');
const ROLE = `${P}_role`;
const POLICY = `${P}_policy`;
const COPY = `${POLICY} (copy)`;
// The app-minimal rows (Directus 11.17.4 system-data, rendered for apps/web by web:sync-permissions-data).
const MINIMAL = (
	JSON.parse(readFileSync(new URL('../../web/src/permissions/app-permissions-data.json', import.meta.url), 'utf8')) as {
		minimal: { collection: string; action: string; fields: string[] | null }[];
	}
).minimal;

test.describe.configure({ mode: 'serial' });

type Row = { id: string; name: string };
type PermissionRow = {
	collection: string;
	action: string;
	fields: string[] | null;
	permissions: Record<string, unknown> | null;
};

const q = (value: unknown) => encodeURIComponent(JSON.stringify(value));

const byName = (collection: 'roles' | 'policies', name: string) =>
	api.call<Row[]>('GET', `/${collection}?filter=${q({ name: { _eq: name } })}&fields=id,name`);

// Backoffice (spec 025, D-189.3): the import and export rows (backoffice_permissions); a Directus API has no such route.
const hasBackofficePermissions = e2eConfig !== 'proxy-directus';

const boPermissionsOf = (policy: string) =>
	api.call<(Omit<PermissionRow, 'permissions'> & { options: { formats?: string[] } | null })[]>(
		'GET',
		`/backoffice/permissions?filter=${q({ policy: { _eq: policy } })}&limit=-1&fields=collection,action,fields,options`,
	);

const permissionsOf = (policy: string) =>
	api.call<PermissionRow[]>(
		'GET',
		`/permissions?filter=${q({ policy: { _eq: policy } })}&limit=-1&fields=collection,action,fields,permissions`,
	);

async function cleanup() {
	for (const name of [ROLE, `${ROLE}_edited`]) {
		for (const role of await byName('roles', name))
			await api.call('DELETE', `/roles/${role.id}`).catch(() => undefined);
	}
	for (const name of [POLICY, COPY]) {
		for (const policy of await byName('policies', name))
			await api.call('DELETE', `/policies/${policy.id}`).catch(() => undefined);
	}
}

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	await cleanup();
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
	await api.call('POST', '/utils/cache/clear');
});

test.afterAll(async () => {
	await cleanup();
});

async function signIn(page: Page, path: string) {
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
	await page.goto(`/admin${path}`);
}

test('roles: the Public row first, search, create, edit and delete a role (US4-1, US4-2)', async ({ page }) => {
	await signIn(page, '/settings/roles');
	await expect(page.getByRole('heading', { level: 1, name: 'User Roles' })).toBeVisible();

	const table = page.getByRole('table');
	await expect(table.getByRole('row').nth(1)).toContainText('Public');

	await page.getByRole('link', { name: 'Create Role' }).click();
	const dialog = page.getByRole('dialog', { name: 'Create Role' });
	await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
	await dialog.getByRole('textbox', { name: 'Role Name' }).fill(ROLE);
	await dialog.getByRole('button', { name: 'Save' }).click();

	await expect(page.getByRole('heading', { level: 1, name: `${ROLE} Role` })).toBeVisible();
	const [role] = await byName('roles', ROLE);
	expect(role).toBeDefined();
	await expect(page).toHaveURL(new RegExp(`/admin/settings/roles/${role!.id}$`));

	// Edit the name in the directus_roles form, save and stay on the list.
	await page.locator('main [data-field="name"]').getByRole('textbox').fill(`${ROLE}_edited`);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/settings\/roles$/);
	expect(await api.call<Row>('GET', `/roles/${role!.id}`)).toMatchObject({ name: `${ROLE}_edited` });

	// Client search on name or description.
	await page.getByRole('search').getByRole('button').first().click();
	await page.getByRole('searchbox').fill(`${ROLE}_edited`);
	await expect(table.getByRole('row')).toHaveCount(2);

	await table.getByRole('row').nth(1).click();
	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(page).toHaveURL(/\/admin\/settings\/roles$/);
	expect(await byName('roles', `${ROLE}_edited`)).toEqual([]);
});

test('the Public page: the notice and the public policies field, only a save button (US4-3)', async ({ page }) => {
	await signIn(page, '/settings/roles/public');

	await expect(page.getByRole('heading', { level: 1, name: 'Public' })).toBeVisible();
	await expect(page.getByText('The public role controls what API data is available')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
});

test('create a policy with app access: the minimal app permissions are written with it (US4-5)', async ({ page }) => {
	await signIn(page, '/settings/policies');
	await expect(page.getByRole('heading', { level: 1, name: 'Access Policies' })).toBeVisible();

	await page.getByRole('link', { name: 'Create Policy' }).click();
	const dialog = page.getByRole('dialog', { name: 'Create Policy' });
	await dialog.getByRole('textbox', { name: 'Policy Name' }).fill(POLICY);
	await dialog.getByRole('group', { name: 'App Access' }).getByRole('checkbox', { name: 'Enabled' }).check();
	await dialog.getByRole('button', { name: 'Save' }).click();

	await expect(page.getByRole('heading', { level: 1, name: `${POLICY} Policy` })).toBeVisible();
	const [policy] = await byName('policies', POLICY);
	expect(await api.call('GET', `/policies/${policy!.id}?fields=app_access,admin_access`)).toEqual({
		app_access: true,
		admin_access: false,
	});

	const rows = await permissionsOf(policy!.id);
	const pick = (row: { collection: string; action: string; fields: string[] | null }) =>
		`${row.collection}.${row.action} ${JSON.stringify(row.fields)}`;
	expect(rows.map(pick).sort()).toEqual(MINIMAL.map(pick).sort());
});

test('the matrix: add bo_std, read all, create custom with one field; saved as directus_permissions (US4-6 to US4-8)', async ({
	page,
}) => {
	const [policy] = await byName('policies', POLICY);
	await signIn(page, `/settings/policies/${policy!.id}`);

	const matrix = page.locator('[data-permissions-matrix]');
	await expect(matrix).toBeVisible();
	// App-minimal rows are locked.
	await expect(matrix.locator('tr[data-collection="directus_collections"] [role="img"]').first()).toBeVisible();

	await page.getByRole('button', { name: 'Add Collection' }).click();
	await page.getByRole('menuitem', { name: 'bo_std', exact: true }).click();
	const row = matrix.locator('tr[data-collection="bo_std"]');
	await expect(row).toBeVisible();

	await row.getByRole('button', { name: 'No Read Access' }).click();
	await page.getByRole('menuitem', { name: 'All Access' }).click();
	await expect(row.getByRole('button', { name: 'Full Read Access' })).toBeVisible();

	await row.getByRole('button', { name: 'No Create Access' }).click();
	await page.getByRole('menuitem', { name: 'Use Custom' }).click();
	const drawer = page.getByRole('dialog', { name: new RegExp(`${POLICY} -> bo_std -> Create`) });
	await expect(drawer.getByRole('tab', { name: /Field Permissions/ })).toHaveAttribute('aria-selected', 'true');
	await drawer.getByRole('treeitem', { name: /Input Masked/ }).click();
	await drawer.getByRole('button', { name: 'Save' }).click();
	await expect(drawer).toBeHidden();
	await expect(row.getByRole('button', { name: 'Partial Create Access' })).toBeVisible();

	// Nothing is written until the policy is saved.
	expect((await permissionsOf(policy!.id)).some((p) => p.collection === 'bo_std')).toBe(false);

	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/settings\/policies$/);

	const rows = (await permissionsOf(policy!.id)).filter((p) => p.collection === 'bo_std');
	expect(rows.map((p) => [p.action, p.fields]).sort()).toEqual([
		['create', ['input_masked']],
		['read', ['*']],
	]);
});

// Backoffice (spec 025, FR-022..FR-027, US1, US4): import and export cells from backoffice_permissions, no share; 4
// columns when the API is Directus (FR-034).
test('import and export: 6 columns without share; export by Use custom with CSV, saved after the policy', async ({
	page,
}) => {
	const [policy] = await byName('policies', POLICY);
	await signIn(page, `/settings/policies/${policy!.id}`);

	const row = page.locator('[data-permissions-matrix] tr[data-collection="bo_std"]');
	await expect(row.getByRole('button', { name: 'Full Read Access' })).toBeVisible();
	await expect(row.getByRole('button', { name: /Share Access$/ })).toHaveCount(0);

	if (!hasBackofficePermissions) {
		await expect(row.getByRole('button', { name: /(Import|Export) Access$/ })).toHaveCount(0);
		return;
	}

	await expect(row.getByRole('button', { name: 'No Import Access' })).toBeVisible();
	await row.getByRole('button', { name: 'No Export Access' }).click();
	await page.getByRole('menuitem', { name: 'Use Custom' }).click();
	const drawer = page.getByRole('dialog', { name: new RegExp(`${POLICY} -> bo_std -> Export`) });
	await drawer.getByRole('tab', { name: /Formats/ }).click();
	await drawer.getByRole('checkbox', { name: 'CSV', exact: true }).click();
	await drawer.getByRole('button', { name: 'Save' }).click();
	await expect(drawer).toBeHidden();
	await expect(row.getByRole('button', { name: 'Partial Export Access' })).toBeVisible();

	// Nothing is written until the policy is saved.
	expect(await boPermissionsOf(policy!.id)).toEqual([]);

	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/settings\/policies$/);
	expect(await boPermissionsOf(policy!.id)).toEqual([
		{ collection: 'bo_std', action: 'export', fields: ['*'], options: { formats: ['csv'] } },
	]);

	await page.goto(`/admin/settings/policies/${policy!.id}`);
	await expect(row.getByRole('button', { name: 'Partial Export Access' })).toBeVisible();
});

test('duplicate a policy: the copy has the same permissions, no users or roles (US4-4)', async ({ page }) => {
	const [policy] = await byName('policies', POLICY);
	await signIn(page, '/settings/policies');

	await page.getByRole('button', { name: `Options for ${POLICY}` }).click();
	await page.getByRole('menuitem', { name: 'Duplicate Policy' }).click();
	const dialog = page.getByRole('dialog', { name: 'Duplicate Policy' });
	await expect(dialog.getByRole('textbox', { name: 'Policy Name' })).toHaveValue(COPY);
	await dialog.getByRole('button', { name: 'Duplicate' }).click();
	await expect(page.getByRole('row', { name: new RegExp(COPY.replace(/[()]/g, '\\$&')) })).toBeVisible();

	const [copy] = await byName('policies', COPY);
	const key = (p: PermissionRow) => `${p.collection}.${p.action}`;
	expect((await permissionsOf(copy!.id)).map(key).sort()).toEqual((await permissionsOf(policy!.id)).map(key).sort());

	// Backoffice (spec 025, FR-027): the import and export rows are copied too.
	if (hasBackofficePermissions) expect(await boPermissionsOf(copy!.id)).toEqual(await boPermissionsOf(policy!.id));
});

test('/content/directus_roles opens the role list (FR-002, D-72)', async ({ page }) => {
	await signIn(page, '/content/directus_roles');

	await expect(page).toHaveURL(/\/admin\/settings\/roles$/);
	await expect(page.getByRole('heading', { level: 1, name: 'User Roles' })).toBeVisible();
});
