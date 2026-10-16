// Feature 016 T111 (SC-002, SC-003, FR-102, contracts/tests.md §5): what Settings makes in one app works at once in the
// other. (1) The 10 fields of US3 made in the field drawer of the new app; the same steps in the Directus app write the
// same directus_collections, directus_fields and directus_relations rows; the Directus app creates an item with the
// values of §5 and the new API reads it back. (2) Role, policy and the US4 permissions made in the new app: a user of
// that role gets the same result for the six operations of SC-003 in both apps. (3) The other way: a collection and a
// policy made through the Directus API show the same field grid, field drawer and matrix in both apps.
// Runs at proxy-api only, in chromium at 1280 px (listed in the Directus app specs of playwright.config.ts). Every collection, role, policy and user carries the configuration
// prefix and is deleted in beforeAll and afterAll. Through the API, the same in both runs: the `name`/`text`/`title`
// fields the values of §5 need in the generated collections, `seo_title` moved into `group_seo` (a drag in both apps),
// the m2a blocks (one picker drawer per collection), the `vi-VN` language (not in the 8 seeded rows), the `status`
// field the US4 permissions name, and the editor user (015 creates users).
import type { Locator, Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { apiUrl, DATA_PREFIX, directusUrl, e2eConfig } from './helpers/config.js';
import { closeHostDb, hostDb } from './helpers/db-rows.js';
import { directusApi, onDirectusApp } from './helpers/directus-app.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

test.skip(e2eConfig !== 'proxy-api', 'drives the Directus app of the main pair (proxy-api only)');
test.describe.configure({ mode: 'serial' });
test.use({ actionTimeout: 15_000 });

const P = DATA_PREFIX.replaceAll('-', '_');
// Short names (Postgres cuts identifiers at 63 characters): `_xa` is made in the new app, `_xd` in the Directus app.
const names = (base: string) => ({
	articles: base,
	comments: `${base}c`,
	categories: `${base}k`,
	sTags: `${base}s`,
	categoriesJunction: `${base}_${base}k`,
	files: `${base}_files`,
	blocks: `${base}_blocks`,
	translations: `${base}_translations`,
});
const NEW = names(`${P}_xa`);
const DIR = names(`${P}_xd`);

// An admin of this spec (the shared admin's last_page moves under the specs that run at the same time) and the editor
// of scenario 2. Test values for the parity environment only.
const XADMIN = { email: `${DATA_PREFIX}-xadmin@example.com`, password: `${P}-xadmin-test-password`, id: '' };
const EDITOR = { email: `${DATA_PREFIX}-xeditor2@example.com`, password: `${P}-xeditor2-test-password`, id: '' };
const ROLE = `${P}_xeditor2`;
const POLICY = `${P}_xeditor2_policy`;
const REVERSE = `${P}_xr`;
const REVERSE_POLICY = `${P}_xr_policy`;
/** Row icons compared on the field grid: required, primary key, hidden. */
const ROW_ICONS = ['star', 'vpn_key', 'visibility_off'];

let api: AdminApi;
let languagesExisted = true;
let viVnAdded = false;

const q = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const byName = (collection: 'roles' | 'policies', name: string) =>
	api.call<{ id: string }[]>('GET', `/${collection}?filter=${q({ name: { _eq: name } })}&fields=id`);
const exists = (collection: string) =>
	api.call('GET', `/collections/${collection}`).then(
		() => true,
		() => false,
	);

async function cleanup() {
	const users = await api.call<{ id: string }[]>(
		'GET',
		`/users?fields=id&limit=-1&filter=${q({ email: { _in: [XADMIN.email, EDITOR.email] } })}`,
	);
	if (users.length) await api.call('DELETE', '/users', { data: users.map((u) => u.id) });
	for (const collection of ['roles', 'policies'] as const) {
		const rows = await api.call<{ id: string }[]>(
			'GET',
			`/${collection}?fields=id&limit=-1&filter=${q({ name: { _starts_with: `${P}_x` } })}`,
		);
		if (rows.length) await api.call('DELETE', `/${collection}`, { data: rows.map((r) => r.id) });
	}
	// Junctions and children first; a second pass catches what a dependency kept.
	for (let pass = 0; pass < 3; pass++) {
		const left = (await api.call<{ collection: string }[]>('GET', '/collections?limit=-1'))
			.map((c) => c.collection)
			.filter((c) => c.startsWith(`${P}_x`))
			.sort((a, b) => b.length - a.length);
		if (!left.length) break;
		for (const collection of left) await api.call('DELETE', `/collections/${collection}`).catch(() => undefined);
	}
}

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	await cleanup();
	languagesExisted = await exists('languages');
	const policy = await api.createPolicy({ name: `${P}_xadmin`, admin_access: true, app_access: true });
	const role = await api.createRole({ name: `${P}_xadmin`, policies: [{ policy: policy.id }] });
	XADMIN.id = (await api.createUser({ email: XADMIN.email, password: XADMIN.password, role: role.id })).id;
	// The m2a targets: the categories the m2m makes, and `<base>s` (bo_s_tags) made here with a `name`.
	for (const base of [NEW, DIR]) await createCollection(base.sTags, [{ field: 'name', type: 'string', meta: {} }]);
	for (const base of [NEW, DIR]) await createCollection(base.articles);
});

test.afterAll(async () => {
	await cleanup();
	if (viVnAdded) await api.call('DELETE', '/items/languages/vi-VN').catch(() => undefined);
	if (!languagesExisted) await api.call('DELETE', '/collections/languages').catch(() => undefined);
	await closeHostDb();
});

test.beforeEach(async () => {
	await api.call('PATCH', `/users/${XADMIN.id}`, { data: { last_page: null } });
	await api.call('POST', '/utils/cache/clear');
});

function createCollection(collection: string, fields: Record<string, unknown>[] = []) {
	return api.call('POST', '/collections', {
		data: {
			collection,
			schema: {},
			meta: {},
			fields: [
				{
					field: 'id',
					type: 'integer',
					schema: { is_primary_key: true, has_auto_increment: true },
					meta: { hidden: true },
				},
				...fields,
			],
		},
	});
}

async function signIn(page: Page, user: { email: string; password: string; id: string } = XADMIN) {
	// Sign-in lands on last_page, which a Directus app run before may have set (shared database, cached /users/me).
	await api.call('PATCH', `/users/${user.id}`, { data: { last_page: null } });
	await api.call('POST', '/utils/cache/clear');
	await page.goto('/admin/login');
	await login(page, user);
	await expect(page).toHaveURL(/\/admin\/content/);
}

// ---- Scenario 1: the 10 fields of US3 ----

/** One field of US3 in simple mode: the card, the key, then what the card needs (related collection, type...). */
type FieldStep = {
	card: string;
	key: string;
	related?: (b: ReturnType<typeof names>) => string;
	fk?: string;
	type?: string;
	m2a?: boolean;
	required?: boolean;
};

const FIELDS: FieldStep[] = [
	{ card: 'Input', key: 'title', required: true },
	{ card: 'WYSIWYG', key: 'body' },
	{ card: 'Tags', key: 'tags', type: 'CSV' },
	{ card: 'Many to One', key: 'author', related: () => 'directus_users' },
	{ card: 'One to Many', key: 'comments', related: (b) => b.comments, fk: 'article' },
	{ card: 'Many to Many', key: 'categories', related: (b) => b.categories },
	{ card: 'Files', key: 'attachments' },
	{ card: 'Builder (M2A)', key: 'blocks', m2a: true },
	{ card: 'Translations', key: 'translations', related: () => 'languages' },
	{ card: 'Detail Group', key: 'group_seo' },
	{ card: 'Input', key: 'seo_title' },
];

async function newAppField(page: Page, base: ReturnType<typeof names>, step: FieldStep) {
	await page.goto(`/admin/settings/data-model/${base.articles}/+`);
	const drawer = page.getByRole('dialog', { name: new RegExp(base.articles) });
	await expect(drawer).toBeVisible();
	await drawer.getByRole('radio', { name: step.card, exact: true }).click();
	await drawer.getByRole('textbox', { name: 'Key', exact: true }).fill(step.key);
	if (step.required) await drawer.getByRole('checkbox', { name: 'Require value to be set' }).click();
	if (step.type) {
		await drawer.getByRole('combobox', { name: 'Type' }).click();
		await page.getByRole('option', { name: step.type, exact: true }).click();
	}
	if (step.related) await drawer.getByRole('textbox', { name: 'Collection', exact: true }).fill(step.related(base));
	if (step.fk) await drawer.getByRole('textbox', { name: 'Foreign Key', exact: true }).fill(step.fk);
	if (step.m2a) {
		await drawer.getByRole('button', { name: /^Related Collections/ }).click();
		for (const c of [base.categories, base.sTags]) await page.getByRole('option', { name: c, exact: true }).click();
		await page.keyboard.press('Escape');
	}
	await drawer.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/settings/data-model/${base.articles}$`), { timeout: 15_000 });
}

/** What both runs add through the API after the drawer (the generated collections hold only keys). */
async function afterFields(base: ReturnType<typeof names>) {
	await api.call('POST', `/fields/${base.comments}`, { data: { field: 'text', type: 'string', meta: {} } });
	await api.call('POST', `/fields/${base.categories}`, { data: { field: 'name', type: 'string', meta: {} } });
	await api.call('POST', `/fields/${base.translations}`, { data: { field: 'title', type: 'string', meta: {} } });
	// Moving a field into a group is a drag in both apps: done through the API.
	await api.call('PATCH', `/fields/${base.articles}/seo_title`, { data: { meta: { group: 'group_seo' } } });
}

/** A `.field` of a Directus form by its `.type-label` (the field drawer has no `.field-label`). */
function dField(scope: Page | Locator, label: string): Locator {
	const root = 'goto' in scope ? scope : scope.page();
	return scope.locator('.field').filter({ has: root.locator('.type-label', { hasText: new RegExp(`^\\s*${label}`) }) });
}

async function directusField(page: Page, base: ReturnType<typeof names>, step: FieldStep) {
	await page.goto(`${directusUrl}/admin/settings/data-model/${base.articles}/+`);
	const drawer = page.locator('.v-drawer').last();
	await expect(drawer.locator('button.interface').first()).toBeVisible({ timeout: 15_000 });
	await drawer
		.locator('button.interface')
		.filter({ has: page.getByText(step.card, { exact: true }) })
		.click();
	await dField(drawer, 'Key').locator('input').fill(step.key);
	if (step.required) await drawer.getByRole('checkbox', { name: /Require value to be set/ }).click();
	if (step.type) {
		await dField(drawer, 'Type').locator('.v-input').click();
		await page.locator('.v-menu-content').last().getByText(step.type, { exact: true }).click();
	}
	if (step.related)
		await dField(drawer, step.card === 'Translations' ? 'Languages Collection' : 'Related Collection')
			.locator('input')
			.fill(step.related(base));
	if (step.fk) await dField(drawer, 'Foreign Key').locator('input').fill(step.fk);
	if (step.m2a) {
		await dField(drawer, 'Related Collections').locator('.v-input').click();
		for (const c of [base.categories, base.sTags])
			await page.locator('.v-menu-content').last().getByText(c, { exact: true }).click();
		await page.keyboard.press('Escape');
	}
	await drawer.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/settings/data-model/${base.articles}$`), { timeout: 15_000 });
}

/**
 * Writes the page sends that the API refuses. Seen in both APIs under the load of parallel runs: a 403 on
 * `POST /fields/<junction>` right after `POST /collections` made it; the app then closes the drawer as Directus does.
 */
function failedWrites(page: Page): () => Promise<string[]> {
	const failed: Promise<string>[] = [];
	page.on('response', (response) => {
		const method = response.request().method();
		if (method === 'GET' || response.status() < 400) return;
		const call = `${response.status()} ${method} ${new URL(response.url()).pathname}`;
		failed.push(
			response.text().then(
				(body) => `${call} ${body.slice(0, 300)}`,
				() => call,
			),
		);
	});
	return () => Promise.all(failed);
}

type Row = Record<string, unknown>;

/** directus_collections, directus_fields and directus_relations rows of a run, ids dropped, names as the new app run. */
async function dataModelRows(base: string) {
	const mine = (name: unknown) => typeof name === 'string' && name.startsWith(base);
	const rows = async (table: string, key: string) =>
		((await hostDb().select('*').from(table)) as Row[])
			.filter((row) => mine(row[key]))
			.map(({ id: _id, ...row }) => JSON.stringify(row).replaceAll(base, NEW.articles))
			.sort();
	return {
		collections: await rows('directus_collections', 'collection'),
		fields: await rows('directus_fields', 'collection'),
		relations: await rows('directus_relations', 'many_collection'),
	};
}

/** A `.field` of the Directus item form by its label. */
function directusLabel(page: Page, label: string): Locator {
	return page.locator('.field').filter({ has: page.locator('.field-label', { hasText: new RegExp(`^\\s*${label}`) }) });
}

/** The drawer the Directus app opened last, saved with its header check button. */
async function saveDirectusDrawer(page: Page) {
	const drawers = await page.locator('.v-drawer').count();
	await page.locator('.v-drawer').last().getByRole('button', { name: 'check', exact: true }).first().click();
	await expect(page.locator('.v-drawer')).toHaveCount(drawers - 1);
}

/** The values of contracts/tests.md §5 typed in the Directus item form (blocks apart, see the caller). */
async function fillDirectusItem(page: Page, base: ReturnType<typeof names>) {
	await page.locator(`input[collection="${base.articles}"][field="title"]`).fill('Cross-use title');

	const body = directusLabel(page, 'Body').frameLocator('iframe').locator('body');
	await body.click();
	await page.keyboard.type('Body');

	const tags = directusLabel(page, 'Tags').locator('input');
	for (const tag of ['alpha', 'beta']) {
		await tags.fill(tag);
		await tags.press('Enter');
	}

	await directusLabel(page, 'Author')
		.getByRole('button', { name: /^Select an item/ })
		.click();
	const users = page.locator('.v-drawer').last();
	await users.getByRole('button', { name: 'search', exact: true }).click();
	await users.getByRole('searchbox').fill(XADMIN.email);
	await users.getByRole('row').filter({ hasText: XADMIN.email }).getByRole('checkbox').click();
	await saveDirectusDrawer(page);

	await directusLabel(page, 'Comments').getByRole('button', { name: 'Create New' }).click();
	await page.locator(`.v-drawer input[collection="${base.comments}"][field="text"]`).fill('c1');
	await saveDirectusDrawer(page);

	for (const name of ['cat-a', 'cat-b']) {
		await directusLabel(page, 'Categories').getByRole('button', { name: 'Create New' }).click();
		await page.locator(`.v-drawer input[collection="${base.categories}"][field="name"]`).fill(name);
		await saveDirectusDrawer(page);
	}

	await directusLabel(page, 'Attachments').getByRole('button', { name: 'Add Existing' }).click();
	// The picker opens on the root folder: the fixture file is in bo-files.
	await page.locator('.v-drawer').last().getByText('bo-files', { exact: true }).click();
	await page.locator('.card').filter({ hasText: 'bo-text-28' }).first().click();
	await saveDirectusDrawer(page);

	// One language at a time: pick it in the language menu, then type its title.
	const translations = directusLabel(page, 'Translations');
	for (const [lang, title] of [
		['en-US', 'Cross-use title en'],
		['vi-VN', 'Cross-use title vi'],
	] as const) {
		await translations
			.getByRole('button', { name: /expand_more$/ })
			.first()
			.click();
		// The menu of 9 languages runs past the bottom of the 800 px window: a DOM click.
		await page.locator('.v-menu-content').last().getByText(lang).first().dispatchEvent('click');
		await translations.locator(`input[collection="${base.translations}"][field="title"]`).fill(title);
	}

	await page.locator(`input[collection="${base.articles}"][field="seo_title"]`).fill('SEO');
}

test('scenario 1a: the 10 fields of US3 made in the new app field drawer', async ({ page }) => {
	await signIn(page);
	const failed = failedWrites(page);
	for (const step of FIELDS) await newAppField(page, NEW, step);
	expect(await failed(), 'writes the API refused (both apps close the drawer on them)').toEqual([]);
	await afterFields(NEW);

	for (const collection of Object.values(NEW)) expect(await exists(collection), collection).toBe(true);
	expect(await exists('languages')).toBe(true);
});

test('scenario 1b: the same steps in the Directus app write the same data model rows', async ({ browser }) => {
	await onDirectusApp(
		browser,
		async (page) => {
			const failed = failedWrites(page);
			for (const step of FIELDS) await directusField(page, DIR, step);
			expect(await failed(), 'writes the API refused (both apps close the drawer on them)').toEqual([]);
		},
		XADMIN,
	);
	await afterFields(DIR);

	// Same rows after the names of the Directus run are renamed to those of the new app run (ids dropped).
	expect(await dataModelRows(DIR.articles)).toEqual(await dataModelRows(NEW.articles));
	// The languages collection with its 8 seeded rows (made by whichever run came first).
	const languages = await api.call<{ code: string }[]>('GET', '/items/languages?fields=code&limit=-1');
	expect(languages.map((l) => l.code)).toEqual(
		expect.arrayContaining(['en-US', 'ar-SA', 'de-DE', 'fr-FR', 'ru-RU', 'es-ES', 'it-IT', 'pt-BR']),
	);
});

test('scenario 1c: the Directus app creates an item with the values of §5; the new API reads it back', async ({
	browser,
}) => {
	if (!(await api.call<unknown[]>('GET', '/items/languages?fields=code&filter[code][_eq]=vi-VN')).length) {
		await api.call('POST', '/items/languages', { data: { code: 'vi-VN', name: 'Vietnamese', direction: 'ltr' } });
		viVnAdded = true;
	}
	const [file] = await api.call<{ id: string }[]>('GET', '/files?fields=id&filter[title][_eq]=bo-text-28');
	expect(file, 'the bo-files fixture set (015)').toBeDefined();

	const id = await onDirectusApp(
		browser,
		async (page) => {
			await page.goto(`${directusUrl}/admin/content/${NEW.articles}/+`);
			await expect(page.locator(`input[collection="${NEW.articles}"][field="title"]`)).toBeVisible({ timeout: 15_000 });
			await fillDirectusItem(page, NEW);
			await page.getByRole('banner').getByRole('button', { name: 'check', exact: true }).click();
			await expect(page).toHaveURL(new RegExp(`/content/${NEW.articles}$`), { timeout: 15_000 });
		},
		XADMIN,
	).then(async () => (await api.call<{ id: number }[]>('GET', `/items/${NEW.articles}?fields=id`))[0]!.id);

	// The m2a block picker opens one drawer per collection with no stable names: the two blocks are seeded here.
	await api.call('PATCH', `/items/${NEW.articles}/${id}`, {
		data: {
			blocks: {
				create: [
					{ collection: NEW.categories, item: { name: 'block-cat' } },
					{ collection: NEW.sTags, item: { name: 'block-tag' } },
				],
				update: [],
				delete: [],
			},
		},
	});

	const item = await api.call<Record<string, any>>(
		'GET',
		`/items/${NEW.articles}/${id}?fields=${[
			'title',
			'body',
			'tags',
			'author.email',
			'comments.text',
			`categories.${NEW.categories}_id.name`,
			'attachments.directus_files_id',
			'blocks.collection',
			`blocks.item:${NEW.categories}.name`,
			`blocks.item:${NEW.sTags}.name`,
			'translations.languages_code',
			'translations.title',
			'seo_title',
		].join(',')}`,
	);
	expect(item).toEqual({
		title: 'Cross-use title',
		body: '<p>Body</p>',
		tags: ['alpha', 'beta'],
		author: { email: XADMIN.email },
		comments: [{ text: 'c1' }],
		categories: expect.arrayContaining([
			{ [`${NEW.categories}_id`]: { name: 'cat-a' } },
			{ [`${NEW.categories}_id`]: { name: 'cat-b' } },
		]),
		attachments: [{ directus_files_id: file!.id }],
		blocks: [
			{ collection: NEW.categories, item: { name: 'block-cat' } },
			{ collection: NEW.sTags, item: { name: 'block-tag' } },
		],
		translations: expect.arrayContaining([
			{ languages_code: 'en-US', title: 'Cross-use title en' },
			{ languages_code: 'vi-VN', title: 'Cross-use title vi' },
		]),
		seo_title: 'SEO',
	});
	expect(item['categories']).toHaveLength(2);
	expect(item['translations']).toHaveLength(2);
});

// ---- Scenario 3: made through the Directus API, opened in both apps ----

test('scenario 3: a collection and a policy made in Directus show the same grid, drawer and matrix in both apps', async ({
	browser,
	page,
}) => {
	await directusApi('POST', '/collections', {
		collection: REVERSE,
		schema: {},
		meta: { icon: 'article', note: 'Made in Directus' },
		fields: [
			{
				field: 'id',
				type: 'integer',
				schema: { is_primary_key: true, has_auto_increment: true },
				meta: { hidden: true },
			},
			{
				field: 'title',
				type: 'string',
				schema: { max_length: 120, is_nullable: false, default_value: 'Untitled' },
				meta: {
					interface: 'input',
					required: true,
					note: 'The headline',
					width: 'half',
					options: { placeholder: 'A title' },
				},
			},
			{
				field: 'status',
				type: 'string',
				schema: { default_value: 'draft' },
				meta: {
					interface: 'select-dropdown',
					width: 'half',
					options: {
						choices: [
							{ text: 'Draft', value: 'draft' },
							{ text: 'Published', value: 'published' },
						],
					},
				},
			},
			{ field: 'rank', type: 'integer', schema: { is_unique: true }, meta: { interface: 'input', hidden: true } },
			{ field: 'owner', type: 'uuid', schema: {}, meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
		],
	});
	await directusApi('POST', '/relations', {
		collection: REVERSE,
		field: 'owner',
		related_collection: 'directus_users',
		schema: {},
		meta: {},
	});
	await directusApi('POST', '/policies', {
		name: REVERSE_POLICY,
		app_access: false,
		permissions: [
			{ collection: REVERSE, action: 'read', fields: ['*'], permissions: null },
			{ collection: REVERSE, action: 'create', fields: ['title'], permissions: null, presets: { status: 'draft' } },
			{ collection: REVERSE, action: 'update', fields: ['*'], permissions: { owner: { _eq: '$CURRENT_USER' } } },
		],
	});
	const [policy] = await byName('policies', REVERSE_POLICY);

	const directus = await onDirectusApp(
		browser,
		async (p) => {
			await p.goto(`${directusUrl}/admin/settings/data-model/${REVERSE}`);
			await expect(p.locator('.field-select').first()).toBeVisible({ timeout: 15_000 });
			const grid = await p.locator('.field-select').evaluateAll(
				(rows, icons) =>
					rows.map((row) => ({
						key: row.querySelector('.name')?.firstChild?.textContent?.trim(),
						interface: row.querySelector('.interface')?.textContent?.trim() ?? '',
						width: row.classList.contains('half') ? 'half' : 'full',
						icons: Array.from(row.querySelectorAll('[data-icon]'))
							.map((i) => i.getAttribute('data-icon')!)
							.filter((i) => icons.includes(i))
							.sort(),
					})),
				ROW_ICONS,
			);

			await p.goto(`${directusUrl}/admin/settings/data-model/${REVERSE}/title`);
			const drawer = p.locator('.v-drawer').last();
			await expect(drawer.getByRole('spinbutton')).toHaveValue('120', { timeout: 15_000 });
			const textboxes = drawer.getByRole('textbox');
			const schema = {
				title: (await drawer.getByRole('heading', { level: 1 }).textContent())?.trim(),
				key: await textboxes.nth(0).inputValue(),
				type: await textboxes.nth(1).inputValue(),
				length: await drawer.getByRole('spinbutton').inputValue(),
				defaultValue: await drawer.getByRole('textbox', { name: 'NULL' }).inputValue(),
				// v-checkbox is a button whose icon tells the state (no aria-checked).
				checks: await drawer
					.getByRole('checkbox')
					.evaluateAll((boxes) =>
						boxes.map((b) => [
							b.textContent?.trim(),
							b.querySelector('[data-icon]')?.getAttribute('data-icon') === 'check_box',
						]),
					),
			};

			await p.goto(`${directusUrl}/admin/settings/policies/${policy!.id}`);
			const row = p.locator(`tr[data-collection="${REVERSE}"]`);
			await expect(row.locator('.toggle').first()).toBeVisible({ timeout: 15_000 });
			const matrix = await row.locator('.toggle').evaluateAll((chips) =>
				chips.map((chip) => {
					const level = ['all', 'custom', 'none'].find((l) => chip.classList.contains(l));
					return `${{ all: 'Full', custom: 'Partial', none: 'No' }[level!]} ${chip.textContent?.trim()} Access`;
				}),
			);
			return { grid, schema, matrix };
		},
		XADMIN,
	);

	await signIn(page);
	await page.goto(`/admin/settings/data-model/${REVERSE}`);
	await expect(page.locator('li[data-row-key]').first()).toBeVisible({ timeout: 15_000 });
	const grid = await page.locator('li[data-row-key]').evaluateAll(
		(rows, icons) =>
			rows.map((row) => ({
				key: row.getAttribute('data-row-key'),
				interface: row.querySelector('button span.text-theme-xs')?.textContent?.trim() ?? '',
				width: row.className.includes('col-span-2') ? 'full' : 'half',
				icons: Array.from(row.querySelectorAll('[data-icon]'))
					.map((i) => i.getAttribute('data-icon')!)
					.filter((i) => icons.includes(i))
					.sort(),
			})),
		ROW_ICONS,
	);

	await page.goto(`/admin/settings/data-model/${REVERSE}/title`);
	const drawer = page.getByRole('dialog', { name: new RegExp(REVERSE) });
	await expect(drawer.getByRole('spinbutton', { name: 'Length' })).toHaveValue('120', { timeout: 15_000 });
	const schema = {
		title: (await drawer.getByRole('heading', { level: 2 }).textContent())?.trim(),
		key: await drawer.getByRole('textbox', { name: 'Key' }).inputValue(),
		type: (await drawer.getByRole('tabpanel').getByRole('combobox').first().innerText())
			.replace('expand_more', '')
			.trim(),
		length: await drawer.getByRole('spinbutton', { name: 'Length' }).inputValue(),
		defaultValue: await drawer.getByRole('textbox', { name: 'Default Value' }).inputValue(),
		checks: await Promise.all(
			(await drawer.getByRole('tabpanel').getByRole('checkbox').all()).map(async (box) => [
				(await box.getAttribute('aria-label')) ?? (await box.textContent())?.trim(),
				await box.isChecked(),
			]),
		),
	};

	await page.goto(`/admin/settings/policies/${policy!.id}`);
	const row = page.locator(`[data-permissions-matrix] tr[data-collection="${REVERSE}"]`);
	await expect(row.getByRole('button', { name: /Access$/ }).first()).toBeVisible({ timeout: 15_000 });
	const matrix = await row
		.getByRole('button', { name: /Access$/ })
		.evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label')));

	expect.soft({ grid, schema, matrix }).toEqual(directus);
	expect(directus.matrix).toEqual([
		'Partial Create Access',
		'Full Read Access',
		'Partial Update Access',
		'No Delete Access',
		'No Share Access',
	]);
	expect(directus.grid.map((r) => r.key)).toEqual(['id', 'title', 'status', 'rank', 'owner']);
});

// ---- Scenario 2: role, policy and the US4 permissions made in the new app ----

test('scenario 2a: role, policy and permissions on the articles made in the new app', async ({ page }) => {
	await api.call('POST', `/fields/${NEW.articles}`, {
		data: { field: 'status', type: 'string', meta: { interface: 'input' } },
	});
	await signIn(page);

	await page.goto('/admin/settings/roles');
	await page.getByRole('link', { name: 'Create Role' }).click();
	await page.getByRole('dialog', { name: 'Create Role' }).getByRole('textbox', { name: 'Role Name' }).fill(ROLE);
	await page.getByRole('dialog', { name: 'Create Role' }).getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('heading', { level: 1, name: `${ROLE} Role` })).toBeVisible();

	await page.goto('/admin/settings/policies');
	await page.getByRole('link', { name: 'Create Policy' }).click();
	const dialog = page.getByRole('dialog', { name: 'Create Policy' });
	await dialog.getByRole('textbox', { name: 'Policy Name' }).fill(POLICY);
	await dialog.getByRole('group', { name: 'App Access' }).getByRole('checkbox', { name: 'Enabled' }).check();
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('heading', { level: 1, name: `${POLICY} Policy` })).toBeVisible();

	const matrix = page.locator('[data-permissions-matrix]');
	await page.getByRole('button', { name: 'Add Collection' }).click();
	await page.getByRole('menuitem', { name: NEW.articles, exact: true }).click();
	const row = matrix.locator(`tr[data-collection="${NEW.articles}"]`);

	await row.getByRole('button', { name: 'No Read Access' }).click();
	await page.getByRole('menuitem', { name: 'All Access' }).click();

	// create: fields title and status, validation title not null, preset status draft.
	await row.getByRole('button', { name: 'No Create Access' }).click();
	await page.getByRole('menuitem', { name: 'Use Custom' }).click();
	let drawer = page.getByRole('dialog', { name: new RegExp(`${POLICY} -> ${NEW.articles} -> Create`) });
	for (const name of ['Title', 'Status']) await drawer.getByRole('treeitem', { name: new RegExp(`^${name}`) }).click();
	await drawer.getByRole('tab', { name: /Field Validation/ }).click();
	await drawer.getByRole('button', { name: /Add Filter/ }).click();
	await page
		.getByRole('dialog', { name: 'Add Filter' })
		.getByRole('treeitem', { name: /^title$/i })
		.click();
	await drawer.getByRole('button', { name: 'Contains', exact: true }).click();
	await page.getByRole('menu', { name: 'Contains' }).getByRole('menuitem', { name: "Isn't null" }).click();
	await drawer.getByRole('tab', { name: /Field Presets/ }).click();
	await drawer.locator('.CodeMirror').click();
	await page.keyboard.type('{"status": "draft"}');
	await drawer.getByRole('button', { name: 'Save' }).click();
	await expect(drawer).toBeHidden();

	// update: items whose author is the current user, fields title and status.
	await row.getByRole('button', { name: 'No Update Access' }).click();
	await page.getByRole('menuitem', { name: 'Use Custom' }).click();
	drawer = page.getByRole('dialog', { name: new RegExp(`${POLICY} -> ${NEW.articles} -> Update`) });
	await drawer.getByRole('tab', { name: /Item Permissions/ }).click();
	await drawer.getByRole('button', { name: /Add Filter/ }).click();
	await page
		.getByRole('dialog', { name: 'Add Filter' })
		.getByRole('treeitem', { name: /author$/ })
		.getByText('author', { exact: true })
		.click();
	await drawer.getByRole('textbox', { name: 'Value' }).fill('$CURRENT_USER');
	await drawer.getByRole('tab', { name: /Field Permissions/ }).click();
	for (const name of ['Title', 'Status']) await drawer.getByRole('treeitem', { name: new RegExp(`^${name}`) }).click();
	await drawer.getByRole('button', { name: 'Save' }).click();
	await expect(drawer).toBeHidden();

	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/settings\/policies$/);

	// The policy goes to the role on the role page (policies, list-m2m of directus_access).
	const [role] = await byName('roles', ROLE);
	const [policy] = await byName('policies', POLICY);
	await page.goto(`/admin/settings/roles/${role!.id}`);
	const policies = page.locator('main [data-field="policies"]');
	await policies.getByRole('button', { name: 'Add Existing' }).click();
	const select = page.getByRole('dialog').last();
	await select
		.getByRole('row', { name: new RegExp(POLICY) })
		.getByRole('checkbox')
		.click();
	await select.getByRole('button', { name: 'Save' }).click();
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/settings\/roles$/);

	// What US4 writes: 3 permission rows on the articles (no delete, no share) and the role-policy access row.
	type Permission = { action: string; fields: string[]; permissions: unknown; validation: unknown; presets: unknown };
	const rows = await api.call<Permission[]>(
		'GET',
		`/permissions?filter=${q({ policy: { _eq: policy!.id }, collection: { _eq: NEW.articles } })}&fields=action,fields,permissions,validation,presets&sort=action`,
	);
	expect(rows).toEqual([
		{
			action: 'create',
			fields: ['title', 'status'],
			permissions: null,
			validation: { _and: [{ title: { _nnull: true } }] },
			presets: { status: 'draft' },
		},
		{ action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
		{
			action: 'update',
			fields: ['title', 'status'],
			permissions: { _and: [{ author: { _eq: '$CURRENT_USER' } }] },
			validation: null,
			presets: null,
		},
	]);
	expect(await api.call('GET', `/access?filter=${q({ role: { _eq: role!.id } })}&fields=policy`)).toEqual([
		{ policy: policy!.id },
	]);
});

/** The Directus app or the new app (the new app runs on the Playwright baseURL). */
type AppUrl = (path: string) => string;
const DIRECTUS_APP: AppUrl = (path) => `${directusUrl}/admin${path}`;
const NEW_APP: AppUrl = (path) => `/admin${path}`;

/** A header button by its icon: both apps name the icon in `data-icon` (v-icon, BoIcon). */
const iconButton = (page: Page, icon: string) => page.locator(`button:has([data-icon="${icon}"])`).first();

async function buttonState(button: Locator) {
	if (!(await button.count())) return 'absent';
	return (await button.isDisabled()) ? 'off' : 'on';
}

const itemsCall = (method: string) => (response: { url: () => string; request: () => { method: () => string } }) =>
	new URL(response.url()).pathname.endsWith(`/items/${NEW.articles}`) ||
	new URL(response.url()).pathname.includes(`/items/${NEW.articles}/`)
		? response.request().method() === method
		: false;

/**
 * The six operations of SC-003 as the editor, measured by HTTP status and DOM: create, read, update the own item,
 * update another author's item (blocked), delete (blocked), fields. With "read all" (US4) no field is unreadable, so
 * the sixth compares which fields the create form puts in the DOM and which of them are read-only.
 */
async function sixOperations(page: Page, url: AppUrl, tag: string, own: number, other: number) {
	const input = (key: string) => page.locator(`[data-field="${key}"][data-collection="${NEW.articles}"] input`).first();

	// 1 and 6: the create form: which fields are in the DOM, which inputs are read-only, the preset; then create.
	await page.goto(url(`/content/${NEW.articles}/+`));
	await expect(input('title')).toBeVisible({ timeout: 15_000 });
	const fields = await page
		.locator(`[data-field][data-collection="${NEW.articles}"]`)
		.evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute('data-field')))].sort());
	const readOnly: Record<string, boolean> = {};
	for (const key of ['title', 'status', 'seo_title']) readOnly[key] = await input(key).isDisabled();
	const preset = await input('status').inputValue();
	await input('title').fill(`${tag} created`);
	const [created] = await Promise.all([page.waitForResponse(itemsCall('POST')), iconButton(page, 'check').click()]);

	// 2: read the list.
	const [read] = await Promise.all([
		page.waitForResponse(itemsCall('GET')),
		page.goto(url(`/content/${NEW.articles}`)),
	]);
	const otherListed = await page
		.getByText(`${P} other`, { exact: true })
		.first()
		.isVisible({ timeout: 15_000 })
		.catch(() => false);

	// 4: the item of another author: read-only, no save; 5: delete.
	await page.goto(url(`/content/${NEW.articles}/${other}`));
	await expect(input('title')).toHaveValue(`${P} other`, { timeout: 15_000 });
	const otherItem = {
		titleReadOnly: await input('title').isDisabled(),
		save: await buttonState(iconButton(page, 'check')),
		delete: await buttonState(iconButton(page, 'delete')),
	};

	// 3: the editor's own item: edit and save.
	await page.goto(url(`/content/${NEW.articles}/${own}`));
	await expect(input('title')).toHaveValue(new RegExp(`^${P} own`), { timeout: 15_000 });
	const ownItem = {
		titleReadOnly: await input('title').isDisabled(),
		seoTitleReadOnly: await input('seo_title').isDisabled(),
		delete: await buttonState(iconButton(page, 'delete')),
	};
	await input('title').fill(`${P} own ${tag}`);
	const [updated] = await Promise.all([page.waitForResponse(itemsCall('PATCH')), iconButton(page, 'check').click()]);

	return {
		create: { status: created.status(), fields, readOnly, preset },
		read: { status: read.status(), otherListed },
		updateOwn: { status: updated.status(), ...ownItem },
		updateOther: otherItem,
	};
}

/** The blocked writes sent straight to an API as the editor. */
async function blockedCalls(
	request: import('@playwright/test').APIRequestContext,
	base: string,
	own: number,
	other: number,
) {
	const login = await request.post(`${base}/auth/login`, { data: { email: EDITOR.email, password: EDITOR.password } });
	const token = ((await login.json()) as { data: { access_token: string } }).data.access_token;
	const headers = { Authorization: `Bearer ${token}` };
	return {
		updateOther: (
			await request.patch(`${base}/items/${NEW.articles}/${other}`, { headers, data: { title: 'x' } })
		).status(),
		deleteOwn: (await request.delete(`${base}/items/${NEW.articles}/${own}`, { headers })).status(),
	};
}

test('scenario 2b: the editor gets the same result for the six operations of SC-003 in both apps', async ({
	browser,
	page,
	playwright,
}) => {
	const [role] = await byName('roles', ROLE);
	EDITOR.id = (await api.createUser({ email: EDITOR.email, password: EDITOR.password, role: role!.id })).id;
	const seed = (title: string, author: string) =>
		api.call<{ id: number }>('POST', `/items/${NEW.articles}`, { data: { title, author } }).then((item) => item.id);
	const own = await seed(`${P} own`, EDITOR.id);
	const other = await seed(`${P} other`, XADMIN.id);

	const directus = await onDirectusApp(browser, (p) => sixOperations(p, DIRECTUS_APP, 'dir', own, other), EDITOR);
	await signIn(page, EDITOR);
	const backoffice = await sixOperations(page, NEW_APP, 'bo', own, other);
	// Soft: the blocked API calls and the preset rows below still run when the DOM differs.
	expect.soft(backoffice).toEqual(directus);
	expect(directus).toMatchObject({
		create: { status: 200, preset: 'draft', readOnly: { title: false, status: false, seo_title: true } },
		read: { status: 200, otherListed: true },
		updateOwn: { status: 200, titleReadOnly: false },
		updateOther: { titleReadOnly: true, save: 'off' },
	});

	const request = await playwright.request.newContext();
	const calls = {
		directus: await blockedCalls(request, directusUrl, own, other),
		backoffice: await blockedCalls(request, apiUrl, own, other),
	};
	expect(calls.backoffice).toEqual(calls.directus);
	expect(calls.directus).toEqual({ updateOther: 403, deleteOwn: 403 });
	await request.dispose();

	// The created items carry the create preset in both apps.
	const created = await api.call<{ title: string; status: string }[]>(
		'GET',
		`/items/${NEW.articles}?filter=${q({ title: { _ends_with: ' created' } })}&fields=title,status&sort=title`,
	);
	expect(created).toEqual([
		{ title: 'bo created', status: 'draft' },
		{ title: 'dir created', status: 'draft' },
	]);
});
