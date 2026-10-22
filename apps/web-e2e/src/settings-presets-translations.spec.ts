// Feature 016 US6 (T103; US6-1 to US6-5, FR-002, FR-086, D-71 lifted): presets and custom translations of Settings.
// The preset list with its info counts; a role bookmark made in the preset editor (scope picked in the role drawer)
// shows in the Content tree, whose "Edit Role Bookmark" opens the editor again; a custom translation made on its item
// page is used by the app (a `$t:` bookmark name); `/content/directus_presets|translations(/<id>)` open the
// Settings screens. Every row a test creates carries the configuration prefix and is deleted after the file.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL, DATA_PREFIX } from './helpers/config.js';
import { e2eName, waitForTable } from './helpers/content.js';
import { moduleNavigation } from './helpers/layout.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;
let adminRole: { id: string; name: string };
// ponytail: hyphens, not underscores: NavigationBookmark (014) translates its name with the `$t:[a-zA-Z0-9.-]*` regex
// of translate-object-values (Directus uses translate-literal there), which cuts a key at `_`.
const KEY = `${DATA_PREFIX}-hello`;

test.describe.configure({ mode: 'serial' });

type Preset = { id: number; bookmark: string | null; collection: string; role: string | null; user: string | null };

async function cleanup() {
	const presets = await api.call<Preset[]>('GET', '/presets?limit=-1&fields=id,bookmark');
	const mine = presets.filter((p) => p.bookmark?.startsWith(DATA_PREFIX) || p.bookmark === `$t:${KEY}`);
	if (mine.length) await api.call('DELETE', '/presets', { data: mine.map((p) => p.id) });

	const translations = await api.call<{ id: string }[]>('GET', `/translations?filter[key][_eq]=${KEY}&fields=id`);
	if (translations.length) await api.call('DELETE', '/translations', { data: translations.map((t) => t.id) });
}

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	adminRole = (await api.call<{ role: { id: string; name: string } }>('GET', '/users/me?fields=role.id,role.name'))
		.role;
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

async function openSidebar(page: Page) {
	const toggle = page.getByRole('button', { name: 'Open sidebar', exact: true });
	if (await toggle.isVisible()) await toggle.click();
}

const field = (page: Page, name: string) => page.locator(`main [data-field="${name}"]`);

async function choose(page: Page, name: string, option: string | RegExp) {
	await field(page, name).getByRole('combobox').click();
	await page.getByRole('option', { name: option }).click();
}

test('the preset list: the directus_presets columns and the info panel counts (US6-1)', async ({ page }) => {
	const all = await api.call<Preset[]>('GET', '/presets?limit=-1&fields=id,bookmark');
	const bookmarks = all.filter((p) => p.bookmark !== null).length;

	await signIn(page, '/settings/presets');
	await expect(page.getByRole('heading', { level: 1, name: 'Bookmarks' })).toBeVisible();
	const table = await waitForTable(page);
	for (const column of ['Bookmark', 'Collection', 'User', 'Role'])
		await expect(table.getByRole('columnheader', { name: column, exact: true })).toBeVisible();

	await openSidebar(page);
	await page.getByRole('button', { name: 'Information', exact: true }).click();
	const info = page.locator('#sidebar dl');
	await expect(info).toContainText(new RegExp(`Bookmarks\\s*${bookmarks}`));
	await expect(info).toContainText(new RegExp(`Presets\\s*${all.length - bookmarks}`));
});

test('a role bookmark made in the preset editor shows in the Content tree, whose menu opens the editor (US6-2, US6-3, D-71)', async ({
	page,
}) => {
	const NAME = e2eName('role bookmark');

	await signIn(page, '/settings/presets/+');
	await expect(page.getByRole('heading', { level: 1, name: 'Editing Preset' })).toBeVisible();
	await expect(page.getByText('No layout/collection selected yet')).toBeVisible();

	await field(page, 'name').getByRole('textbox').fill(NAME);
	await choose(page, 'collection', 'bo_content');
	await choose(page, 'scope', 'Role: Select...');
	const drawer = page.getByRole('dialog');
	await drawer
		.getByRole('row', { name: new RegExp(adminRole.name) })
		.first()
		.click();
	await drawer.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(field(page, 'scope').getByRole('combobox')).toContainText(`Role: ${adminRole.name}`);

	// The read-only preview of the chosen collection (tabular by default).
	await expect(page.getByRole('main').getByRole('table')).toBeVisible();

	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/settings\/presets$/);

	const [created] = await api.call<Preset[]>(
		'GET',
		`/presets?filter[bookmark][_eq]=${encodeURIComponent(NAME)}&fields=id,bookmark,collection,role,user`,
	);
	expect(created).toMatchObject({ collection: 'bo_content', role: adminRole.id, user: null });

	// The parity environment caches GET responses without auto purge (the other specs clear it the same way).
	await api.call('POST', '/utils/cache/clear');
	await page.goto('/admin/content/bo_content');
	await moduleNavigation(page);
	const tree = page.getByRole('tree', { name: 'Collections' });
	await expect(tree.getByRole('link', { name: NAME })).toBeVisible();
	await tree.getByRole('button', { name: `Options for ${NAME}` }).click();
	await page.getByRole('menuitem', { name: 'Edit Role Bookmark' }).click();

	await expect(page).toHaveURL(new RegExp(`/admin/settings/presets/${created!.id}$`));
	await expect(page.getByRole('heading', { level: 1, name: 'Editing Preset' })).toBeVisible();
	await expect(field(page, 'name').getByRole('textbox')).toHaveValue(NAME);
});

test('a custom translation made on its item page is used by the app (US6-4, US6-5, FR-086)', async ({ page }) => {
	const VALUE = e2eName('Hello');

	await signIn(page, '/settings/translations');
	await expect(page.getByRole('heading', { level: 1, name: 'Translations' })).toBeVisible();
	await page.getByRole('link', { name: 'Create Custom Translation' }).first().click();
	await expect(page.getByRole('heading', { level: 1, name: 'Create Custom Translation' })).toBeVisible();

	await field(page, 'key').getByRole('textbox').fill(KEY);
	await choose(page, 'language', 'English (United States)');
	await field(page, 'value').getByRole('textbox').fill(VALUE);
	await page.getByRole('button', { name: 'Save', exact: true }).click();

	await expect(page).toHaveURL(/\/admin\/settings\/translations$/);
	const table = await waitForTable(page);
	await expect(table.getByRole('row', { name: new RegExp(KEY) })).toBeVisible();
	expect(await api.call('GET', `/translations?filter[key][_eq]=${KEY}&fields=key,language,value`)).toEqual([
		{ key: KEY, language: 'en-US', value: VALUE },
	]);

	// A bookmark named `$t:<key>` shows the custom string in the Content tree (made after the translation, so no page
	// ever shows the missing key).
	await api.call('POST', '/presets', {
		data: { bookmark: `$t:${KEY}`, collection: 'bo_content', role: adminRole.id, layout: 'tabular' },
	});
	await api.call('POST', '/utils/cache/clear');
	await page.goto('/admin/content/bo_content');
	await moduleNavigation(page);
	await expect(page.getByRole('tree', { name: 'Collections' }).getByRole('link', { name: VALUE })).toBeVisible();
});

test('/content/directus_presets, /content/directus_translations and their items open the Settings screens (FR-002)', async ({
	page,
}) => {
	const [preset] = await api.call<Preset[]>('GET', '/presets?limit=1&fields=id');
	const [translation] = await api.call<{ id: string }[]>('GET', `/translations?filter[key][_eq]=${KEY}&fields=id`);

	await signIn(page, '/content/directus_presets');
	await expect(page).toHaveURL(/\/admin\/settings\/presets$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Bookmarks' })).toBeVisible();

	await page.goto(`/admin/content/directus_presets/${preset!.id}`);
	await expect(page).toHaveURL(new RegExp(`/admin/settings/presets/${preset!.id}$`));
	await expect(page.getByRole('heading', { level: 1, name: 'Editing Preset' })).toBeVisible();

	await page.goto('/admin/content/directus_translations');
	await expect(page).toHaveURL(/\/admin\/settings\/translations$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Translations' })).toBeVisible();

	await page.goto(`/admin/content/directus_translations/${translation!.id}`);
	await expect(page).toHaveURL(new RegExp(`/admin/settings/translations/${translation!.id}$`));
	await expect(page.getByRole('heading', { level: 1, name: 'Edit Custom Translation' })).toBeVisible();
});
