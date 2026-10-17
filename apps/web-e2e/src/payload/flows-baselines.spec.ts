// Feature 017 T003 (CHK032, SC-006): records what the Directus app 11.17.4 sends for four Flows editor scenarios and stores
// the normalized writes in src/payload/baselines/flows-*.json; the body comparison tests of apps/web (T041, T090) read them.
// Drives only the Directus app (DIRECTUS_URL); runs when RECORD_BASELINES=1, never in CI (like settings-baselines).
//
// Steps, in one signed-in session (positions are grid cells of 18 px):
// (1) create: /settings/flows, header "+", name FLOW, defaults kept, Next, trigger Manual, collection bo_content, Finish
//     Setup → POST /flows.
// (2) save: the new flow opens in edit mode; "+" on the Trigger resolve handle → Condition (defaults), Done; Condition
//     resolve → Log to Console, Condition reject → Throw Error, Log resolve → Transform Payload; Save.
// (3) edit: Edit Flow; drag Transform 3 cells right and 3 down; drag Condition's reject handle to empty space below the
//     panels (detach), then from Condition's reject handle onto Throw Error's input (re-attach); Log menu → Duplicate;
//     Log (the original, Condition's resolve) menu → Delete; Save.
// (4) copy: Edit Flow; the remaining Log (the duplicate, saved in 3) menu → Copy To... → TARGET (created by API before
//     the session) → Copy → POST /operations.
// Normalized: flow ids → `flow:<name>`, operation ids → their `key`, the 5 random chars of generated keys → `_*`,
// timestamps removed; then `normalize` (sorted keys, uuids → `<uuid>`).
import { writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { directusUrl } from '../helpers/config.js';
import { card, chooseInMenu, directusApi, goto, headerButton, onDirectusApp } from '../helpers/directus-app.js';
import { normalize, recordWrites, type Recorded } from '../helpers/payload.js';

test.skip(process.env['RECORD_BASELINES'] !== '1', 'records Directus app baselines on demand (RECORD_BASELINES=1)');
test.use({ actionTimeout: 15_000 });

const FLOW = 'web-e2e-baseline-flow';
const TARGET = 'web-e2e-baseline-target';
const OUT = new URL('./baselines/', import.meta.url);
const GRID = 18;

async function cleanup(): Promise<void> {
	const flows: { id: string }[] = await directusApi(
		'GET',
		'/flows?filter[name][_starts_with]=web-e2e-baseline-&fields=id',
	);
	for (const { id } of flows) await directusApi('DELETE', `/flows/${id}`);
}

/** Real id → label, collected after each step so deleted operations keep theirs. */
const labels = new Map<string, string>();

async function collectLabels(): Promise<void> {
	const flows: { id: string; name: string; operations: { id: string; key: string }[] }[] = await directusApi(
		'GET',
		'/flows?filter[name][_starts_with]=web-e2e-baseline-&fields=id,name,operations.id,operations.key',
	);
	for (const flow of flows) {
		labels.set(flow.id, `flow:${flow.name}`);
		for (const op of flow.operations) labels.set(op.id, op.key);
	}
}

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const SUFFIX = /_[a-z0-9]{5}$/;

/** `condition_ab12c` → `condition_*`; a duplicate's key `log_ab12c_xyzwv` (known key + suffix) → `log_*_*`. */
function normKey(key: string): string {
	const base = key.replace(SUFFIX, '');
	if (base === key) return key;
	return [...labels.values()].includes(base) ? `${normKey(base)}_*` : `${base}_*`;
}

function relabel(input: unknown, key?: string): unknown {
	if (typeof input === 'string') {
		let out = input;
		for (const [id, label] of labels) out = out.replaceAll(id, label.startsWith('flow:') ? label : normKey(label));
		return key === 'key' ? normKey(out) : out;
	}
	if (Array.isArray(input)) return input.map((v) => relabel(v));
	if (input && typeof input === 'object') {
		return Object.fromEntries(
			Object.entries(input)
				.filter(([, v]) => !(typeof v === 'string' && ISO_TIME.test(v)))
				.map(([k, v]) => [k, relabel(v, k)]),
		);
	}
	return input;
}

function save(name: string, recorded: Recorded): void {
	const writes = recorded.writes.map((w) => ({ ...w, path: relabel(w.path) as string, body: relabel(w.body) }));
	writeFileSync(new URL(`flows-${name}.json`, OUT), `${JSON.stringify(normalize({ writes, keys: [] }), null, '\t')}\n`);
}

/** The canvas tile whose header names the operation type (`Trigger`, `Condition`, `Log to Console`...). */
function tile(page: Page, type: string): Locator {
	return page
		.locator('.v-workspace-tile')
		.filter({ has: page.locator('.header .name', { hasText: new RegExp(`^${type}$`) }) });
}

/** Clicks a handle (`.add-resolve`, `.add-reject`) of `from`, picks `type` in the operation drawer, Done. */
async function addOperation(page: Page, from: Locator, handle: string, type: string): Promise<void> {
	await from.locator(handle).click();
	const drawer = page.locator('.v-drawer').last();
	await drawer
		.locator('.v-fancy-select-option', { hasText: new RegExp(`^\\s*\\S*\\s*${type}`) })
		.first()
		.click();
	await drawer.getByRole('button', { name: 'check', exact: true }).click();
	await expect(page.locator('.v-drawer')).toHaveCount(0);
}

/** Moves the mouse from the centre of `from` to (x, y) in small steps (the canvas reads pointermove in rAF/throttle). */
async function drag(page: Page, from: Locator, to: { x: number; y: number }): Promise<void> {
	await from.scrollIntoViewIfNeeded();
	const box = (await from.boundingBox())!;
	const start = { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 10) };
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	const target = { x: start.x + to.x, y: start.y + to.y };
	for (let i = 1; i <= 10; i++) {
		await page.mouse.move(start.x + ((target.x - start.x) * i) / 10, start.y + ((target.y - start.y) * i) / 10);
		await page.waitForTimeout(40);
	}
	await page.mouse.up();
	await page.waitForTimeout(200);
}

/** Absolute drag target: the centre of `to`, as an offset from the centre of `from`. */
async function offset(from: Locator, to: Locator): Promise<{ x: number; y: number }> {
	await from.scrollIntoViewIfNeeded();
	const a = (await from.boundingBox())!;
	const b = (await to.boundingBox())!;
	return {
		x: b.x + b.width / 2 - (a.x + a.width / 2),
		y: b.y + b.height / 2 - (a.y + Math.min(a.height / 2, 10)),
	};
}

async function tileMenu(page: Page, t: Locator, entry: string): Promise<void> {
	await t.scrollIntoViewIfNeeded();
	await t.locator('.edit-actions .more-icon').click();
	await chooseInMenu(page, entry);
}

async function saveFlow(page: Page): Promise<void> {
	await headerButton(page, 'check').click();
	await expect(headerButton(page, 'edit')).toBeVisible({ timeout: 30_000 });
}

test.beforeAll(cleanup);
test.afterAll(cleanup);

test('flows editor writes of the Directus app', async ({ browser }) => {
	await directusApi('POST', '/flows', { name: TARGET, status: 'active', trigger: 'manual', options: {} });

	await onDirectusApp(browser, async (page) => {
		await goto(page, '/settings/flows');
		const create = await recordWrites(page, directusUrl, async () => {
			await headerButton(page, 'add').click();
			const drawer = page.locator('.v-drawer');
			await drawer.getByPlaceholder('Name', { exact: true }).fill(FLOW);
			await drawer.getByRole('button', { name: 'arrow_forward', exact: true }).click();
			await drawer.locator('.v-fancy-select-option', { hasText: 'Manual' }).click();
			await drawer
				.locator('.v-checkbox', { hasText: /^\s*\S*\s*Bo Content\s*$/ })
				.first()
				.click();
			await drawer.getByRole('button', { name: 'check', exact: true }).click();
			await expect(page).toHaveURL(/\/settings\/flows\/[0-9a-f-]{36}$/, { timeout: 30_000 });
		});
		await collectLabels();

		const flowSave = await recordWrites(page, directusUrl, async () => {
			await expect(headerButton(page, 'check')).toBeVisible();
			await addOperation(page, tile(page, 'Trigger'), '.add-resolve', 'Condition');
			await addOperation(page, tile(page, 'Condition'), '.add-resolve', 'Log to Console');
			await addOperation(page, tile(page, 'Condition'), '.add-reject', 'Throw Error');
			await addOperation(page, tile(page, 'Log to Console'), '.add-resolve', 'Transform Payload');
			await saveFlow(page);
		});
		await collectLabels();

		const edit = await recordWrites(page, directusUrl, async () => {
			await headerButton(page, 'edit').click();
			const transform = tile(page, 'Transform Payload');
			await drag(page, transform.locator('.header'), { x: 3 * GRID, y: 3 * GRID });
			await expect(transform).toHaveAttribute('style', /--pos-x: 58; --pos-y: 4;/);

			const condition = tile(page, 'Condition');
			const reject = condition.locator('.add-reject');
			// Empty space: 20 cells below the Condition panel (the Throw Error panel sits at its right).
			await drag(page, reject, { x: 0, y: 20 * GRID });
			await expect(page.locator('.v-workspace-tile.subdued')).toHaveCount(1); // Throw Error has no parent
			await drag(page, reject, await offset(reject, tile(page, 'Throw Error').locator('.attachment')));
			await expect(page.locator('.v-workspace-tile.subdued')).toHaveCount(0);

			await tileMenu(page, tile(page, 'Log to Console'), 'Duplicate');
			await expect(tile(page, 'Log to Console')).toHaveCount(2);
			// The original is Condition's resolve: the one not subdued (the duplicate has no parent).
			await tileMenu(page, tile(page, 'Log to Console').and(page.locator(':not(.subdued)')), 'Delete');
			await expect(tile(page, 'Log to Console')).toHaveCount(1);
			await saveFlow(page);
		});
		await collectLabels();

		// The target flow was created before the session: the flows store already has it.
		const copy = await recordWrites(page, directusUrl, async () => {
			await headerButton(page, 'edit').click();
			await tileMenu(page, tile(page, 'Log to Console'), 'Copy To...');
			const dialog = card(page);
			await expect(dialog).toContainText('Copy To...');
			await dialog.locator('.v-select .v-input').click();
			await chooseInMenu(page, TARGET);
			await dialog.getByRole('button', { name: 'Copy', exact: true }).click();
			await expect(page.locator('.v-card', { hasText: 'Copy To...' })).toHaveCount(0);
		});
		await collectLabels();

		save('create', create);
		save('save', flowSave);
		save('edit', edit);
		save('copy', copy);
	});
});
