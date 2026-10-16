// Feature 016 T110 (SC-005, contracts/tests.md §4, api-calls #157–#177): the Settings module sends the writes of the
// Directus app 11.17.4. Each test runs the same UI scenario on the Directus app (8155) and on the Backoffice app, records
// the write requests (helpers/payload.ts: `method`, `path`, `query`, `body` after normalization) and compares them; the
// rows the scenario left in the 10 tables (db-rows.ts `changesSince` with SETTINGS_TABLES) are compared too, scoped to
// the rows of this spec. Both runs use the same names (`<prefix>_pl`): the rows of the first run are deleted before the
// second. Drag and drop is not driven in the Directus app (SortableJS force-fallback trees): those tests compare the
// Backoffice body with the body the Directus source builds (cited). proxy-api only.
import type { Browser, Page, Response } from '@playwright/test';
import { AdminApi } from '../helpers/api.js';
import { apiUrl, DATA_PREFIX, directusUrl, e2eConfig } from '../helpers/config.js';
import { changesSince, closeHostDb, hostDb, SETTINGS_TABLES, snapshot } from '../helpers/db-rows.js';
import { card, chooseInMenu, dismissOwnerDialog, field, onDirectusApp, type SignIn } from '../helpers/directus-app.js';
import { Fixtures } from '../helpers/fixtures.js';
import { calls, normalize, recordWrites, signInBackoffice, type Write } from '../helpers/payload.js';
import { expect, test } from '../helpers/requests.js';

test.skip(e2eConfig !== 'proxy-api', 'payload comparison runs in proxy-api only');
test.use({ actionTimeout: 15_000 });
// Default mode: in order in the one worker (playwright.config.ts), a failed test does not skip the next ones.
test.describe.configure({ mode: 'default' });
test.setTimeout(240_000);

/** Collection names (db-safe) and row names of this spec: other specs of the configuration use DATA_PREFIX alone. */
const P = `${DATA_PREFIX.replaceAll('-', '_')}_pl`;
const NAME = `${DATA_PREFIX}-pl`;

let api: AdminApi;
let fixtures: Fixtures;
// An admin of its own: the admin's last_page is moved by the other specs' sessions, and sign-in lands there.
let user: SignIn & { id: string };
let fixtureRole: string;

test.beforeAll(async ({ playwright }) => {
	const request = await playwright.request.newContext();
	api = new AdminApi(request);
	// The web app's preview server only proxies the app's API paths: users, roles and policies go to Directus (same DB).
	fixtures = new Fixtures(new AdminApi(request, directusUrl));
	fixtureRole = await fixtures.role('payload settings', { admin: true });
	user = await fixtures.user('settings', { role: fixtureRole });
});

test.afterAll(async () => {
	await fixtures.cleanup();
	await closeHostDb();
});

const q = (value: unknown) => encodeURIComponent(JSON.stringify(value));

async function dropCollections(...names: string[]) {
	for (const name of names) await api.call('DELETE', `/collections/${name}`).catch(() => undefined);
	// Tables created by SQL (no meta) or left by a failed run; only this spec's names.
	for (const name of names.filter((n) => n.startsWith(P))) await hostDb().schema.dropTableIfExists(name);
	await api.call('POST', '/utils/cache/clear');
}

const PK = [
	{ field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true }, meta: { hidden: true } },
];

async function createCollection(collection: string, meta: Record<string, unknown> = {}, fields: unknown[] = []) {
	await api.call('POST', '/collections', { data: { collection, schema: {}, meta, fields: [...PK, ...fields] } });
}

/* ------------------------------------------------------------------------------------------- DB comparison */

type Rows = { added: unknown[]; changed: unknown[]; removed: unknown[] };
// Tables whose rows only point at the scenario rows by key (role/policy links, permissions).
const LINKED = new Set(['directus_access', 'directus_permissions']);
const MARKER = /<id\d+>/g;

/**
 * `changesSince` scoped to this spec: rows naming `P`/`NAME`, rows of LINKED tables pointing at their keys, and the
 * activity of those. Other specs write the same tables meanwhile, and the sign-in writes directus_users rows. Markers are
 * renumbered in order of appearance after the rows are sorted, so the two runs compare.
 */
function scoped(changes: Record<string, unknown>): unknown {
	const text = (v: unknown) => JSON.stringify(v);
	const mine = (v: unknown) => text(v).includes(P) || text(v).includes(NAME);
	const tables = Object.entries(changes).filter(([table]) => table !== 'activity') as [string, Rows][];
	// The signed-in user's row changes with each page (last_page, last_access): not a scenario write.
	(changes['directus_users'] as Rows).changed = [];
	const kept: Record<string, Rows> = {};
	for (const [table, rows] of tables)
		kept[table] = {
			added: rows.added.filter(mine),
			changed: rows.changed.filter(mine),
			removed: rows.removed.filter(mine),
		};

	const keys = new Set(text(kept).match(MARKER) ?? []);
	for (const [table, rows] of tables.filter(([t]) => LINKED.has(t))) {
		const linked = (v: unknown) => !mine(v) && (text(v).match(MARKER) ?? []).some((m) => keys.has(m));
		for (const k of ['added', 'changed', 'removed'] as const) kept[table]![k].push(...rows[k].filter(linked));
	}

	const activity = (changes['activity'] as { item: string }[]).filter((a) => mine(a) || keys.has(String(a.item)));
	const sortRows = (rows: unknown[]) =>
		[...rows].sort((a, b) => text(a).replace(MARKER, '<id>').localeCompare(text(b).replace(MARKER, '<id>')));
	const result = {
		...Object.fromEntries(
			Object.entries(kept).map(([t, r]) => [
				t,
				{ added: sortRows(r.added), changed: sortRows(r.changed), removed: sortRows(r.removed) },
			]),
		),
		activity,
	};

	const markers = new Map<string, string>();
	return JSON.parse(
		text(result).replace(MARKER, (m) => {
			if (!markers.has(m)) markers.set(m, `<id${markers.size + 1}>`);
			return markers.get(m)!;
		}),
	);
}

/* ------------------------------------------------------------------------------------------- the two runs */

interface Scenario {
	/** Page both runs start from (under /admin). */
	start: string;
	/** Rows both runs start with; returns their keys (normalized as `<id1>`... like the keys the runs create). */
	setup?: () => Promise<(string | number)[]>;
	/** Deletes what setup and the run created; called before each run and at the end. */
	cleanup: () => Promise<void>;
	directus: (page: Page, ids: (string | number)[]) => Promise<void>;
	backoffice: (page: Page, ids: (string | number)[]) => Promise<void>;
}

interface Result {
	bo: Write[];
	dir: Write[];
	boDb: unknown;
	dirDb: unknown;
}

async function run(page: Page, origin: string, scenario: Scenario, ids: (string | number)[], directus: boolean) {
	await page.goto(`${origin}/admin${scenario.start}`);
	await expect(page.getByRole('main').first()).toBeVisible({ timeout: 15_000 });
	if (directus) await dismissOwnerDialog(page);
	const before = await snapshot(SETTINGS_TABLES);
	const steps = directus ? scenario.directus : scenario.backoffice;
	// A write the API refused leaves other rows than the app meant: the shared schema cache of the parity pair can lag
	// right after DDL ("Field ... doesn't exist"). Reported as such instead of as a row difference; rerun then.
	const refused: string[] = [];
	const onResponse = async (response: Response) => {
		const request = response.request();
		if (response.status() < 400 || !['POST', 'PATCH', 'DELETE'].includes(request.method())) return;
		refused.push(`${request.method()} ${request.url()} ${response.status()} ${await response.text().catch(() => '')}`);
	};
	page.on('response', onResponse);
	const app = directus ? 'Directus' : 'Backoffice';
	const recorded = await recordWrites(page, directus ? directusUrl : apiUrl, () => steps(page, ids)).catch((error) => {
		// The steps wait for the page the app shows after a successful save: name the refused write first.
		throw refused.length ? new Error(`${app} API refused a write:\n${refused.join('\n')}`) : error;
	});
	page.off('response', onResponse);
	expect(refused, `${app} API refused a write`).toEqual([]);
	const db = await changesSince(before, SETTINGS_TABLES);
	return { writes: withoutListPresets(normalize(recorded, ids)), db: scoped(db as Record<string, unknown>) };
}

const LAYOUT_KEYS = ['layout', 'layout_query', 'layout_options', 'filter', 'search'];

/**
 * Without the auto-save of the list's own layout preset (usePreset of the presets and translations lists, a debounced
 * POST/PATCH /presets whose place in the sequence depends on timing): payload/presets.spec.ts compares those.
 */
function withoutListPresets(writes: Write[]): Write[] {
	return writes.filter(({ method, path, body }) => {
		if (method === 'DELETE' || !/^\/presets(\/[^/]+)?$/.test(path)) return true;
		if (!body || typeof body !== 'object' || Array.isArray(body) || 'keys' in body) return true;
		const preset = body as Record<string, unknown>;
		return typeof preset['bookmark'] === 'string' || !LAYOUT_KEYS.some((key) => key in preset);
	});
}

/** The fixture user's presets: the Settings lists save their layout state as the user's preset (usePreset). */
async function deleteUserPresets() {
	const presets = await api.call<{ id: number }[]>('GET', `/presets?fields=id&limit=-1&filter[user][_eq]=${user.id}`);
	if (presets.length) await api.call('DELETE', '/presets', { data: presets.map((p) => p.id) });
}

async function compare(browser: Browser, page: Page, scenario: Scenario): Promise<Result> {
	const cleanup = scenario.cleanup;
	scenario = { ...scenario, cleanup: async () => (await deleteUserPresets(), await cleanup()) };
	try {
		await scenario.cleanup();
		const dirIds = (await scenario.setup?.()) ?? [];
		await api.call('POST', '/utils/cache/clear');
		const dir = await onDirectusApp(browser, (p) => run(p, directusUrl, scenario, dirIds, true), user);

		await scenario.cleanup();
		const boIds = (await scenario.setup?.()) ?? [];
		await signInBackoffice(page, api, user);
		const bo = await run(page, '', scenario, boIds, false);
		return { bo: bo.writes, dir: dir.writes, boDb: bo.db, dirDb: dir.db };
	} finally {
		await scenario.cleanup();
	}
}

/** The writes and the rows of both apps are the same; the Directus app sent `expected`. */
function same(result: Result, expected: string[]) {
	expect(calls(result.dir)).toEqual(expected);
	expect(calls(result.bo)).toEqual(calls(result.dir));
	expect(result.bo).toEqual(result.dir);
	expect(result.boDb).toEqual(result.dirDb);
}

/* ------------------------------------------------------------------------------------------- Directus app UI */

/** A header-bar button of the Directus app (page or the last drawer), by its icon. */
function dirButton(page: Page, icon: string, scope: 'page' | 'drawer' = 'page') {
	const root = scope === 'drawer' ? page.locator('.v-drawer').last() : page;
	return root
		.locator('header button')
		.filter({ has: page.locator(`i[data-icon="${icon}"]`) })
		.first();
}

/** The row of `key` in the data model tree of the Directus app. */
function dirCollectionRow(page: Page, key: string) {
	return page
		.locator('.v-list-item')
		.filter({ has: page.locator('.collection-name', { hasText: new RegExp(`^${key}$`) }) })
		.first();
}

async function dirCollectionMenu(page: Page, key: string, item: string) {
	await dirCollectionRow(page, key).locator('.ctx-toggle').click();
	await chooseInMenu(page, item);
}

/* ------------------------------------------------------------------------------------------- Backoffice UI */

async function boRowMenu(page: Page, key: string, item: string) {
	await page.getByRole('button', { name: `Options for ${key}`, exact: true }).click();
	await page
		.getByRole('menuitem', { name: item })
		.or(page.getByRole('menuitemradio', { name: item }))
		.click();
}

/* ------------------------------------------------------------------------------------------- data model tree */

const FOLDER = `${P}_folder`;

test('folder: create, edit, hide, start collapsed, delete (#157, #159, #160)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: '/settings/data-model',
		cleanup: () => dropCollections(FOLDER),
		async directus(p) {
			await dirButton(p, 'create_new_folder').click();
			await card(p).getByPlaceholder('Folder Key...').fill(FOLDER);
			await card(p).getByRole('button', { name: 'Save' }).click();
			await expect(dirCollectionRow(p, FOLDER)).toBeVisible();

			await dirCollectionRow(p, FOLDER).click();
			await card(p).getByPlaceholder('Note').fill('Folder note');
			await card(p).getByRole('button', { name: 'Save' }).click();
			await expect(p.locator('.v-card')).toHaveCount(0);

			await dirCollectionMenu(p, FOLDER, 'Make Folder Hidden');
			await p.waitForTimeout(500);
			await dirCollectionMenu(p, FOLDER, 'Start Collapsed');
			await p.waitForTimeout(500);
			await dirCollectionMenu(p, FOLDER, 'Delete Folder');
			await card(p).getByRole('button', { name: 'Delete Folder' }).click();
			await expect(dirCollectionRow(p, FOLDER)).toHaveCount(0);
		},
		async backoffice(p) {
			const tree = p.getByRole('region', { name: 'Data Model' });
			await p.getByRole('button', { name: 'Create Folder' }).click();
			const create = p.getByRole('dialog', { name: 'Create Folder' });
			await create.getByRole('textbox', { name: 'Folder Key...' }).fill(FOLDER);
			await create.getByRole('button', { name: 'Save' }).click();
			await expect(tree.getByText(FOLDER, { exact: true })).toBeVisible();

			await tree.getByRole('button', { name: FOLDER, exact: true }).click();
			const edit = p.getByRole('dialog', { name: 'Edit Folder' });
			await edit.getByRole('textbox', { name: 'Note' }).fill('Folder note');
			await edit.getByRole('button', { name: 'Save' }).click();
			await expect(edit).toBeHidden();

			await boRowMenu(p, FOLDER, 'Make Folder Hidden');
			await p.waitForTimeout(500);
			await boRowMenu(p, FOLDER, 'Start Collapsed');
			await p.waitForTimeout(500);
			await boRowMenu(p, FOLDER, 'Delete Folder');
			await p.getByRole('dialog').getByRole('button', { name: 'Delete Folder' }).click();
			await expect(tree.getByText(FOLDER, { exact: true })).toHaveCount(0);
		},
	});

	same(result, [
		'POST /collections',
		`PATCH /collections/${FOLDER}`,
		`PATCH /collections/${FOLDER}`,
		`PATCH /collections/${FOLDER}`,
		`DELETE /collections/${FOLDER}`,
	]);
});

const NEW_COLLECTION = `${P}_new`;

test('new collection with the six optional system fields (#157, #165)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: '/settings/data-model/+',
		cleanup: () => dropCollections(NEW_COLLECTION),
		async directus(p) {
			const drawer = p.locator('.v-drawer').last();
			await p.getByPlaceholder('A unique table name...').fill(NEW_COLLECTION);
			await drawer.getByRole('button', { name: 'arrow_forward', exact: true }).click();
			await expect(p.locator('.system .v-checkbox')).toHaveCount(6);
			for (const box of await p.locator('.system .v-checkbox').all()) await box.click();
			const created = p.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/collections'));
			await drawer.getByRole('button', { name: 'check', exact: true }).click();
			const response = await created;
			expect(response.ok(), await response.text()).toBe(true);
			await expect(p).toHaveURL(new RegExp(`/settings/data-model/${NEW_COLLECTION}$`), { timeout: 30_000 });
		},
		async backoffice(p) {
			const drawer = p.getByRole('dialog', { name: 'Creating New Collection' });
			await drawer.locator('#new-collection-name').fill(NEW_COLLECTION);
			await drawer.locator('#new-collection-name').press('Enter');
			for (const name of ['Status', 'Sort', 'Created On', 'Created By', 'Updated On', 'Updated By'])
				await drawer.getByRole('checkbox', { name }).click();
			await drawer.getByRole('button', { name: 'Finish Setup' }).click();
			await expect(p).toHaveURL(new RegExp(`/settings/data-model/${NEW_COLLECTION}$`), { timeout: 30_000 });
		},
	});

	same(result, ['POST /collections', 'POST /relations', 'POST /relations']);
});

/** Records the writes of `steps` on the Backoffice app alone (scenarios the Directus app is not driven for). */
async function backofficeOnly(page: Page, start: string, steps: (page: Page) => Promise<void>): Promise<Write[]> {
	await signInBackoffice(page, api, user);
	await page.goto(`/admin${start}`);
	await expect(page.getByRole('main').first()).toBeVisible({ timeout: 15_000 });
	return normalize(await recordWrites(page, apiUrl, () => steps(page)));
}

const BOX = `${P}_box`;
const BOX_CHILD = `${P}_box_child`;

test('tree drag and collapse: a collection moved into the folder above (#158)', async ({ page }) => {
	// The Directus app moves rows only by SortableJS drag (force-fallback, nested lists), not driven here. Dropping a row
	// into a folder calls CollectionItem.vue onGroupSortChange → collections.vue onSort(updates, false), which sends
	// `PATCH /collections` with `[{ collection, meta: { sort: index + 1, group } }]` for the folder's children; the
	// Backoffice Indent (D-96) is that move. Collapse/expand is local state in both apps (use-expand-collapse.ts,
	// localStorage): no write.
	const cleanup = () => dropCollections(BOX_CHILD, BOX);
	await cleanup();
	try {
		await api.call('POST', '/collections', { data: { collection: BOX, meta: { icon: 'folder', sort: 99990 } } });
		await createCollection(BOX_CHILD, { sort: 99991 });
		const writes = await backofficeOnly(page, '/settings/data-model', async (p) => {
			await boRowMenu(p, BOX_CHILD, 'Indent');
			await expect
				.poll(async () => (await api.call<{ meta: { group: string } }>('GET', `/collections/${BOX_CHILD}`)).meta.group)
				.toBe(BOX);
			await p.getByRole('button', { name: `Collapse ${BOX}` }).click();
			await p.getByRole('button', { name: `Expand ${BOX}` }).click();
		});

		expect(writes).toEqual([
			{ method: 'PATCH', path: '/collections', body: [{ collection: BOX_CHILD, meta: { group: BOX, sort: 1 } }] },
		]);
	} finally {
		await cleanup();
	}
});

const RAW_DELETE = `${P}_rawdel`;
const RAW_OPEN = `${P}_rawopen`;

test('tables without meta: delete one, open the other (#159, #160)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: '/settings/data-model',
		cleanup: () => dropCollections(RAW_DELETE, RAW_OPEN),
		async setup() {
			for (const name of [RAW_DELETE, RAW_OPEN]) await hostDb().schema.createTable(name, (t) => t.increments('id'));
			await api.call('POST', '/utils/cache/clear');
			return [];
		},
		async directus(p) {
			// The row shows the formatted name: find it by its link.
			const row = (name: string) =>
				p.locator('.db-only .v-list-item').filter({ has: p.locator(`a[href="/admin/settings/data-model/${name}"]`) });
			await row(RAW_DELETE).locator('.ctx-toggle').click();
			await chooseInMenu(p, 'Delete Collection');
			await card(p).getByRole('button', { name: 'Delete Collection' }).click();
			await expect(row(RAW_DELETE)).toHaveCount(0);
			await row(RAW_OPEN).locator('a').click();
			await expect(p).toHaveURL(new RegExp(`/settings/data-model/${RAW_OPEN}$`));
			await expect(p.locator('.field-select').first()).toBeVisible();
		},
		async backoffice(p) {
			const raw = p.getByRole('region', { name: 'Database Only: Click to Configure' });
			await boRowMenu(p, RAW_DELETE, 'Delete Collection');
			await p.getByRole('dialog').getByRole('button', { name: 'Delete Collection' }).click();
			await expect(raw.locator(`a[href="/admin/settings/data-model/${RAW_DELETE}"]`)).toHaveCount(0);
			await raw.locator(`a[href="/admin/settings/data-model/${RAW_OPEN}"]`).click();
			await expect(p).toHaveURL(new RegExp(`/settings/data-model/${RAW_OPEN}$`));
			await expect(p.getByRole('heading', { name: 'Fields & Layout' })).toBeVisible();
		},
	});

	same(result, [`DELETE /collections/${RAW_DELETE}`, `PATCH /collections/${RAW_OPEN}`]);
});

const TARGET = `${P}_target`;
const SOURCE = `${P}_source`;

test('delete a collection with peer dependencies (#164, #160)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: '/settings/data-model',
		cleanup: () => dropCollections(SOURCE, TARGET),
		async setup() {
			await createCollection(TARGET);
			await createCollection(SOURCE);
			await api.call('POST', `/fields/${SOURCE}`, {
				data: {
					field: 't_ref',
					type: 'integer',
					schema: {},
					meta: { interface: 'select-dropdown-m2o', special: ['m2o'] },
				},
			});
			// The schema the API caches can lag right after the DDL ("Field t_ref doesn't exist"): retried.
			await expect(async () => {
				await api.call('POST', '/utils/cache/clear');
				await api.call('POST', '/relations', {
					data: { collection: SOURCE, field: 't_ref', related_collection: TARGET },
				});
			}).toPass({ timeout: 15_000 });
			return [];
		},
		async directus(p) {
			await dirCollectionMenu(p, TARGET, 'Delete Collection');
			await expect(card(p)).toContainText(`t_ref (${SOURCE})`);
			await card(p).getByRole('button', { name: 'Delete Collection' }).click();
			await expect(dirCollectionRow(p, TARGET)).toHaveCount(0);
		},
		async backoffice(p) {
			await boRowMenu(p, TARGET, 'Delete Collection');
			await expect(p.getByRole('dialog')).toContainText(`t_ref (${SOURCE})`);
			await p.getByRole('dialog').getByRole('button', { name: 'Delete Collection' }).click();
			await expect(p.getByRole('button', { name: `Options for ${TARGET}`, exact: true })).toHaveCount(0);
		},
	});

	same(result, [`DELETE /fields/${SOURCE}/t_ref`, `DELETE /collections/${TARGET}`]);
});

/* ------------------------------------------------------------------------------------------- field grid */

const GRID = `${P}_grid`;
const STRING = (field: string) => ({ field, type: 'string', schema: {}, meta: { interface: 'input' } });

async function gridSetup() {
	await createCollection(GRID, {}, [STRING('title'), STRING('body')]);
	await hostDb().schema.alterTable(GRID, (t) => t.string('raw_col'));
	await api.call('POST', '/utils/cache/clear');
	return [];
}

/** A field row of the Directus app's field grid. */
const dirFieldRow = (p: Page, name: string) =>
	p.locator('.field-select').filter({ has: p.locator('.name', { hasText: new RegExp(`^\\s*${name}\\s*$`) }) });

async function dirFieldMenu(p: Page, name: string, item: string) {
	await dirFieldRow(p, name).getByRole('button', { name: 'more_vert' }).click();
	await chooseInMenu(p, item);
}

async function boFieldMenu(p: Page, name: string, item: string) {
	await p.getByRole('button', { name: `Options for ${name}`, exact: true }).click();
	await p.getByRole('menuitem', { name: item }).click();
}

test('field grid: hide, width, duplicate, delete, open a field without meta (#163, #161, #164)', async ({
	browser,
	page,
}) => {
	const result = await compare(browser, page, {
		start: `/settings/data-model/${GRID}`,
		cleanup: () => dropCollections(GRID),
		setup: gridSetup,
		async directus(p) {
			await dirFieldMenu(p, 'title', 'Hide Field on Detail');
			await p.waitForTimeout(500);
			await dirFieldMenu(p, 'title', 'Half Width');
			await p.waitForTimeout(500);
			await dirFieldMenu(p, 'body', 'Duplicate Field');
			await card(p).getByRole('button', { name: 'Duplicate' }).click();
			await expect(dirFieldRow(p, 'body_copy')).toBeVisible();
			await dirFieldMenu(p, 'body_copy', 'Delete Field');
			await card(p).getByRole('button', { name: 'Delete' }).click();
			await expect(dirFieldRow(p, 'body_copy')).toHaveCount(0);
			await dirFieldRow(p, 'raw_col').locator('.label').click();
			await expect(p).toHaveURL(new RegExp(`/settings/data-model/${GRID}/raw_col$`));
		},
		async backoffice(p) {
			await boFieldMenu(p, 'title', 'Hide Field on Detail');
			await p.waitForTimeout(500);
			await boFieldMenu(p, 'title', 'Half Width');
			await p.waitForTimeout(500);
			await boFieldMenu(p, 'body', 'Duplicate Field');
			const duplicate = p.getByRole('dialog', { name: 'Where would you like to duplicate this field to?' });
			await duplicate.getByRole('button', { name: 'Duplicate' }).click();
			await expect(p.getByRole('button', { name: 'Options for body_copy', exact: true })).toBeVisible();
			await boFieldMenu(p, 'body_copy', 'Delete Field');
			await p.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
			await expect(p.getByRole('button', { name: 'Options for body_copy', exact: true })).toHaveCount(0);
			await p.getByRole('button', { name: /^raw_col / }).click();
			await expect(p).toHaveURL(new RegExp(`/settings/data-model/${GRID}/raw_col$`));
		},
	});

	same(result, [
		`PATCH /fields/${GRID}/title`,
		`PATCH /fields/${GRID}/title`,
		`POST /fields/${GRID}`,
		`DELETE /fields/${GRID}/body_copy`,
		`PATCH /fields/${GRID}/raw_col`,
	]);
});

test('field grid drag: the order saved as the whole list (#162)', async ({ page }) => {
	// The Directus app reorders fields only by SortableJS drag (force-fallback, fallback-on-body), not driven here. A drop
	// calls fields-management.vue setSort(fields) → fieldsStore.updateFields: `PATCH /fields/<c>` with
	// `[{ field, meta: { sort: index + 1, group: null } }]` for every root field in the new order (usableFields: `id`
	// included, fields without meta too). The Backoffice "Move down" (D-96) is that move.
	await dropCollections(GRID);
	try {
		await gridSetup();
		const writes = await backofficeOnly(page, `/settings/data-model/${GRID}`, async (p) => {
			await boFieldMenu(p, 'title', 'Move down');
			await p.waitForTimeout(1_000);
		});

		const order = ['id', 'body', 'title', 'raw_col'];
		expect(writes).toEqual([
			{
				method: 'PATCH',
				path: `/fields/${GRID}`,
				body: order.map((field, index) => ({ field, meta: { group: null, sort: index + 1 } })),
			},
		]);
	} finally {
		await dropCollections(GRID);
	}
});

/* ------------------------------------------------------------------------------------------- field drawer (US3) */

// Short names: the m2m junction is `<articles>_<tags>` and Postgres cuts identifiers at 63 characters.
const ARTICLES = `${P}_fa`;
const COMMENTS = `${P}_fc`;
const TAGS = `${P}_ft`;
// Its own languages collection: `languages` is created and deleted by other specs meanwhile.
const LANGUAGES = `${P}_lang`;

interface DrawerField {
	/** Interface card of the simple mode. */
	card: string;
	key: string;
	related?: string;
	foreignKey?: string;
	required?: boolean;
	expected: string[];
}

// The field types of US3 in the simple mode (cross-use fields of contracts/tests.md §5: title, author, comments, tags,
// translations, group_seo). Rich text, the m2a builder and files reuse the same store steps as input and m2m.
const DRAWER_FIELDS: DrawerField[] = [
	{ card: 'Input', key: 'title', required: true, expected: [`POST /fields/${ARTICLES}`] },
	{
		card: 'Many to One',
		key: 'author',
		related: 'directus_users',
		expected: [`POST /fields/${ARTICLES}`, 'POST /relations'],
	},
	{
		card: 'One to Many',
		key: 'comments',
		related: COMMENTS,
		foreignKey: 'article',
		expected: [`POST /fields/${ARTICLES}`, 'POST /collections', `POST /fields/${COMMENTS}`, 'POST /relations'],
	},
	{
		card: 'Many to Many',
		key: 'tags',
		related: TAGS,
		expected: [
			`POST /fields/${ARTICLES}`,
			'POST /collections',
			'POST /collections',
			`POST /fields/${ARTICLES}_${TAGS}`,
			`POST /fields/${ARTICLES}_${TAGS}`,
			'POST /relations',
			'POST /relations',
		],
	},
	{
		card: 'Translations',
		key: 'translations',
		related: LANGUAGES,
		expected: [
			`POST /fields/${ARTICLES}`,
			'POST /collections',
			'POST /collections',
			`POST /fields/${ARTICLES}_translations`,
			`POST /fields/${ARTICLES}_translations`,
			'POST /relations',
			'POST /relations',
			`POST /items/${LANGUAGES}`,
		],
	},
	{ card: 'Detail Group', key: 'group_seo', expected: [`POST /fields/${ARTICLES}`] },
];

for (const f of DRAWER_FIELDS) {
	test(`field drawer, simple mode: ${f.card} (#157, #161, #163, #165, #167)`, async ({ browser, page }) => {
		const result = await compare(browser, page, {
			start: `/settings/data-model/${ARTICLES}/+`,
			async cleanup() {
				await dropCollections(`${ARTICLES}_translations`, `${ARTICLES}_${TAGS}`, COMMENTS, TAGS, LANGUAGES, ARTICLES);
			},
			async setup() {
				await createCollection(ARTICLES);
				return [];
			},
			async directus(p) {
				const drawer = p.locator('.v-drawer').last();
				await drawer.locator('.interface').getByText(f.card, { exact: true }).first().click();
				await drawer.getByPlaceholder('A unique column name...').fill(f.key);
				if (f.required) await drawer.locator('.v-checkbox', { hasText: 'Require value to be set' }).click();
				if (f.related) await drawer.getByPlaceholder('Collection...').first().fill(f.related);
				if (f.foreignKey) await drawer.getByPlaceholder('Foreign Key').first().fill(f.foreignKey);
				await drawer.getByRole('button', { name: 'Save', exact: true }).click();
				await expect(p).toHaveURL(new RegExp(`/settings/data-model/${ARTICLES}$`), { timeout: 30_000 });
			},
			async backoffice(p) {
				const drawer = p.getByRole('dialog', { name: new RegExp(`New Field \\(${ARTICLES}\\)|${ARTICLES}`) });
				await drawer.getByRole('radio', { name: f.card, exact: true }).click();
				await drawer.getByRole('textbox', { name: 'Key', exact: true }).fill(f.key);
				if (f.required) await drawer.getByRole('checkbox', { name: 'Require value to be set' }).click();
				if (f.related) await drawer.getByRole('textbox', { name: 'Collection', exact: true }).fill(f.related);
				if (f.foreignKey) await drawer.getByRole('textbox', { name: 'Foreign Key', exact: true }).fill(f.foreignKey);
				await drawer.getByRole('button', { name: 'Save', exact: true }).click();
				await expect(p).toHaveURL(new RegExp(`/settings/data-model/${ARTICLES}$`), { timeout: 30_000 });
			},
		});

		same(result, f.expected);
	});
}

test('field drawer, advanced mode: required on an existing field (#163)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: `/settings/data-model/${ARTICLES}/title`,
		cleanup: () => dropCollections(ARTICLES),
		async setup() {
			await createCollection(ARTICLES, {}, [STRING('title')]);
			return [];
		},
		async directus(p) {
			const drawer = p.locator('.v-drawer').last();
			await drawer.locator('.v-tab').getByText('Field', { exact: true }).click();
			await drawer.locator('.v-checkbox', { hasText: 'Require value to be set' }).click();
			await dirButton(p, 'check', 'drawer').click();
			await expect(p).toHaveURL(new RegExp(`/settings/data-model/${ARTICLES}$`), { timeout: 30_000 });
		},
		async backoffice(p) {
			const drawer = p.getByRole('dialog', { name: new RegExp(ARTICLES) });
			await drawer.getByRole('tab', { name: 'Field', exact: true }).click();
			await drawer.getByRole('checkbox', { name: 'Require value to be set' }).click();
			await drawer.getByRole('button', { name: 'Save', exact: true }).click();
			await expect(p).toHaveURL(new RegExp(`/settings/data-model/${ARTICLES}$`), { timeout: 30_000 });
		},
	});

	same(result, [`PATCH /fields/${ARTICLES}/title`]);
});

test('enable translations with the helper (#168)', async ({ browser, page }) => {
	// The helper uses the `languages` collection (created and seeded when missing): it is deleted after each run only when
	// it did not exist before, like settings-data-model.spec.ts. Other specs that create it meanwhile change the body
	// (`createLanguagesCollection`); rerun then.
	const languagesExisted = await api.call('GET', '/collections/languages').then(
		() => true,
		() => false,
	);
	const result = await compare(browser, page, {
		start: `/settings/data-model/${ARTICLES}`,
		async cleanup() {
			await api.call('DELETE', `/fields/${ARTICLES}/translations`).catch(() => undefined);
			await dropCollections(`${ARTICLES}_translations`, ARTICLES);
			if (!languagesExisted) await api.call('DELETE', '/collections/languages').catch(() => undefined);
		},
		async setup() {
			await createCollection(ARTICLES, {}, [STRING('title')]);
			return [];
		},
		async directus(p) {
			await p.getByRole('button', { name: 'Enable Translations' }).click();
			const drawer = p.locator('.v-drawer').last();
			await drawer.getByRole('button', { name: 'Enable', exact: true }).click();
			await expect(p.locator('.v-drawer')).toHaveCount(0, { timeout: 30_000 });
		},
		async backoffice(p) {
			await p.getByRole('button', { name: 'Enable Translations' }).click();
			const drawer = p.getByRole('dialog', { name: 'Enable Translations' });
			await drawer.getByRole('button', { name: 'Enable', exact: true }).click();
			await expect(drawer).toBeHidden({ timeout: 30_000 });
		},
	});

	same(result, ['POST /utils/translations/generate']);
});

/* ------------------------------------------------------------------------------------------- roles and policies */

const ROLE = `${NAME} role`;
const POLICY = `${NAME} policy`;
const PUBLIC_POLICY = `${NAME} public`;
const USER_EMAIL = `${NAME}-member@example.com`;
const INVITE_EMAIL = `${NAME}-invite@example.com`;

async function deleteByName(collection: 'roles' | 'policies', names: string[]) {
	const rows = await api.call<{ id: string }[]>(
		'GET',
		`/${collection}?fields=id&limit=-1&filter=${q({ name: { _in: names } })}`,
	);
	if (rows.length) await api.call('DELETE', `/${collection}`, { data: rows.map((r) => r.id) });
}

async function deleteUsers() {
	const users = await api.call<{ id: string }[]>(
		'GET',
		`/users?fields=id&limit=-1&filter=${q({ email: { _starts_with: `${NAME}-` } })}`,
	);
	if (users.length) await api.call('DELETE', '/users', { data: users.map((u) => u.id) });
}

/** Picks the row `name` in the item drawer an m2o or m2m interface of the Directus app opens, then confirms. */
async function dirPickInDrawer(page: Page, name: string) {
	const drawer = page.locator('.v-drawer').last();
	await drawer.locator('button.icon-search').click();
	await drawer.locator('input[placeholder="Search Items..."]').fill(name);
	await drawer.locator('tr.table-row', { hasText: name }).first().click();
	await dirButton(page, 'check', 'drawer').click();
	await expect(drawer).toBeHidden();
}

/** Same in the Backoffice app's DrawerCollection. */
async function boPickInDrawer(page: Page, name: string) {
	const drawer = page.getByRole('dialog', { name: /Select Item/ });
	await drawer.getByRole('button', { name: 'Search', exact: true }).click();
	await drawer.getByRole('searchbox').fill(name);
	await drawer
		.getByRole('row', { name: new RegExp(name) })
		.first()
		.click();
	await drawer.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(drawer).toBeHidden();
}

test('role: create, add a policy and a user, invite, delete (#169, #177)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: '/settings/roles/+',
		async cleanup() {
			await deleteUsers();
			await deleteByName('roles', [ROLE]);
			await deleteByName('policies', [POLICY]);
		},
		async setup() {
			const policy = await api.call<{ id: string }>('POST', '/policies', {
				data: { name: POLICY, icon: 'badge', app_access: true, admin_access: false },
			});
			const member = await api.call<{ id: string }>('POST', '/users', {
				data: { email: USER_EMAIL, status: 'active' },
			});
			return [policy.id, member.id];
		},
		async directus(p) {
			await card(p).getByPlaceholder('Role Name...').fill(ROLE);
			await card(p).getByRole('button', { name: 'Save' }).click();
			await expect(p).toHaveURL(/\/settings\/roles\/[0-9a-f-]{36}$/);
			const roleUrl = p.url();

			await dirButton(p, 'person_add').click();
			await card(p).locator('textarea').fill(INVITE_EMAIL);
			await card(p).getByRole('button', { name: 'Invite' }).click();
			await expect(card(p).locator('textarea')).toBeHidden();

			await field(p, 'Policies').getByRole('button', { name: 'Add Existing' }).click();
			await dirPickInDrawer(p, POLICY);
			await field(p, 'Users').getByRole('button', { name: 'Add Existing' }).click();
			await dirPickInDrawer(p, USER_EMAIL);
			await dirButton(p, 'check').click();
			await expect(p).toHaveURL(/\/settings\/roles$/);

			await p.goto(roleUrl);
			await dirButton(p, 'delete').click();
			await card(p).getByRole('button', { name: 'Delete' }).click();
			await expect(p).toHaveURL(/\/settings\/roles$/);
		},
		async backoffice(p) {
			const create = p.getByRole('dialog', { name: 'Create Role' });
			await create.getByRole('textbox', { name: 'Role Name' }).fill(ROLE);
			await create.getByRole('button', { name: 'Save' }).click();
			await expect(p).toHaveURL(/\/settings\/roles\/[0-9a-f-]{36}$/);
			const roleUrl = p.url();

			await p.getByRole('button', { name: 'Invite Users' }).click();
			await p.getByRole('dialog').getByLabel('Emails').fill(INVITE_EMAIL);
			await p.getByRole('dialog').getByRole('button', { name: 'Invite' }).click();
			await expect(p.getByRole('dialog')).toBeHidden();

			await p.locator('main [data-field="policies"]').getByRole('button', { name: 'Add Existing' }).click();
			await boPickInDrawer(p, POLICY);
			await p.locator('main [data-field="users"]').getByRole('button', { name: 'Add Existing' }).click();
			await boPickInDrawer(p, USER_EMAIL);
			await p.getByRole('button', { name: 'Save', exact: true }).click();
			await expect(p).toHaveURL(/\/settings\/roles$/);

			await p.goto(roleUrl);
			await p.getByRole('button', { name: 'Delete', exact: true }).click();
			await p.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
			await expect(p).toHaveURL(/\/settings\/roles$/);
		},
	});

	same(result, ['POST /roles', 'POST /users/invite', 'PATCH /roles/<id3>', 'DELETE /roles/<id3>']);
});

test('Public: add a policy, then remove it (#172)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: '/settings/roles/public',
		cleanup: () => deleteByName('policies', [PUBLIC_POLICY]),
		async setup() {
			const policy = await api.call<{ id: string }>('POST', '/policies', {
				data: { name: PUBLIC_POLICY, icon: 'badge', app_access: false, admin_access: false },
			});
			return [policy.id];
		},
		async directus(p) {
			const policies = field(p, 'Policies');
			await policies.getByRole('button', { name: 'Add Existing' }).click();
			await dirPickInDrawer(p, PUBLIC_POLICY);
			await dirButton(p, 'check').click();
			await expect(p).toHaveURL(/\/settings\/roles$/);

			await p.goto(`${directusUrl}/admin/settings/roles/public`);
			const row = policies.locator('.v-list-item', { hasText: PUBLIC_POLICY });
			await row.locator('.item-actions .v-icon').last().click();
			const confirm = card(p).getByRole('button', { name: 'Delete' });
			if (await confirm.isVisible().catch(() => false)) await confirm.click();
			await dirButton(p, 'check').click();
			await expect(p).toHaveURL(/\/settings\/roles$/);
		},
		async backoffice(p) {
			const policies = p.locator('main [data-field="policies"]');
			await policies.getByRole('button', { name: 'Add Existing' }).click();
			await boPickInDrawer(p, PUBLIC_POLICY);
			await p.getByRole('button', { name: 'Save', exact: true }).click();
			await expect(p).toHaveURL(/\/settings\/roles$/);

			await p.goto('/admin/settings/roles/public');
			await policies
				.getByRole('listitem')
				.filter({ hasText: PUBLIC_POLICY })
				.getByRole('button', { name: 'Remove Item' })
				.click();
			const confirm = p.getByRole('dialog').getByRole('button', { name: 'Delete' });
			if (await confirm.isVisible().catch(() => false)) await confirm.click();
			await p.getByRole('button', { name: 'Save', exact: true }).click();
			await expect(p).toHaveURL(/\/settings\/roles$/);
		},
	});

	same(result, ['POST /access', 'DELETE /access']);
});

const COPY = `${POLICY} (copy)`;

test('policy: create with app access, matrix edit, duplicate, delete (#170, #171)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: '/settings/policies/+',
		cleanup: () => deleteByName('policies', [POLICY, COPY]),
		async directus(p) {
			await card(p).getByPlaceholder('Policy Name...').fill(POLICY);
			// App Access (the first of the two checkboxes).
			await card(p).getByRole('checkbox').first().click();
			await card(p).getByRole('button', { name: 'Save' }).click();
			await expect(p).toHaveURL(/\/settings\/policies\/[0-9a-f-]{36}$/);
			const policyUrl = p.url();

			await p.getByRole('button', { name: /Add Collection/ }).click();
			await chooseInMenu(p, 'bo_std');
			const row = p.locator('tr.permissions-row[data-collection="bo_std"]');
			await row.getByRole('button', { name: 'Read' }).click();
			await chooseInMenu(p, 'All Access');
			await dirButton(p, 'check').click();
			await expect(p).toHaveURL(/\/settings\/policies$/);

			await p.locator('tr.table-row', { hasText: POLICY }).first().locator('.ctx-toggle').click();
			await chooseInMenu(p, 'Duplicate Policy');
			await card(p).getByRole('button', { name: 'Duplicate' }).click();
			await expect(p.locator('tr.table-row', { hasText: COPY })).toBeVisible();

			await p.goto(policyUrl);
			await dirButton(p, 'delete').click();
			await card(p).getByRole('button', { name: 'Delete' }).click();
			await expect(p).toHaveURL(/\/settings\/policies$/);
		},
		async backoffice(p) {
			const create = p.getByRole('dialog', { name: 'Create Policy' });
			await create.getByRole('textbox', { name: 'Policy Name' }).fill(POLICY);
			await create.getByRole('group', { name: 'App Access' }).getByRole('checkbox', { name: 'Enabled' }).check();
			await create.getByRole('button', { name: 'Save' }).click();
			await expect(p).toHaveURL(/\/settings\/policies\/[0-9a-f-]{36}$/);
			const policyUrl = p.url();

			await p.getByRole('button', { name: 'Add Collection' }).click();
			await p.getByRole('menuitem', { name: 'bo_std', exact: true }).click();
			const row = p.locator('[data-permissions-matrix] tr[data-collection="bo_std"]');
			await row.getByRole('button', { name: 'No Read Access' }).click();
			await p.getByRole('menuitem', { name: 'All Access' }).click();
			await p.getByRole('button', { name: 'Save', exact: true }).click();
			await expect(p).toHaveURL(/\/settings\/policies$/);

			await p.getByRole('button', { name: `Options for ${POLICY}` }).click();
			await p.getByRole('menuitem', { name: 'Duplicate Policy' }).click();
			await p.getByRole('dialog', { name: 'Duplicate Policy' }).getByRole('button', { name: 'Duplicate' }).click();
			await expect(p.getByRole('row', { name: new RegExp(COPY.replace(/[()]/g, '\\$&')) })).toBeVisible();

			await p.goto(policyUrl);
			await p.getByRole('button', { name: 'Delete', exact: true }).click();
			await p.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
			await expect(p).toHaveURL(/\/settings\/policies$/);
		},
	});

	same(result, [
		'POST /policies',
		'POST /permissions',
		'PATCH /policies/<id1>',
		'POST /policies',
		'POST /permissions',
		'DELETE /policies/<id1>',
	]);
});

/* ------------------------------------------------------------------------------------------- project, appearance */

const SETTINGS_KEYS = [
	'project_name',
	'project_color',
	'project_owner',
	'project_usage',
	'org_name',
	'product_updates',
];
const OWNER = `${NAME}-owner@example.com`;

test('project name, project owner, appearance color (#173, #174)', async ({ browser, page }) => {
	const original = await api.call<Record<string, unknown>>('GET', `/settings?fields=${SETTINGS_KEYS.join(',')}`);
	const result = await compare(browser, page, {
		start: '/settings/project',
		cleanup: async () => {
			await api.call('PATCH', '/settings', { data: original });
		},
		async directus(p) {
			await field(p, 'Project Name').getByRole('textbox').fill(`${NAME} project`);
			await dirButton(p, 'check').click();
			await expect(dirButton(p, 'check')).toBeDisabled();

			await p.locator('.system-owner .v-list-item').click();
			const drawer = p.locator('.v-drawer').last();
			await field(drawer, 'Owner Email').locator('input').fill(OWNER);
			await dirButton(p, 'check', 'drawer').click();
			await expect(p.locator('.v-drawer')).toHaveCount(0);

			await p.goto(`${directusUrl}/admin/settings/appearance`);
			await field(p, 'Project Color').getByRole('textbox').fill('#2ECDA7');
			await dirButton(p, 'check').click();
			await expect(dirButton(p, 'check')).toBeDisabled();
		},
		async backoffice(p) {
			const save = p.getByRole('button', { name: 'Save', exact: true });
			await p.locator('main [data-field="project_name"]').getByRole('textbox').fill(`${NAME} project`);
			await save.click();
			await expect.poll(async () => (await api.getSettings())['project_name']).toBe(`${NAME} project`);

			await p.locator('main [data-field="project_owner"]').getByRole('button', { name: 'Edit Project Owner' }).click();
			const drawer = p.getByRole('dialog', { name: 'Update Project Owner' });
			await drawer.locator('[data-field="project_owner"]').getByRole('textbox').fill(OWNER);
			await drawer.getByRole('button', { name: 'Save' }).click();
			await expect(drawer).toBeHidden();

			await p.goto('/admin/settings/appearance');
			const color = p.locator('main [data-field="project_color"]').getByRole('textbox');
			await color.fill('#2ECDA7');
			await color.press('Tab');
			await save.click();
			await expect.poll(async () => String((await api.getSettings())['project_color']).toUpperCase()).toBe('#2ECDA7');
		},
	});

	same(result, ['PATCH /settings', 'POST /settings/owner', 'PATCH /settings']);
});

/* ------------------------------------------------------------------------------------------- presets, translations */

const PRESET = `${NAME} preset`;
const BATCH = `${NAME} batch`;

/** Searches the Directus app's list, selects the rows matching `text` (expects `count`). */
async function dirSelectRows(p: Page, text: string, count: number) {
	await p.locator('.search-input').click();
	await p.locator('.search-input input').fill(text);
	const rows = p.locator('tbody tr, .table-row').filter({ hasText: text });
	await expect(rows).toHaveCount(count);
	for (const row of await rows.all()) await row.locator('.v-checkbox, [role="checkbox"]').first().click();
	return rows;
}

async function boSearch(p: Page, text: string, count: number) {
	await p.getByRole('button', { name: 'Search', exact: true }).click();
	await p.getByRole('searchbox', { name: 'Search Items...' }).fill(text);
	// Not every row: the user's own preset of the list matches its saved `search` too.
	const rows = p.getByRole('main').getByRole('table').locator('tbody tr').filter({ hasText: text });
	await expect(rows).toHaveCount(count);
	return rows;
}

async function boSelectRows(p: Page, text: string, count: number) {
	const rows = await boSearch(p, text, count);
	for (const box of await rows.getByRole('checkbox', { name: 'Select Item' }).all()) await box.check();
	return rows;
}

/** Batch edit of the selected rows (`label`: an input or textarea field), then batch delete of the same rows. */
async function dirBatchEditDelete(p: Page, text: string, label: string, value: string) {
	await dirSelectRows(p, text, 2);
	await dirButton(p, 'edit').click();
	const drawer = p.locator('.v-drawer').last();
	await field(drawer, label).getByRole('checkbox').click();
	await field(drawer, label).locator('input, textarea').first().fill(value);
	await dirButton(p, 'check', 'drawer').click();
	await expect(p.locator('.v-drawer')).toHaveCount(0);

	await dirSelectRows(p, text, 2);
	await dirButton(p, 'delete').click();
	// The parity API caches GET answers (no auto purge): the list may still show the rows, wait for the answer.
	const deleted = p.waitForResponse((r) => r.request().method() === 'DELETE');
	await card(p).getByRole('button', { name: 'Delete' }).click();
	expect((await deleted).ok()).toBe(true);
}

async function boBatchEditDelete(p: Page, text: string, label: string, value: string) {
	await boSelectRows(p, text, 2);
	await p.getByRole('button', { name: 'Edit', exact: true }).click();
	const drawer = p.getByRole('dialog', { name: /^Batch Editing/ });
	await drawer.getByRole('checkbox', { name: label }).click();
	await drawer.getByRole('textbox', { name: label }).fill(value);
	await drawer.getByRole('button', { name: 'Save' }).click();
	await expect(drawer).toHaveCount(0);

	await boSelectRows(p, text, 2);
	await p.getByRole('button', { name: 'Delete', exact: true }).click();
	const deleted = p.waitForResponse((r) => r.request().method() === 'DELETE');
	await p.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	expect((await deleted).ok()).toBe(true);
}

async function deletePresets() {
	const presets = await api.call<{ id: number }[]>(
		'GET',
		`/presets?fields=id&limit=-1&filter=${q({ bookmark: { _starts_with: NAME } })}`,
	);
	if (presets.length) await api.call('DELETE', '/presets', { data: presets.map((p) => p.id) });
}

/** The preset the run created (opened by its URL: a search would save the list's layout preset in between). */
async function presetId() {
	await expect
		.poll(
			async () =>
				(await api.call<unknown[]>('GET', `/presets?fields=id&filter=${q({ bookmark: { _eq: PRESET } })}`)).length,
		)
		.toBe(1);
	const [preset] = await api.call<{ id: number }[]>(
		'GET',
		`/presets?fields=id&filter=${q({ bookmark: { _eq: PRESET } })}`,
	);
	return preset!.id;
}

test('preset: create, edit the scope, delete, batch edit, batch delete (#175)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: '/settings/presets/+',
		cleanup: deletePresets,
		async setup() {
			const rows = await api.call<{ id: number }[]>('POST', '/presets', {
				data: ['a', 'b'].map((n) => ({ bookmark: `${BATCH} ${n}`, collection: 'bo_content', layout: 'tabular' })),
			});
			return rows.map((r) => r.id);
		},
		async directus(p) {
			await field(p, 'Name').locator('input').first().fill(PRESET);
			await field(p, 'Collection').locator('.v-input').first().click();
			await chooseInMenu(p, 'bo_content');
			await dirButton(p, 'check').click();
			await expect(p).toHaveURL(/\/settings\/presets$/);

			const presetUrl = `${directusUrl}/admin/settings/presets/${await presetId()}`;
			await p.goto(presetUrl);
			await field(p, 'Scope').locator('.v-input').first().click();
			await chooseInMenu(p, 'Role: Select...');
			await dirPickInDrawer(p, `${DATA_PREFIX} payload settings`);
			await dirButton(p, 'check').click();
			await expect(p).toHaveURL(/\/settings\/presets$/);

			await p.goto(presetUrl);
			await dirButton(p, 'delete').click();
			await card(p).getByRole('button', { name: 'Delete' }).click();
			await expect(p).toHaveURL(/\/settings\/presets$/);

			await dirBatchEditDelete(p, BATCH, 'Search', 'batch search');
		},
		async backoffice(p) {
			const choose = async (name: string, option: string | RegExp) => {
				await p.locator(`main [data-field="${name}"]`).getByRole('combobox').click();
				await p.getByRole('option', { name: option }).click();
			};
			await p.locator('main [data-field="name"]').getByRole('textbox').fill(PRESET);
			await choose('collection', 'bo_content');
			await p.getByRole('button', { name: 'Save', exact: true }).click();
			await expect(p).toHaveURL(/\/settings\/presets$/);

			const presetUrl = `/admin/settings/presets/${await presetId()}`;
			await p.goto(presetUrl);
			await choose('scope', 'Role: Select...');
			await boPickInDrawer(p, `${DATA_PREFIX} payload settings`);
			await p.getByRole('button', { name: 'Save', exact: true }).click();
			await expect(p).toHaveURL(/\/settings\/presets$/);

			await p.goto(presetUrl);
			await p.getByRole('button', { name: 'Delete', exact: true }).click();
			await p.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
			await expect(p).toHaveURL(/\/settings\/presets$/);

			await boBatchEditDelete(p, BATCH, 'Search', 'batch search');
		},
	});

	same(result, ['POST /presets', 'PATCH /presets/<id3>', 'DELETE /presets', 'PATCH /presets', 'DELETE /presets']);
});

const KEY = `${NAME}-key`;
const BATCH_KEY = `${NAME}-batch`;

async function deleteTranslations() {
	const rows = await api.call<{ id: string }[]>(
		'GET',
		`/translations?fields=id&limit=-1&filter=${q({ key: { _starts_with: NAME } })}`,
	);
	if (rows.length) await api.call('DELETE', '/translations', { data: rows.map((r) => r.id) });
}

async function translationId() {
	const find = () => api.call<{ id: string }[]>('GET', `/translations?fields=id&filter=${q({ key: { _eq: KEY } })}`);
	await expect.poll(async () => (await find()).length).toBe(1);
	return (await find())[0]!.id;
}

test('translation: create, edit, delete, batch edit, batch delete (#176)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: '/settings/translations/+',
		cleanup: deleteTranslations,
		async setup() {
			const rows = await api.call<{ id: string }[]>('POST', '/translations', {
				data: ['a', 'b'].map((n) => ({ key: `${BATCH_KEY}-${n}`, language: 'en-US', value: n })),
			});
			return rows.map((r) => r.id);
		},
		async directus(p) {
			await field(p, 'Key').getByRole('textbox').fill(KEY);
			await field(p, 'Language').locator('.v-input').click();
			await p.getByRole('button', { name: 'English (United States)', exact: true }).click();
			await field(p, 'Value').getByRole('textbox').fill('Hello');
			await dirButton(p, 'check').click();
			await expect(p).toHaveURL(/\/settings\/translations$/);

			const itemUrl = `${directusUrl}/admin/settings/translations/${await translationId()}`;
			await p.goto(itemUrl);
			await field(p, 'Value').getByRole('textbox').fill('Hi');
			await dirButton(p, 'check').click();
			await expect(p).toHaveURL(/\/settings\/translations$/);

			await p.goto(itemUrl);
			await dirButton(p, 'delete').click();
			await card(p).getByRole('button', { name: 'Delete' }).click();
			await expect(p).toHaveURL(/\/settings\/translations$/);

			await dirBatchEditDelete(p, BATCH_KEY, 'Value', 'batch value');
		},
		async backoffice(p) {
			const value = p.locator('main [data-field="value"]').getByRole('textbox');
			await p.locator('main [data-field="key"]').getByRole('textbox').fill(KEY);
			await p.locator('main [data-field="language"]').getByRole('combobox').click();
			await p.getByRole('option', { name: 'English (United States)' }).click();
			await value.fill('Hello');
			await p.getByRole('button', { name: 'Save', exact: true }).click();
			await expect(p).toHaveURL(/\/settings\/translations$/);

			const itemUrl = `/admin/settings/translations/${await translationId()}`;
			await p.goto(itemUrl);
			await value.fill('Hi');
			await p.getByRole('button', { name: 'Save', exact: true }).click();
			await expect(p).toHaveURL(/\/settings\/translations$/);

			await p.goto(itemUrl);
			await p.getByRole('button', { name: 'Delete', exact: true }).click();
			await p.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
			await expect(p).toHaveURL(/\/settings\/translations$/);

			await boBatchEditDelete(p, BATCH_KEY, 'Value', 'batch value');
		},
	});

	same(result, [
		'POST /translations',
		'PATCH /translations/<id3>',
		'DELETE /translations/<id3>',
		'PATCH /translations',
		'DELETE /translations',
	]);
});
