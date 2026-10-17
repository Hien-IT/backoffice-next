// Feature 017 T090 (SC-006, contracts/tests.md §4, api-calls #178–#184): the Flows editor sends the writes of the Directus
// app 11.17.4. Each test runs the same UI scenario on the Directus app (8155) and on the Backoffice app, records the
// writes (helpers/payload.ts `recordWrites`, `normalize`, `normalizeFlowsBody`) and compares them; after the scenarios
// that write flows or operations, the rows they left in directus_flows and directus_operations (db-rows.ts
// `changesSince` with FLOWS_TABLES) are compared too, scoped to the flows of this spec. Both runs use the same names
// (`<prefix>-pf-<n>`): the rows of the first run are deleted before the second. Scenario (9) reads only: it compares the
// GET /revisions the Logs section sends. No scenario makes cyclic operation data (R-48). proxy-api only.
import type { Browser, Page, Request } from '@playwright/test';
import { AdminApi } from '../helpers/api.js';
import { apiUrl, DATA_PREFIX, directusUrl, e2eConfig } from '../helpers/config.js';
import { openSidebar } from '../helpers/content.js';
import { changesSince, closeHostDb, FLOWS_TABLES, snapshot } from '../helpers/db-rows.js';
import {
	card,
	chooseInMenu,
	dirAddOperation,
	dirDragTile,
	dirLink,
	dirSaveFlow,
	dirTile,
	dirTileMenu,
	headerButton,
	onDirectusApp,
	openSidebarSection,
} from '../helpers/directus-app.js';
import {
	addOperation as boAdd,
	createTempFlow,
	dragPanel,
	editFlow as boEdit,
	linkHandle,
	panel,
	panelByPrefix,
	saveFlow as boSave,
	tileMenu as boTileMenu,
} from '../helpers/flows.js';
import {
	calls,
	canonicalPath,
	normalize,
	normalizeFlowsBody,
	recordWrites,
	signInBackoffice,
	type Write,
} from '../helpers/payload.js';
import { apiPath, expect, test } from '../helpers/requests.js';

test.skip(e2eConfig !== 'proxy-api', 'payload comparison runs in proxy-api only');
test.use({ actionTimeout: 15_000 });
// Default mode: in order in the one worker (playwright.config.ts), a failed test does not skip the next ones.
test.describe.configure({ mode: 'default' });
test.setTimeout(240_000);

const NAME = `${DATA_PREFIX}-pf`;
const flowName = (n: string) => `${NAME}-${n}`;

let api: AdminApi;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	await cleanup();
});

test.afterAll(async () => {
	await cleanup();
	await closeHostDb();
});

async function cleanup() {
	const rows = await api.call<{ id: string }[]>(
		'GET',
		`/flows?filter[name][_starts_with]=${encodeURIComponent(NAME)}&fields=id&limit=-1`,
	);
	if (rows.length > 0) await api.call('DELETE', '/flows', { data: rows.map((row) => row.id) });
}

/* ------------------------------------------------------------------------------------------- set-up rows */

type Node = { key: string; type: string; x: number; y: number; options?: unknown; resolve?: Node; reject?: Node };

/** A manual flow on bo_content with `tree` under its trigger; returns [flow id, operation ids by key]. */
async function flowWithTree(name: string, tree?: Node, extra: Record<string, unknown> = {}): Promise<string[]> {
	const id = await createTempFlow(api, name, extra);
	if (!tree) return [id];
	const node = ({ key, type, x, y, options, resolve, reject }: Node): Record<string, unknown> => ({
		flow: id,
		name: key,
		key,
		type,
		position_x: x,
		position_y: y,
		options: options ?? {},
		...(resolve ? { resolve: node(resolve) } : {}),
		...(reject ? { reject: node(reject) } : {}),
	});
	await api.call('PATCH', `/flows/${id}`, {
		data: { operations: { create: [], update: [], delete: [] }, operation: node(tree) },
	});
	const operations = await api.call<{ id: string; key: string }[]>(
		'GET',
		`/operations?filter[flow][_eq]=${id}&fields=id,key&sort=key&limit=-1`,
	);
	return [id, ...operations.map((o) => o.id)];
}

/** condition → (resolve) log → (resolve) transform, condition → (reject) throw: the editor scenarios' flow. */
const TREE: Node = {
	key: 'condition',
	type: 'condition',
	x: 19,
	y: 1,
	resolve: { key: 'log', type: 'log', x: 37, y: 1, resolve: { key: 'transform', type: 'transform', x: 55, y: 1 } },
	reject: { key: 'throw', type: 'throw-error', x: 37, y: 17 },
};

/** The Directus app names a tile by its operation type, not by the operation name. */
const LOG = 'Log to Console';

/* ------------------------------------------------------------------------------------------- DB comparison */

type Rows = { added: unknown[]; changed: unknown[]; removed: unknown[] };
const MARKER = /<id\d+>/g;

/**
 * `changesSince` scoped to this spec: flow rows naming NAME, operation rows pointing at them, and their activity. Other
 * specs write the same tables meanwhile, and the sign-in writes directus_users rows. Markers are renumbered in order of
 * appearance after the rows are sorted, so the two runs compare.
 */
function scoped(changes: Record<string, unknown>): unknown {
	const text = (v: unknown) => JSON.stringify(v);
	const flows = changes['directus_flows'] as Rows;
	const mine = (v: unknown) => text(v).includes(NAME);
	const kept: Record<string, Rows> = {
		directus_flows: {
			added: flows.added.filter(mine),
			changed: flows.changed.filter(mine),
			removed: flows.removed.filter(mine),
		},
	};
	const ids = new Set(
		[...kept['directus_flows']!.added, ...kept['directus_flows']!.changed, ...kept['directus_flows']!.removed].map(
			(row) => (row as { id: string }).id,
		),
	);
	const operations = changes['directus_operations'] as Rows;
	const linked = (row: unknown) => ids.has((row as { flow: string }).flow);
	kept['directus_operations'] = {
		added: operations.added.filter(linked),
		changed: operations.changed.filter(linked),
		removed: operations.removed.filter(linked),
	};
	const keys = new Set(text(kept).match(MARKER) ?? []);
	const activity = (changes['activity'] as { item: string }[]).filter((a) => keys.has(String(a.item)));

	// Keys the apps generate (`condition_ab12c`) differ between runs.
	const sortRows = (rows: unknown[]) =>
		rows
			.map((row) => JSON.parse(text(row).replace(/"key":"([a-z_]+)_[a-z0-9]{5}"/g, '"key":"$1_*"')))
			.sort((a, b) => text(a).replace(MARKER, '<id>').localeCompare(text(b).replace(MARKER, '<id>')));
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
	/** Page both runs start from (under /admin); a function of the set-up keys. */
	start: (ids: string[]) => string;
	setup?: () => Promise<string[]>;
	/** Compare the rows of FLOWS_TABLES (not for the run and the logs scenarios). */
	db?: boolean;
	directus: (page: Page, ids: string[]) => Promise<void>;
	backoffice: (page: Page, ids: string[]) => Promise<void>;
}

interface Result {
	bo: Write[];
	dir: Write[];
	boDb: unknown;
	dirDb: unknown;
}

async function run(page: Page, origin: string, scenario: Scenario, ids: string[], directus: boolean) {
	await page.goto(`${origin}/admin${scenario.start(ids)}`);
	await expect(page.getByRole('main').first()).toBeVisible({ timeout: 15_000 });
	const before = scenario.db ? await snapshot(FLOWS_TABLES) : undefined;
	const steps = directus ? scenario.directus : scenario.backoffice;
	const recorded = await recordWrites(page, directus ? directusUrl : apiUrl, () => steps(page, ids));
	const db = before ? scoped((await changesSince(before, FLOWS_TABLES)) as Record<string, unknown>) : undefined;
	return { writes: normalizeFlowsBody(normalize(recorded, ids)), db };
}

async function compare(browser: Browser, page: Page, scenario: Scenario): Promise<Result> {
	try {
		await cleanup();
		const dirIds = (await scenario.setup?.()) ?? [];
		const dir = await onDirectusApp(browser, (p) => run(p, directusUrl, scenario, dirIds, true));

		await cleanup();
		const boIds = (await scenario.setup?.()) ?? [];
		await signInBackoffice(page, api);
		const bo = await run(page, '', scenario, boIds, false);
		return { bo: bo.writes, dir: dir.writes, boDb: bo.db, dirDb: dir.db };
	} finally {
		await cleanup();
	}
}

/** The writes and the rows of both apps are the same; the Directus app sent `expected`. */
function same(result: Result, expected: string[]) {
	expect(calls(result.dir)).toEqual(expected);
	expect(calls(result.bo)).toEqual(calls(result.dir));
	expect(result.bo).toEqual(result.dir);
	expect(result.boDb).toEqual(result.dirDb);
}

/* ------------------------------------------------------------------------------------------- app steps */

const dirRowMenu = async (page: Page, name: string, entry: string) => {
	await page.locator('.table-row', { hasText: name }).locator('.ctx-toggle').click();
	await chooseInMenu(page, entry);
};

const boRowMenu = async (page: Page, name: string, entry: string) => {
	await page.getByRole('button', { name: `Options for ${name}`, exact: true }).click();
	await page.getByRole('menuitem', { name: entry }).click();
};

async function dirEdit(page: Page) {
	await expect(dirTile(page, 'Trigger')).toBeVisible({ timeout: 15_000 });
	if (await headerButton(page, 'edit').isVisible()) await headerButton(page, 'edit').click();
	await expect(headerButton(page, 'check')).toBeVisible();
}

/* ------------------------------------------------------------------------------------------- scenarios */

test('(1) create a manual flow through the drawer (#178)', async ({ browser, page }) => {
	const name = flowName('create');
	const result = await compare(browser, page, {
		start: () => '/settings/flows',
		db: true,
		async directus(p) {
			await headerButton(p, 'add').click();
			const drawer = p.locator('.v-drawer');
			await drawer.getByPlaceholder('Name', { exact: true }).fill(name);
			await drawer.getByRole('button', { name: 'arrow_forward', exact: true }).click();
			await drawer.locator('.v-fancy-select-option', { hasText: 'Manual' }).click();
			await drawer
				.locator('.v-checkbox', { hasText: /^\s*\S*\s*Bo Content\s*$/ })
				.first()
				.click();
			await drawer.getByRole('button', { name: 'check', exact: true }).click();
			await expect(p).toHaveURL(/\/settings\/flows\/[0-9a-f-]{36}$/, { timeout: 30_000 });
		},
		async backoffice(p) {
			await p.getByRole('button', { name: 'Create Flow' }).first().click();
			const drawer = p.getByRole('dialog');
			await drawer.getByRole('textbox', { name: /^Name/ }).fill(name);
			await p.getByRole('button', { name: 'Next' }).click();
			await drawer.getByRole('button', { name: /^Manual/ }).click();
			await drawer.getByRole('checkbox', { name: 'Bo Content', exact: true }).check();
			await p.getByRole('button', { name: 'Finish Setup' }).click();
			await expect(p).toHaveURL(/\/settings\/flows\/[0-9a-f-]{36}$/, { timeout: 30_000 });
		},
	});
	same(result, ['POST /flows?{"fields":["id"]}']);
});

test('(2) add four operations with "+" and Save: one PATCH /flows/<id> with the tree (#180)', async ({
	browser,
	page,
}) => {
	const result = await compare(browser, page, {
		start: ([id]) => `/settings/flows/${id}`,
		setup: () => flowWithTree(flowName('save')),
		db: true,
		async directus(p) {
			await dirEdit(p);
			await dirAddOperation(p, dirTile(p, 'Trigger'), '.add-resolve', 'Condition');
			await dirAddOperation(p, dirTile(p, 'Condition'), '.add-resolve', 'Log to Console');
			await dirAddOperation(p, dirTile(p, 'Condition'), '.add-reject', 'Throw Error');
			await dirAddOperation(p, dirTile(p, 'Log to Console'), '.add-resolve', 'Transform Payload');
			await dirSaveFlow(p);
		},
		async backoffice(p) {
			await boEdit(p);
			await boAdd(p, panel(p, '$trigger'), 'resolve', 'Condition');
			await boAdd(p, panelByPrefix(p, 'condition_'), 'resolve', 'Log to Console');
			await boAdd(p, panelByPrefix(p, 'condition_'), 'reject', 'Throw Error');
			await boAdd(p, panelByPrefix(p, 'log_'), 'resolve', 'Transform Payload');
			await boSave(p);
		},
	});
	same(result, ['PATCH /flows/<id1>']);
});

test('(3) drag a panel, detach and relink the reject arrow, Save (#180, #181)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: ([id]) => `/settings/flows/${id}`,
		setup: () => flowWithTree(flowName('edit'), TREE),
		db: true,
		async directus(p) {
			await dirEdit(p);
			await dirDragTile(p, 'Transform Payload', { dx: 3, dy: 3 });
			await expect(dirTile(p, 'Transform Payload')).toHaveAttribute('style', /--pos-x: 58; --pos-y: 4;/);
			await dirLink(p, 'Condition', '.add-reject', null);
			await expect(p.locator('.v-workspace-tile.subdued')).toHaveCount(1);
			// CI 39018596094 and 39023103236 missed this drop twice on the Directus app (green locally): a missed drop
			// lands on empty space and stages nothing, so the drag is tried again (at most 3 times) and each miss is logged.
			for (let attempt = 1; ; attempt++) {
				const used = await dirLink(p, 'Condition', '.add-reject', 'Throw Error');
				if ((await p.locator('.v-workspace-tile.subdued').count()) === 0) break;
				// eslint-disable-next-line no-console
				console.log(`payload (3): relink ${attempt} missed on the Directus app: ${used}`);
				expect(attempt, 'relink on the Directus app').toBeLessThan(3);
			}
			await dirSaveFlow(p);
		},
		async backoffice(p) {
			await boEdit(p);
			await dragPanel(p, 'transform', { dx: 3, dy: 3 });
			await expect(panel(p, 'transform')).toHaveAttribute('data-pos-x', '58');
			await linkHandle(p, 'condition', 'reject', null);
			await linkHandle(p, 'condition', 'reject', 'throw');
			await boSave(p);
		},
	});
	expect(calls(result.dir)[0]).toBe('PATCH /flows/<id1>');
	expect(calls(result.bo)).toEqual(calls(result.dir));
	expect(result.bo).toEqual(result.dir);
	expect(result.boDb).toEqual(result.dirDb);
});

test('(4) duplicate an operation, delete the original, Save (#180)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: ([id]) => `/settings/flows/${id}`,
		setup: () => flowWithTree(flowName('duplicate'), TREE),
		db: true,
		async directus(p) {
			await dirEdit(p);
			await dirTileMenu(p, dirTile(p, LOG), 'Duplicate');
			await expect(dirTile(p, LOG)).toHaveCount(2);
			// The original is Condition's resolve: the one not subdued (the duplicate has no parent).
			await dirTileMenu(p, dirTile(p, LOG).and(p.locator(':not(.subdued)')), 'Delete');
			await expect(dirTile(p, LOG)).toHaveCount(1);
			await dirSaveFlow(p);
		},
		async backoffice(p) {
			await boEdit(p);
			await boTileMenu(p, 'log', 'Duplicate');
			await expect(p.locator('[data-panel-key^="log_"]')).toHaveCount(1);
			await boTileMenu(p, 'log', 'Delete');
			await expect(panel(p, 'log')).toHaveCount(0);
			await boSave(p);
		},
	});
	same(result, ['PATCH /flows/<id1>']);
});

test('(5) set a flow inactive from the row menu (#179)', async ({ browser, page }) => {
	const name = flowName('status');
	const result = await compare(browser, page, {
		start: () => '/settings/flows',
		setup: () => flowWithTree(name),
		db: true,
		async directus(p) {
			await dirRowMenu(p, name, 'Set Flow to Inactive');
			await expect(p.locator('.table-row', { hasText: name })).toContainText('Inactive');
		},
		async backoffice(p) {
			await boRowMenu(p, name, 'Set Flow to Inactive');
			await expect(p.getByRole('row').filter({ hasText: name })).toContainText('Inactive');
		},
	});
	same(result, ['PATCH /flows/<id1>']);
});

test('(6) Copy To another flow: POST /operations (#182)', async ({ browser, page }) => {
	const target = flowName('copy-target');
	const result = await compare(browser, page, {
		start: ([id]) => `/settings/flows/${id}`,
		setup: async () => [
			...(await flowWithTree(flowName('copy'), { key: 'log', type: 'log', x: 19, y: 1, options: { message: 'hi' } })),
			...(await flowWithTree(target)),
		],
		db: true,
		async directus(p) {
			await dirEdit(p);
			await dirTileMenu(p, dirTile(p, LOG), 'Copy To...');
			const dialog = card(p);
			await dialog.locator('.v-select .v-input').click();
			await chooseInMenu(p, target);
			await dialog.getByRole('button', { name: 'Copy', exact: true }).click();
			await expect(p.locator('.v-card', { hasText: 'Copy To...' })).toHaveCount(0);
		},
		async backoffice(p) {
			await boEdit(p);
			await boTileMenu(p, 'log', 'Copy To');
			const dialog = p.getByRole('dialog');
			await dialog.getByRole('combobox').click();
			await p.getByRole('option', { name: target }).click();
			await dialog.getByRole('button', { name: 'Copy', exact: true }).click();
			await expect(p.getByRole('dialog')).toHaveCount(0);
		},
	});
	same(result, ['POST /operations']);
});

test('(7) change the trigger through the trigger panel pencil (#179)', async ({ browser, page }) => {
	const result = await compare(browser, page, {
		start: ([id]) => `/settings/flows/${id}`,
		setup: () => flowWithTree(flowName('trigger'), { key: 'log', type: 'log', x: 19, y: 1 }),
		db: true,
		async directus(p) {
			await dirEdit(p);
			await dirTile(p, 'Trigger').locator('.edit-actions .edit-icon').click();
			const drawer = p.locator('.v-drawer').last();
			// The fancy select shows only the chosen trigger: clicking it clears the choice.
			await drawer.locator('.v-fancy-select-option', { hasText: 'Manual' }).click();
			await drawer.locator('.v-fancy-select-option', { hasText: 'Webhook' }).click();
			await drawer.getByRole('button', { name: 'check', exact: true }).click();
			await expect(p.locator('.v-drawer')).toHaveCount(0);
		},
		async backoffice(p) {
			await boEdit(p);
			await panel(p, '$trigger').getByRole('button', { name: 'Edit', exact: true }).click();
			const drawer = p.getByRole('dialog');
			await drawer.getByRole('button', { name: /^Manual/ }).click();
			await drawer.getByRole('button', { name: /^Webhook/ }).click();
			await p.getByRole('button', { name: 'Save', exact: true }).last().click();
			await expect(p.getByRole('dialog')).toHaveCount(0);
		},
	});
	same(result, ['PATCH /flows/<id1>?{"fields":["id"]}']);
});

test('(8) run a manual flow from the item page with its confirmation (#183)', async ({ browser, page }) => {
	const name = flowName('run');
	const result = await compare(browser, page, {
		start: () => '/content/bo_content/1',
		setup: () =>
			flowWithTree(
				name,
				{ key: 'log', type: 'log', x: 19, y: 1, options: { message: '{{ $trigger.body.reason }}' } },
				{
					options: {
						collections: ['bo_content'],
						location: 'item',
						requireConfirmation: true,
						confirmationDescription: 'Run it?',
						fields: [{ field: 'reason', type: 'string', name: 'Reason', meta: { interface: 'input', required: true } }],
					},
				},
			),
		async directus(p) {
			await openSidebarSection(p, 'Flows');
			await p.getByRole('button', { name: new RegExp(name) }).click();
			const dialog = card(p);
			await expect(dialog).toContainText('Run it?');
			await dialog.locator('input').fill('from the item');
			await dialog.getByRole('button', { name: 'Run Flow' }).click();
			await expect(p.locator('.v-card', { hasText: 'Run it?' })).toHaveCount(0);
		},
		async backoffice(p) {
			await openSidebar(p);
			await p.getByRole('button', { name: /^Flows/ }).click();
			await p
				.getByRole('complementary')
				.getByRole('button', { name: new RegExp(name) })
				.click();
			const dialog = p.getByRole('dialog');
			await expect(dialog).toContainText('Run it?');
			await dialog.getByRole('textbox').fill('from the item');
			await dialog.getByRole('button', { name: /Run Flow/ }).click();
			await expect(p.getByRole('dialog')).toHaveCount(0);
		},
	});
	same(result, ['POST /flows/trigger/<id1>']);
});

test('(9) the Logs section reads the runs with the same GET /revisions (#184)', async ({ browser, page }) => {
	/** The GET /revisions of the steps: path and decoded query parameters, sorted. */
	const reads = async (p: Page, api: string, steps: () => Promise<void>, ids: string[]) => {
		const seen: string[] = [];
		const onRequest = (request: Request) => {
			const path = apiPath(request.url(), api);
			if (request.method() !== 'GET' || !path?.startsWith('/revisions')) return;
			seen.push(canonicalPath(`${path}${new URL(request.url()).search}`).replaceAll(ids[0]!, '<flow>'));
		};
		p.on('request', onRequest);
		await steps();
		await p.waitForTimeout(1_500);
		p.off('request', onRequest);
		return seen.sort();
	};
	const setup = async () => {
		const ids = await flowWithTree(flowName('logs'), { key: 'log', type: 'log', x: 19, y: 1 });
		await api.call('POST', `/flows/trigger/${ids[0]}`, { data: { collection: 'bo_content', keys: ['1'] } });
		await expect
			.poll(
				async () =>
					(
						await api.call<unknown[]>(
							'GET',
							`/revisions?filter[item][_eq]=${ids[0]}&filter[activity][action][_eq]=run&fields=id`,
						)
					).length,
			)
			.toBe(1);
		return ids;
	};

	await cleanup();
	let ids = await setup();
	const dir = await onDirectusApp(browser, async (p) => {
		await p.goto(`${directusUrl}/admin/settings/flows/${ids[0]}`);
		await expect(dirTile(p, 'Trigger')).toBeVisible({ timeout: 15_000 });
		return reads(p, directusUrl, () => openSidebarSection(p, 'Logs'), ids);
	});

	await cleanup();
	ids = await setup();
	await signInBackoffice(page, api);
	await page.goto(`/admin/settings/flows/${ids[0]}`);
	await expect(panel(page, '$trigger')).toBeVisible({ timeout: 15_000 });
	const bo = await reads(
		page,
		apiUrl,
		async () => {
			await openSidebar(page);
			await page.getByRole('button', { name: /^Logs/ }).click();
		},
		ids,
	);
	await cleanup();

	expect(dir.length).toBeGreaterThan(0);
	expect(bo).toEqual(dir);
});

test('(10) delete a flow from the row menu (#178)', async ({ browser, page }) => {
	const name = flowName('delete');
	const result = await compare(browser, page, {
		start: () => '/settings/flows',
		setup: () => flowWithTree(name, TREE),
		db: true,
		async directus(p) {
			await dirRowMenu(p, name, 'Delete Flow');
			await card(p).getByRole('button', { name: 'Delete' }).click();
			await expect(p.locator('.table-row', { hasText: name })).toHaveCount(0);
		},
		async backoffice(p) {
			await boRowMenu(p, name, 'Delete Flow');
			await p.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
			await expect(p.getByRole('row').filter({ hasText: name })).toHaveCount(0);
		},
	});
	same(result, ['DELETE /flows/<id1>']);
});
