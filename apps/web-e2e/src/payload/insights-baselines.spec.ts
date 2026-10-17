// Feature 018 T002 (SC-005, SC-006): records what the Directus app 11.17.4 sends for the Insights and Notifications flows
// and stores them in src/payload/baselines/insights-*.json; the payload suite (payload/insights.spec.ts,
// notifications.spec.ts) and the store tests of apps/web compare with them. Drives only the Directus app (DIRECTUS_URL);
// runs when RECORD_BASELINES=1, never in CI (like flows-baselines).
//
// Writes, in one signed-in session (DASH and TARGET are temporary dashboards, deleted before and after):
// (1) create: /insights header "+", name DASH, Save → POST /dashboards.
// (2) add: Edit Panels, "+" Metric (Bo Insights Data, ID, Count), Done; "+" Bar Chart (Bo Insights Data, X Status,
//     Y Amount, Sum), Done; Save → POST /panels (both new panels sit at (1,1)).
// (3) move: Edit Panels, drag the bar chart 12 cells right (→ 13,1), metric bottom-right handle +2/+2 (→ 8×4); Save.
// (4) copy: Edit Panels, metric menu → Copy To... → TARGET → Copy; Save.
// (5) import: the overview row menu of DASH → Export Dashboard (the GET is stored in insights-export.json), then the
//     downloaded JSON in the Import sidebar → POST /utils/import/directus_dashboards (a second dashboard named DASH).
// (6) archive: the notifications drawer, bo_notification_item → Archive; then Archive tab → Unarchive (restores it).
// (7) options: Edit Panels, metric pencil → Aggregate Function Sum, Done; Save.
// (8) duplicate: Edit Panels, metric menu → Duplicate, bar chart menu → Delete; Save.
// (9) noop: Edit Panels and nothing else: Save stays disabled, no request; Clear Changes.
// Reads: the hydrate GETs on /insights, the GraphQL documents and answers of bo_dash_all, bo_dash_system and bo_dash_vars
// (open, owners [me], vars_status published/draft/archived) and the requests of opening the notifications drawer.
// Normalized: dashboard ids → `dashboard:<name>`, panel ids → `panel:<type>@<dashboard name>`, the admin id → `<me>`,
// the notification id → `notification:<subject>`, ISO times → `<ts>`; GraphQL aliases `query_<hash>` → `query_*` in the
// writes and `query_<n>` (document order) in the reads; then `normalize` (sorted keys, uuids → `<uuid>`) and, for reads, `canonicalPath`.
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page, type Request } from '@playwright/test';
import { ADMIN, directusUrl } from '../helpers/config.js';
import {
	card,
	chooseInMenu,
	dirSaveFlow,
	dirTile,
	dirTileMenu,
	directusApi,
	field,
	goto,
	headerButton,
	onDirectusApp,
	openSidebarSection,
	sidebar,
} from '../helpers/directus-app.js';
import { canonicalPath, captureFormData, normalize, recordWrites, type Recorded } from '../helpers/payload.js';
import { apiPath } from '../helpers/requests.js';

test.skip(process.env['RECORD_BASELINES'] !== '1', 'records Directus app baselines on demand (RECORD_BASELINES=1)');
test.use({ actionTimeout: 15_000 });

const PREFIX = 'web-e2e-baseline-insights-';
const DASH = `${PREFIX}dash`;
const TARGET = `${PREFIX}target`;
const NOTIFICATION = 'bo_notification_item';
const OUT = new URL('./baselines/', import.meta.url);

/** Real id → label, collected after each step so deleted panels keep theirs. */
const labels = new Map<string, string>();
/** Integer keys (notifications) → label, replaced only in `keys` arrays. */
const numbers = new Map<number, string>();

async function notificationId(): Promise<number> {
	const rows: { id: number }[] = await directusApi(
		'GET',
		`/notifications?filter[subject][_eq]=${NOTIFICATION}&fields=id&limit=1`,
	);
	return rows[0]!.id;
}

async function cleanup(): Promise<void> {
	const rows: { id: string }[] = await directusApi(
		'GET',
		`/dashboards?filter[name][_starts_with]=${PREFIX}&fields=id&limit=-1`,
	);
	if (rows.length > 0)
		await directusApi(
			'DELETE',
			'/dashboards',
			rows.map((row) => row.id),
		);
	await directusApi('PATCH', `/notifications/${await notificationId()}`, { status: 'inbox' });
}

function unique(label: string): string {
	const taken = new Set(labels.values());
	let out = label;
	for (let n = 2; taken.has(out); n++) out = `${label}#${n}`;
	return out;
}

async function collectLabels(): Promise<void> {
	const dashboards: { id: string; name: string; panels: { id: string; type: string }[] }[] = await directusApi(
		'GET',
		`/dashboards?filter[name][_starts_with]=${PREFIX}&fields=id,name,panels.id,panels.type&sort=date_created&limit=-1`,
	);
	for (const dashboard of dashboards) {
		if (!labels.has(dashboard.id)) labels.set(dashboard.id, unique(`dashboard:${dashboard.name}`));
		for (const panel of dashboard.panels) {
			if (!labels.has(panel.id)) labels.set(panel.id, unique(`panel:${panel.type}@${labels.get(dashboard.id)}`));
		}
	}
}

function relabel(input: unknown, key?: string): unknown {
	if (typeof input === 'string') {
		let out = input;
		for (const [id, label] of labels) out = out.replaceAll(id, label);
		return out;
	}
	if (typeof input === 'number' && key === 'keys') return numbers.get(input) ?? input;
	if (Array.isArray(input)) return input.map((v) => relabel(v, key));
	if (input && typeof input === 'object') {
		return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, relabel(v, k)]));
	}
	return input;
}

function save(name: string, data: unknown): void {
	writeFileSync(new URL(`insights-${name}.json`, OUT), `${JSON.stringify(data, null, '\t')}\n`);
}

/** Writes with the GraphQL reads they trigger; aliases `query_<hash>` → `query_*` (data-model §5). */
function saveWrites(name: string, recorded: Recorded): void {
	const alias = (body: unknown) => JSON.parse(JSON.stringify(body).replace(/query_[0-9a-f]+/g, 'query_*'));
	const writes = recorded.writes.map((w) => ({ ...w, path: relabel(w.path) as string, body: alias(relabel(w.body)) }));
	save(name, normalize({ writes, keys: [] }));
}

interface Call {
	method: string;
	path: string;
	body: unknown;
	status?: number | undefined;
	response?: unknown;
}

/** Every request `page` sends to the Directus API whose path matches `pattern` while `steps` run, with the answers. */
async function recordCalls(page: Page, pattern: RegExp, steps: () => Promise<void>, answers = false): Promise<Call[]> {
	const calls: Call[] = [];
	const pending: Promise<void>[] = [];
	const onRequest = (request: Request) => {
		const path = apiPath(request.url(), directusUrl);
		if (path === undefined || !pattern.test(path)) return;
		const text = request.postData();
		let body: unknown = null;
		try {
			body = text ? JSON.parse(text) : null;
		} catch {
			body = text;
		}
		const call: Call = { method: request.method(), path: path + new URL(request.url()).search, body };
		calls.push(call);
		pending.push(
			request
				.response()
				.then(async (response) => {
					call.status = response?.status();
					if (answers) call.response = await response?.json();
				})
				.catch(() => undefined),
		);
	};
	page.on('request', onRequest);
	try {
		await steps();
		await page.waitForTimeout(1_500);
		await Promise.all(pending);
	} finally {
		page.off('request', onRequest);
	}
	return calls;
}

/** Relabelled and normalized calls; `query_<hash>` aliases become `query_<n>` in the order of the documents. */
function normCalls(calls: Call[]): unknown[] {
	const aliases = new Map<string, string>();
	const alias = (input: unknown): unknown => {
		const text = JSON.stringify(input) ?? 'null';
		for (const [, hash] of text.matchAll(/query_([0-9a-f]+)/g)) {
			if (!aliases.has(hash!)) aliases.set(hash!, `query_${aliases.size + 1}`);
		}
		return JSON.parse(text.replace(/query_([0-9a-f]+)/g, (_, hash: string) => aliases.get(hash)!));
	};
	const writes = calls.map((c) => ({
		method: c.method,
		path: canonicalPath(relabel(c.path) as string),
		body: { request: relabel(alias(c.body)), status: c.status, response: relabel(alias(c.response)) },
	}));
	return normalize({ writes, keys: [] }).map(({ method, path, body }) => ({ method, path, ...(body as object) }));
}

/** The tile of a size (`--width`/`--height`): the new panels have no header to name them. */
const sized = (page: Page, w: number, h: number) =>
	page.locator(`.v-workspace-tile[style*="--width: ${w}; --height: ${h};"]`);

/** Moves the mouse by whole cells from `from` (the pointer handlers of v-workspace-tile read pageX/pageY deltas). */
async function dragBy(page: Page, from: { x: number; y: number }, cells: { dx: number; dy: number }): Promise<void> {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	for (let i = 1; i <= 10; i++) {
		await page.mouse.move(from.x + (cells.dx * 18 * i) / 10, from.y + (cells.dy * 18 * i) / 10);
		await page.waitForTimeout(40);
	}
	await page.mouse.up();
	await page.waitForTimeout(200);
}

/** The panel drawer: picks `type`, sets the options (`[label, choice]`, menus), Done. */
async function panelDrawer(page: Page, type: string | null, options: [string, string][]): Promise<void> {
	const drawer = page.locator('.v-drawer').last();
	if (type) {
		await drawer
			.locator('button.interface')
			.filter({ has: page.locator('.name', { hasText: new RegExp(`^${type}$`) }) })
			.click();
	}
	for (const [label, choice] of options) {
		// One menu at a time: a closing menu still holds the choices of the previous field.
		await expect(page.locator('.v-menu-content')).toHaveCount(0);
		await field(drawer, label).first().locator('.v-input').first().click();
		await chooseInMenu(page, choice);
	}
	await expect(page.locator('.v-menu-content')).toHaveCount(0);
	await drawer.getByRole('button', { name: 'check', exact: true }).click();
	await expect(page.locator('.v-drawer')).toHaveCount(0);
}

async function editPanels(page: Page): Promise<void> {
	await headerButton(page, 'edit').click();
	await expect(headerButton(page, 'check')).toBeVisible();
}

test.beforeAll(cleanup);
test.afterAll(cleanup);

test('insights and notifications requests of the Directus app', async ({ browser }, testInfo) => {
	const me: string = (await directusApi('GET', '/users/me?fields=id')).id;
	labels.set(me, '<me>');
	numbers.set(await notificationId(), `notification:${NOTIFICATION}`);
	await directusApi('POST', '/dashboards', { name: TARGET, icon: 'dashboard' });
	await collectLabels();

	await onDirectusApp(browser, async (page) => {
		await captureFormData(page);

		// Hydrate: what the store reads when the module opens.
		const hydrate = await recordCalls(page, /^\/(dashboards|panels)$/, () => goto(page, '/insights'));
		save('hydrate', normCalls(hydrate));

		// (1) create
		const create = await recordWrites(page, directusUrl, async () => {
			await headerButton(page, 'add').click();
			await card(page).getByPlaceholder('Dashboard Name').fill(DASH);
			await card(page).getByRole('button', { name: 'Save', exact: true }).click();
			await expect(page).toHaveURL(/\/insights\/[0-9a-f-]{36}$/, { timeout: 30_000 });
		});
		await collectLabels();
		const dashUrl = page.url();

		// (2) add a metric and a bar chart
		const add = await recordWrites(page, directusUrl, async () => {
			await editPanels(page);
			await page.getByRole('banner').getByRole('link', { name: 'add', exact: true }).click();
			await panelDrawer(page, 'Metric', [
				['Collection', 'Bo Insights Data'],
				['Field', 'ID'],
				['Aggregate Function', 'Count'],
			]);
			await page.getByRole('banner').getByRole('link', { name: 'add', exact: true }).click();
			await panelDrawer(page, 'Bar Chart', [
				['Collection', 'Bo Insights Data'],
				['X-Axis', 'Status'],
				['Y-Axis', 'Amount'],
				['Y-Axis Function', 'Sum'],
			]);
			await dirSaveFlow(page);
		});
		await collectLabels();

		// (3) drag the bar chart to (13,1), resize the metric to 8×4
		const move = await recordWrites(page, directusUrl, async () => {
			await editPanels(page);
			const bar = (await sized(page, 12, 10).boundingBox())!;
			await dragBy(page, { x: bar.x + bar.width / 2, y: bar.y + bar.height / 2 }, { dx: 12, dy: 0 });
			await expect(sized(page, 12, 10)).toHaveAttribute('style', /--pos-x: 13; --pos-y: 1;/);
			const handle = (await sized(page, 6, 2).locator('.resize-handlers .bottom-right').boundingBox())!;
			await dragBy(page, { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, { dx: 2, dy: 2 });
			await expect(sized(page, 8, 4)).toHaveCount(1);
			await dirSaveFlow(page);
		});
		await collectLabels();

		// (4) Copy To the target dashboard
		const copy = await recordWrites(page, directusUrl, async () => {
			await editPanels(page);
			await dirTileMenu(page, sized(page, 8, 4), 'Copy To...');
			const dialog = card(page);
			await expect(dialog).toContainText('Copy To...');
			await dialog.locator('.v-select .v-input').click();
			await chooseInMenu(page, TARGET);
			await dialog.getByRole('button', { name: 'Copy', exact: true }).click();
			await expect(page.locator('.v-card', { hasText: 'Copy To...' })).toHaveCount(0);
			await dirSaveFlow(page);
		});
		await collectLabels();

		// (5) export DASH from the overview, import the file
		await goto(page, '/insights');
		const row = page.locator('.table-row', { hasText: DASH });
		// window.open(<export url>): the GET goes out from a new tab, so it is read on the context.
		const exportRequest = page.context().waitForEvent('request', (r) => r.url().includes('export=json'));
		await row.locator('.ctx-toggle').click();
		await chooseInMenu(page, 'Export Dashboard');
		const exportUrl = new URL((await exportRequest).url());
		for (const other of page.context().pages()) if (other !== page) await other.close();
		const file = testInfo.outputPath(`${DASH}.json`);
		const exported = await page.request.get(exportUrl.href);
		expect(exported.ok()).toBe(true);
		writeFileSync(file, await exported.body());
		const [exportCall] = normCalls([
			{
				method: 'GET',
				path: exportUrl.pathname + exportUrl.search,
				body: null,
				status: exported.status(),
				response: JSON.parse(readFileSync(file, 'utf8')),
			},
		]);
		save('export', exportCall);

		const imported = await recordWrites(page, directusUrl, async () => {
			await openSidebarSection(page, 'Import');
			await sidebar(page).locator('input#import-file').setInputFiles(file);
			await sidebar(page).getByRole('button', { name: 'Start Import' }).click();
			await expect(page.locator('.table-row', { hasText: DASH })).toHaveCount(2, { timeout: 30_000 });
		});
		await collectLabels();

		// (6) archive the fixture notification, then unarchive it (restores the fixture)
		const drawer = page.locator('.v-drawer').last();
		const opened = await recordCalls(page, /^\/notifications$/, async () => {
			await page.locator('.module-bar-avatar').getByRole('button', { name: 'notifications', exact: true }).click();
			await expect(drawer.locator('.v-list-item', { hasText: NOTIFICATION })).toBeVisible();
		});
		save('notifications-drawer', normCalls(opened));

		const notificationPaths = /^\/notifications$/;
		const archive = await recordCalls(page, notificationPaths, async () => {
			await drawer.locator('.v-list-item', { hasText: NOTIFICATION }).locator('.v-checkbox').click();
			await drawer.getByRole('button', { name: 'archive', exact: true }).click();
			await expect(drawer.locator('.v-list-item', { hasText: NOTIFICATION })).toHaveCount(0);
		});
		await drawer.locator('.v-tab', { hasText: 'Archive' }).click();
		const unarchive = await recordCalls(page, notificationPaths, async () => {
			await drawer.locator('.v-list-item', { hasText: NOTIFICATION }).locator('.v-checkbox').click();
			await drawer.getByRole('button', { name: 'move_to_inbox', exact: true }).click();
			await expect(drawer.locator('.v-list-item', { hasText: NOTIFICATION })).toHaveCount(0);
		});
		save('notification-archive', { archive: normCalls(archive), unarchive: normCalls(unarchive) });
		await page.keyboard.press('Escape');
		await expect(page.locator('.v-drawer')).toHaveCount(0);

		// (7) metric options: Aggregate Function → Sum
		await page.goto(dashUrl);
		await expect(sized(page, 8, 4)).toBeVisible({ timeout: 15_000 });
		const options = await recordWrites(page, directusUrl, async () => {
			await editPanels(page);
			await sized(page, 8, 4).locator('.edit-actions .edit-icon').click();
			await panelDrawer(page, null, [['Aggregate Function', 'Sum']]);
			await dirSaveFlow(page);
		});
		await collectLabels();

		// (8) duplicate the metric, delete the bar chart
		const duplicate = await recordWrites(page, directusUrl, async () => {
			await editPanels(page);
			await dirTileMenu(page, sized(page, 8, 4), 'Duplicate');
			await expect(sized(page, 8, 4)).toHaveCount(2);
			await dirTileMenu(page, sized(page, 12, 10), 'Delete');
			await expect(sized(page, 12, 10)).toHaveCount(0);
			await dirSaveFlow(page);
		});
		await collectLabels();

		// (9) edit mode without a change
		let saveDisabled = false;
		const noop = await recordCalls(page, /^\/(?!admin)/, async () => {
			await editPanels(page);
			saveDisabled = await headerButton(page, 'check').isDisabled();
		});
		save('noop', { saveDisabled, requests: normCalls(noop) });
		await headerButton(page, 'clear').click();
		await expect(headerButton(page, 'edit')).toBeVisible();

		saveWrites('create', create);
		saveWrites('add', add);
		saveWrites('move', move);
		saveWrites('copy', copy);
		saveWrites('import', imported);
		saveWrites('options', options);
		saveWrites('duplicate', duplicate);

		// GraphQL of the fixture dashboards.
		const fixture = async (name: string): Promise<string> =>
			((await directusApi('GET', `/dashboards?filter[name][_eq]=${name}&fields=id&limit=1`)) as { id: string }[])[0]!
				.id;
		const graphql = /^\/graphql(\/system)?$/;
		for (const name of ['bo_dash_all', 'bo_dash_system']) {
			const id = await fixture(name);
			const calls = await recordCalls(
				page,
				graphql,
				async () => {
					await goto(page, `/insights/${id}`);
					await expect(page.locator('.v-workspace-tile').first()).toBeVisible({ timeout: 15_000 });
				},
				true,
			);
			save(`graphql-${name.replace('bo_dash_', '')}`, normCalls(calls));
		}

		const vars = await fixture('bo_dash_vars');
		const varsCalls = /^\/(graphql(\/system)?|users|items\/.*)$/;
		const steps: { step: string; calls: unknown[] }[] = [];
		const step = async (name: string, run: () => Promise<void>) =>
			steps.push({ step: name, calls: normCalls(await recordCalls(page, varsCalls, run, true)) });
		await step('open (vars_status published, vars_author empty)', async () => {
			await goto(page, `/insights/${vars}`);
			await expect(dirTile(page, 'Owners')).toBeVisible({ timeout: 15_000 });
		});
		await dirTile(page, 'Owners').getByRole('button', { name: 'Add Existing' }).click();
		const users = page.locator('.v-drawer').last();
		await users.locator('.table-row', { hasText: ADMIN.email }).click();
		await step('vars_author [<me>] (vars_status published)', () =>
			users.getByRole('button', { name: 'check', exact: true }).click(),
		);
		for (const status of ['draft', 'archived']) {
			await step(`vars_status ${status}`, async () => {
				await dirTile(page, 'Status').locator('.v-input').first().click();
				await chooseInMenu(page, status);
			});
		}
		save('graphql-vars', steps);
	});
});
