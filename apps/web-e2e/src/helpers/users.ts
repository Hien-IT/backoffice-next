// Feature 015: the Users module pages on the fixture set (roles bo-editor > bo-sub, directory users bo-active,
// bo-suspended, bo-invited... of apps/web/fixtures/interfaces), opened as the admin. Accessible names are the en-US
// strings of the Directus app.
import { expect, type Locator, type Page } from '@playwright/test';
import type { AdminApi } from './api.js';
import { DATA_PREFIX } from './config.js';
import { moduleNavigation } from './layout.js';

/** Opens your own user page from the avatar menu at the bottom of the sidebar (D-157): no /users/me route, as Directus (D-86). */
export async function openOwnPage(page: Page): Promise<void> {
	// Below `xl` the sidebar is a drawer; the avatar is its last menu button (tiles and tree menus come first). The drawer
	// closes on the navigation to the user page.
	await moduleNavigation(page);
	await page.locator('aside#navigation button[aria-haspopup="menu"]').last().click();
	await page.getByRole('menuitem', { name: /^(Profile|Hồ sơ)/ }).click();
	await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]{36}$/);
}

/** Opens a Users route (`/users`, `/users/roles/<id>`, `/users/<id>`) and waits for the page title. */
export async function openUsers(page: Page, path = '/users'): Promise<void> {
	await page.goto(`/admin${path}`);
	await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
}

/** The role tree of the sub-menu (below `xl` the navigation is a drawer to open first). */
export async function roleTree(page: Page): Promise<Locator> {
	await moduleNavigation(page);
	const tree = page.getByRole('tree', { name: 'Roles' });
	await expect(tree).toBeVisible();
	return tree;
}

/** The id of a fixture role by name. */
export async function roleId(api: AdminApi, name: string): Promise<string> {
	const roles = await api.call<{ id: string }[]>(
		'GET',
		`/roles?fields=id&filter[name][_eq]=${encodeURIComponent(name)}`,
	);
	if (!roles[0]) throw new Error(`No role ${name}: seed the fixture set first`);
	return roles[0].id;
}

/** An email of this configuration (CHK019): `<DATA_PREFIX>-<name>@example.com`. */
export const userEmail = (name: string) => `${DATA_PREFIX}-${name}@example.com`;

/** Deletes the users this configuration created (emails start with DATA_PREFIX). */
export async function clearCreatedUsers(api: AdminApi): Promise<void> {
	const users = await api.call<{ id: string }[]>(
		'GET',
		`/users?fields=id&limit=-1&filter[email][_starts_with]=${encodeURIComponent(DATA_PREFIX)}`,
	);
	if (users.length) await api.call('DELETE', '/users', { data: users.map((u) => u.id) });
}
