// Feature 016 US3 (T055) and US2 scenario 9: the field drawer of Settings. Fields made in the simple mode (input,
// m2o, o2m, m2m, translations, group, datetime) and the advanced mode (an integer), checked through the API: the
// fields, the generated collections and the relations, as the Directus app writes them. A user field `bo_note` in directus_users
// (US2-9). Every collection a test creates carries the configuration prefix and is deleted after the file.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL, DATA_PREFIX } from './helpers/config.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;
const P = DATA_PREFIX.replaceAll('-', '_');
// Short names: the m2m junction is `<articles>_<tags>` and Postgres cuts identifiers at 63 characters.
const ARTICLES = `${P}_fda`;
const COMMENTS = `${P}_fdc`;
const TAGS = `${P}_fdt`;
let languagesExisted = true;

test.describe.configure({ mode: 'serial' });

type FieldRow = { field: string; type: string; meta: Record<string, any> | null; schema: Record<string, any> | null };
type RelationRow = {
	collection: string;
	field: string;
	related_collection: string | null;
	meta: Record<string, any> | null;
};

const exists = (collection: string) =>
	api.call('GET', `/collections/${collection}`).then(
		() => true,
		() => false,
	);
const fieldOf = (collection: string, field: string) => api.call<FieldRow>('GET', `/fields/${collection}/${field}`);
const relations = (collection: string) => api.call<RelationRow[]>('GET', `/relations/${collection}`);

async function cleanup() {
	await api.call('DELETE', '/fields/directus_users/bo_note').catch(() => undefined);
	for (const collection of [`${ARTICLES}_translations`, `${ARTICLES}_${TAGS}`, COMMENTS, TAGS, ARTICLES])
		await api.call('DELETE', `/collections/${collection}`).catch(() => undefined);
}

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	await cleanup();
	languagesExisted = await exists('languages');
	await api.call('POST', '/collections', {
		data: {
			collection: ARTICLES,
			schema: {},
			meta: {},
			fields: [
				{
					field: 'id',
					type: 'integer',
					schema: { is_primary_key: true, has_auto_increment: true },
					meta: { hidden: true },
				},
			],
		},
	});
});

test.afterAll(async () => {
	await cleanup();
	if (!languagesExisted) await api.call('DELETE', '/collections/languages').catch(() => undefined);
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
	await api.call('POST', '/utils/cache/clear');
});

async function openDrawer(page: Page, collection = ARTICLES, query = '') {
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
	await page.goto(`/admin/settings/data-model/${collection}/+${query}`);
	const drawer = page.getByRole('dialog', { name: new RegExp(`New Field \\(${collection}\\)|${collection}`) });
	await expect(drawer).toBeVisible();
	return drawer;
}

/** Simple mode: choose the card, type the key, run `configure`, save; the drawer closes on the collection page. */
async function simple(
	page: Page,
	card: string,
	key: string,
	configure?: (drawer: ReturnType<Page['getByRole']>) => Promise<void>,
	collection = ARTICLES,
) {
	const drawer = await openDrawer(page, collection);
	await drawer.getByRole('radio', { name: card, exact: true }).click();
	await drawer.getByRole('textbox', { name: 'Key', exact: true }).fill(key);
	await configure?.(drawer);
	await drawer.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/settings/data-model/${collection}$`), { timeout: 15_000 });
}

test('input, required (US3 simple mode)', async ({ page }) => {
	await simple(page, 'Input', 'title', async (drawer) => {
		await drawer.getByRole('checkbox', { name: 'Require value to be set' }).click();
	});

	const field = await fieldOf(ARTICLES, 'title');
	expect(field).toMatchObject({ type: 'string', meta: { interface: 'input', required: true } });
});

test('many to one to directus_users', async ({ page }) => {
	await simple(page, 'Many to One', 'author', async (drawer) => {
		await drawer.getByRole('textbox', { name: 'Collection', exact: true }).fill('directus_users');
	});

	expect(await fieldOf(ARTICLES, 'author')).toMatchObject({
		type: 'uuid',
		meta: { interface: 'select-dropdown-m2o', special: ['m2o'] },
	});
	expect((await relations(ARTICLES)).find((r) => r.field === 'author')).toMatchObject({
		related_collection: 'directus_users',
	});
});

test('one to many to a new collection', async ({ page }) => {
	await simple(page, 'One to Many', 'comments', async (drawer) => {
		await drawer.getByRole('textbox', { name: 'Collection', exact: true }).fill(COMMENTS);
		await drawer.getByRole('textbox', { name: 'Foreign Key', exact: true }).fill('article');
	});

	expect(await exists(COMMENTS)).toBe(true);
	expect(await fieldOf(COMMENTS, 'article')).toMatchObject({ type: 'integer' });
	expect((await relations(COMMENTS)).find((r) => r.field === 'article')).toMatchObject({
		related_collection: ARTICLES,
		meta: { one_field: 'comments' },
	});
});

test('many to many to a new collection, the junction generated', async ({ page }) => {
	await simple(page, 'Many to Many', 'tags', async (drawer) => {
		await drawer.getByRole('textbox', { name: 'Collection', exact: true }).fill(TAGS);
	});

	const junction = `${ARTICLES}_${TAGS}`;
	expect(await exists(TAGS)).toBe(true);
	expect(await exists(junction)).toBe(true);
	const rows = await relations(junction);
	expect(rows.map((r) => [r.field, r.related_collection]).sort()).toEqual(
		[
			[`${ARTICLES}_id`, ARTICLES],
			[`${TAGS}_id`, TAGS],
		].sort(),
	);
});

test('translations with the languages collection', async ({ page }) => {
	await simple(page, 'Translations', 'translations', async (drawer) => {
		await drawer.getByRole('textbox', { name: 'Collection', exact: true }).fill('languages');
	});

	expect(await exists(`${ARTICLES}_translations`)).toBe(true);
	expect(await exists('languages')).toBe(true);
	expect(await fieldOf(ARTICLES, 'translations')).toMatchObject({ type: 'alias', meta: { special: ['translations'] } });
});

test('detail group (alias without schema)', async ({ page }) => {
	await simple(page, 'Detail Group', 'meta_group');

	expect(await fieldOf(ARTICLES, 'meta_group')).toMatchObject({
		type: 'alias',
		schema: null,
		meta: { interface: 'group-detail', special: ['alias', 'no-data', 'group'] },
	});
});

test('datetime defaults to Timestamp (D-193); the Timezone option lists the zones by region', async ({ page }) => {
	await simple(page, 'Datetime', 'expires_at', async (drawer) => {
		await expect(drawer.getByRole('combobox', { name: 'Type', exact: true })).toContainText('Timestamp');
		// The zones are choices with children: a group per region, not the "Unexpected Error" notice.
		const timezone = drawer.getByRole('combobox', { name: /^Timezone/ });
		await timezone.click();
		await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('tokyo');
		await expect(page.getByRole('group', { name: 'Asia' })).toBeVisible();
		await page.getByRole('option', { name: 'Tokyo', exact: true }).click();
		await expect(timezone).toContainText('Tokyo');
	});

	expect(await fieldOf(ARTICLES, 'expires_at')).toMatchObject({
		type: 'timestamp',
		meta: { interface: 'datetime', options: { tz: 'Asia/Tokyo' } },
	});
});

test('advanced mode: an integer field from the Schema tab', async ({ page }) => {
	const drawer = await openDrawer(page, ARTICLES, '?type=standard');
	await expect(drawer.getByRole('tab', { name: 'Schema' })).toHaveAttribute('aria-selected', 'true');
	await drawer.getByRole('textbox', { name: 'Key', exact: true }).fill('rank');
	await drawer.getByRole('combobox').first().click();
	await page.getByRole('option', { name: 'Integer', exact: true }).click();
	await drawer.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/settings/data-model/${ARTICLES}$`), { timeout: 15_000 });

	expect(await fieldOf(ARTICLES, 'rank')).toMatchObject({ type: 'integer' });
});

test('a user field bo_note in directus_users (US2-9); the collection form stays locked', async ({ page }) => {
	await simple(page, 'Input', 'bo_note', undefined, 'directus_users');

	expect(await fieldOf('directus_users', 'bo_note')).toMatchObject({ type: 'string', meta: { interface: 'input' } });
	await expect(page.locator('main [data-field="note"]').getByRole('textbox')).toBeDisabled();
});
