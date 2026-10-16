// Feature 016 US1 (T033; US1-1 to US1-10, FR-002, FR-010 to FR-019, D-71 lifted): the collection list of Settings,
// folders, the collection options, the D-96 keyboard moves, the delete dialog with peer dependencies, the new collection
// drawer, the table without meta (`bo_raw`, proxy-api only: SQL through hostDb) and the links from Content.
// Every collection a test creates carries the configuration prefix (CHK019) and is deleted after the file.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL, DATA_PREFIX, e2eConfig } from './helpers/config.js';
import { openCollection } from './helpers/content.js';
import { closeHostDb, hostDb } from './helpers/db-rows.js';
import { moduleBar } from './helpers/layout.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;
const P = DATA_PREFIX.replaceAll('-', '_');
const KEYS = {
	folder: `${P}_dm_folder`,
	box: `${P}_dm_box`,
	first: `${P}_dm_first`,
	second: `${P}_dm_second`,
	target: `${P}_dm_target`,
	source: `${P}_dm_source`,
	articles: `${P}_dm_articles`,
	raw: `${P}_dm_raw`,
	rawManaged: `${P}_dm_raw_managed`,
};

test.describe.configure({ mode: 'serial' });

async function cleanup() {
	// Children before their folders; tables before the collections they point at.
	for (const key of [
		`${KEYS.articles}_translations`,
		KEYS.source,
		KEYS.target,
		KEYS.first,
		KEYS.second,
		KEYS.articles,
		KEYS.rawManaged,
		KEYS.box,
		KEYS.folder,
	])
		await api.call('DELETE', `/collections/${key}`).catch(() => undefined);
	await hostDb().schema.dropTableIfExists(KEYS.raw);
	await hostDb().schema.dropTableIfExists(KEYS.rawManaged);
}

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	await cleanup();
});

test.beforeEach(async () => {
	// Sign-in lands on last_page when set (012 FR-018): start from /content.
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
	await api.call('POST', '/utils/cache/clear');
});

test.afterAll(async () => {
	await cleanup();
	await closeHostDb();
});

const collection = (key: string) => api.call<{ meta: Record<string, any> | null }>('GET', `/collections/${key}`);
const exists = (key: string) =>
	collection(key).then(
		() => true,
		() => false,
	);

async function signIn(page: Page) {
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
}

async function openDataModel(page: Page) {
	await signIn(page);
	await page.goto('/admin/settings/data-model');
	await expect(page.getByRole('heading', { level: 1, name: 'Data Model' })).toBeVisible();
}

const tree = (page: Page) => page.getByRole('region', { name: 'Data Model' });

async function rowMenu(page: Page, key: string, item: string) {
	await page.getByRole('button', { name: `Options for ${key}`, exact: true }).click();
	await page
		.getByRole('menuitem', { name: item })
		.or(page.getByRole('menuitemradio', { name: item }))
		.click();
}

test('/settings opens the data model with the tree, the system collections and the new collection drawer (US1-1, US1-2, US1-7)', async ({
	page,
}) => {
	await signIn(page);
	await page.goto('/admin/settings');
	await expect(page).toHaveURL(/\/admin\/settings\/data-model$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Data Model' })).toBeVisible();

	await expect(tree(page).locator('a[href="/admin/settings/data-model/bo_std"]')).toBeVisible();

	await page.getByRole('button', { name: 'System Collections' }).click();
	await expect(page.locator('a[href="/admin/settings/data-model/directus_users"]')).toBeVisible();

	await page.getByRole('link', { name: 'Create Collection' }).first().click();
	await expect(page).toHaveURL(/\/admin\/settings\/data-model\/\+$/);
	await expect(page.getByRole('dialog', { name: 'Creating New Collection' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page).toHaveURL(/\/admin\/settings\/data-model$/);
});

test('folder: create, hide, start collapsed, delete (US1-5, US1-6)', async ({ page }) => {
	await openDataModel(page);

	await page.getByRole('button', { name: 'Create Folder' }).click();
	const dialog = page.getByRole('dialog', { name: 'Create Folder' });
	await dialog.getByRole('textbox', { name: 'Folder Key...' }).fill(KEYS.folder);
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();
	await expect(tree(page).getByText(KEYS.folder, { exact: true })).toBeVisible();
	expect((await collection(KEYS.folder)).meta).toMatchObject({ icon: 'folder', hidden: false });

	await rowMenu(page, KEYS.folder, 'Make Folder Hidden');
	await expect.poll(async () => (await collection(KEYS.folder)).meta?.['hidden']).toBe(true);

	await rowMenu(page, KEYS.folder, 'Start Collapsed');
	await expect.poll(async () => (await collection(KEYS.folder)).meta?.['collapse']).toBe('closed');

	await rowMenu(page, KEYS.folder, 'Delete Folder');
	await page.getByRole('dialog').getByRole('button', { name: 'Delete Folder' }).click();
	await expect.poll(() => exists(KEYS.folder)).toBe(false);
	await expect(tree(page).getByText(KEYS.folder, { exact: true })).toHaveCount(0);
});

test('keyboard moves: Indent into the collection above, Outdent after its parent (US1-4, D-96)', async ({ page }) => {
	await api.call('POST', '/collections', { data: { collection: KEYS.box, meta: { icon: 'folder', sort: 9000 } } });
	for (const [key, sort] of [
		[KEYS.first, 1],
		[KEYS.second, 2],
	] as const)
		await api.call('POST', '/collections', {
			data: {
				collection: key,
				schema: {},
				meta: { group: KEYS.box, sort },
				fields: [{ field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } }],
			},
		});

	await openDataModel(page);

	await rowMenu(page, KEYS.second, 'Indent');
	await expect.poll(async () => (await collection(KEYS.second)).meta?.['group']).toBe(KEYS.first);

	await rowMenu(page, KEYS.second, 'Outdent');
	await expect.poll(async () => (await collection(KEYS.second)).meta).toMatchObject({ group: KEYS.box, sort: 2 });
	expect((await collection(KEYS.first)).meta).toMatchObject({ group: KEYS.box, sort: 1 });
});

test('delete lists the peer dependencies and deletes them first (US1-5)', async ({ page }) => {
	const pk = [{ field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } }];
	for (const key of [KEYS.target, KEYS.source])
		await api.call('POST', '/collections', {
			data: { collection: key, schema: {}, meta: { group: KEYS.box }, fields: pk },
		});
	await api.call('POST', `/fields/${KEYS.source}`, {
		data: { field: 't_ref', type: 'integer', schema: {}, meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
	});
	await api.call('POST', '/relations', {
		data: { collection: KEYS.source, field: 't_ref', related_collection: KEYS.target },
	});

	await openDataModel(page);

	await rowMenu(page, KEYS.target, 'Delete Collection');
	const dialog = page.getByRole('dialog');
	await expect(dialog).toContainText(`t_ref (${KEYS.source})`);
	await dialog.getByRole('button', { name: 'Delete Collection' }).click();

	await expect.poll(() => exists(KEYS.target)).toBe(false);
	const fields = await api.call<{ field: string }[]>('GET', `/fields/${KEYS.source}`);
	expect(fields.map((f) => f.field)).toEqual(['id']);
});

test('new collection: uuid key and four system fields, usable through the API (US1-7, US1-8)', async ({ page }) => {
	await openDataModel(page);
	await page.goto('/admin/settings/data-model/+');

	const drawer = page.getByRole('dialog', { name: 'Creating New Collection' });
	await drawer.locator('#new-collection-name').fill(KEYS.articles);
	await drawer.getByRole('combobox', { name: 'Type' }).click();
	await page.getByRole('option', { name: 'Generated UUID' }).click();
	await drawer.locator('#new-collection-name').press('Enter');

	for (const name of ['Status', 'Sort', 'Created On', 'Created By'])
		await drawer.getByRole('checkbox', { name }).click();
	await drawer.getByRole('button', { name: 'Finish Setup' }).click();

	await expect(page).toHaveURL(new RegExp(`/admin/settings/data-model/${KEYS.articles}$`));

	const fields = await api.call<{ field: string; type: string }[]>('GET', `/fields/${KEYS.articles}`);
	expect(fields.map((f) => [f.field, f.type])).toEqual([
		['id', 'uuid'],
		['status', 'string'],
		['sort', 'integer'],
		['user_created', 'uuid'],
		['date_created', 'timestamp'],
	]);
	const relations = await api.call<{ field: string; related_collection: string }[]>(
		'GET',
		`/relations/${KEYS.articles}`,
	);
	expect(relations.map((r) => [r.field, r.related_collection])).toEqual([['user_created', 'directus_users']]);
	expect((await collection(KEYS.articles)).meta).toMatchObject({ sort_field: 'sort', archive_field: 'status' });

	const item = await api.call<{ id: string; status: string; user_created: string }>('POST', `/items/${KEYS.articles}`, {
		data: {},
	});
	expect(item.status).toBe('draft');
	expect(item.user_created).toEqual(expect.any(String));
});

test('a table without meta: listed apart, deleted from its menu, configured by opening it (US1-3)', async ({
	page,
}) => {
	test.skip(e2eConfig !== 'proxy-api', 'bo_raw is created with SQL on the proxy-api configuration only');

	for (const key of [KEYS.raw, KEYS.rawManaged]) await hostDb().schema.createTable(key, (t) => t.increments('id'));
	await api.call('POST', '/utils/cache/clear');

	await openDataModel(page);
	const raw = page.getByRole('region', { name: 'Database Only: Click to Configure' });
	await expect(raw.locator(`a[href="/admin/settings/data-model/${KEYS.raw}"]`)).toBeVisible();

	await page.getByRole('button', { name: `Options for ${KEYS.raw}`, exact: true }).click();
	await page.getByRole('menuitem', { name: 'Delete Collection' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete Collection' }).click();
	await expect.poll(() => hostDb().schema.hasTable(KEYS.raw)).toBe(false);

	await raw.locator(`a[href="/admin/settings/data-model/${KEYS.rawManaged}"]`).click();
	await expect(page).toHaveURL(new RegExp(`/admin/settings/data-model/${KEYS.rawManaged}$`));
	await expect.poll(async () => (await collection(KEYS.rawManaged)).meta).not.toBeNull();
});

test('Content links open the real pages: edit collection, /content/directus_collections (FR-002, D-71)', async ({
	page,
}) => {
	await signIn(page);

	await openCollection(page, 'bo_std');
	// Below xl the navigation (with the tree) is a drawer to open first.
	await moduleBar(page);
	const tree = page.getByRole('tree', { name: 'Collections' });
	await tree.locator('a[href="/admin/content/bo_std"]').click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Edit Collection' }).click();
	await expect(page).toHaveURL(/\/admin\/settings\/data-model\/bo_std$/);

	await page.goto('/admin/content/directus_collections');
	await expect(page).toHaveURL(/\/admin\/settings\/data-model$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Data Model' })).toBeVisible();
});

/* ------------------------------------------------------------------------------------------------- US2 (T043) */

type FieldRow = { field: string; meta: Record<string, any> | null };
const fieldsOf = (key: string) => api.call<FieldRow[]>('GET', `/fields/${key}`);
const fieldOf = async (key: string, field: string) => (await fieldsOf(key)).find((f) => f.field === field);

async function fieldMenu(page: Page, field: string, item: string) {
	await page.getByRole('button', { name: `Options for ${field}`, exact: true }).click();
	await page.getByRole('menuitem', { name: item }).click();
}

test('collection page: field order, width, visibility, duplicate and delete (US2-2 to US2-6)', async ({ page }) => {
	await signIn(page);
	await page.goto(`/admin/settings/data-model/${KEYS.articles}`);
	await expect(page.getByRole('heading', { name: 'Fields & Layout' })).toBeVisible();

	await fieldMenu(page, 'sort', 'Move down');
	await expect
		.poll(async () => (await fieldsOf(KEYS.articles)).map((f) => [f.field, f.meta?.['sort']]))
		.toEqual(
			expect.arrayContaining([
				['user_created', 3],
				['sort', 4],
			]),
		);

	await fieldMenu(page, 'status', 'Half Width');
	await expect.poll(async () => (await fieldOf(KEYS.articles, 'status'))?.meta?.['width']).toBe('half');

	await fieldMenu(page, 'status', 'Hide Field on Detail');
	await expect.poll(async () => (await fieldOf(KEYS.articles, 'status'))?.meta?.['hidden']).toBe(true);

	await fieldMenu(page, 'status', 'Duplicate Field');
	const duplicate = page.getByRole('dialog', { name: 'Where would you like to duplicate this field to?' });
	await expect(duplicate.getByRole('textbox')).toHaveValue('status_copy');
	await duplicate.getByRole('button', { name: 'Duplicate' }).click();
	await expect(duplicate).toBeHidden();
	await expect
		.poll(async () => (await fieldOf(KEYS.articles, 'status_copy'))?.meta?.['interface'])
		.toBe('select-dropdown');

	await fieldMenu(page, 'status_copy', 'Delete Field');
	await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
	await expect.poll(async () => await fieldOf(KEYS.articles, 'status_copy')).toBeUndefined();
});

test('collection form: save the edited meta keys; enable translations with the helper (US2-1, US2-8)', async ({
	page,
}) => {
	const languagesExisted = await exists('languages');
	await signIn(page);
	await page.goto(`/admin/settings/data-model/${KEYS.articles}`);

	const note = page.locator('main [data-field="note"]').getByRole('textbox');
	await note.fill('Articles of the 016 E2E');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/settings\/data-model$/);
	expect((await collection(KEYS.articles)).meta).toMatchObject({ note: 'Articles of the 016 E2E', sort_field: 'sort' });

	await page.goto(`/admin/settings/data-model/${KEYS.articles}`);
	await page.getByRole('button', { name: 'Enable Translations' }).click();
	const drawer = page.getByRole('dialog', { name: 'Enable Translations' });
	await expect(drawer.getByRole('checkbox', { name: 'Status' })).toBeChecked();
	await drawer.getByRole('button', { name: 'Enable', exact: true }).click();
	await expect(drawer).toBeHidden({ timeout: 15_000 });

	await expect.poll(() => exists(`${KEYS.articles}_translations`)).toBe(true);
	expect((await fieldOf(KEYS.articles, 'translations'))?.meta?.['special']).toEqual(['translations']);
	await expect(page.getByText('Translations enabled')).toBeVisible();

	await api.call('DELETE', `/fields/${KEYS.articles}/translations`).catch(() => undefined);
	await api.call('DELETE', `/collections/${KEYS.articles}_translations`).catch(() => undefined);
	if (!languagesExisted) await api.call('DELETE', '/collections/languages').catch(() => undefined);
});
