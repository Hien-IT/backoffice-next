// Feature 017 (contracts/components.md §6): the flows of the fixture set and the temporary flows a spec creates. A spec
// names its flows `${DATA_PREFIX}-<spec>-<n>` (the three configurations never touch each other's rows) and deletes
// them in `afterAll`; no spec runs `bo_all_ops`, whose three log rows come from the seed (CHK007).
import { expect, type Locator, type Page } from '@playwright/test';
import type { AdminApi } from './api.js';
import { DATA_PREFIX } from './config.js';

/** lib.mjs FLOWS of apps/web/fixtures/interfaces. */
export const FLOWS = {
	all: 'bo_all_ops',
	webhook: 'bo_webhook',
	schedule: 'bo_schedule',
	child: 'bo_child',
	event: 'bo_event',
	orphan: 'bo_orphan',
} as const;

export const tempFlowName = (spec: string, n: number | string) => `${DATA_PREFIX}-${spec}-${n}`;

/** The id of a flow by name (fixture or temporary). */
export async function flowId(api: AdminApi, name: string): Promise<string> {
	const rows = await api.call<{ id: string }[]>(
		'GET',
		`/flows?filter[name][_eq]=${encodeURIComponent(name)}&fields=id&limit=1`,
	);
	if (!rows[0]) throw new Error(`flow ${name} not found`);
	return rows[0].id;
}

/** Creates a temporary manual flow on bo_content through the API; returns its id. */
export async function createTempFlow(
	api: AdminApi,
	name: string,
	extra: Record<string, unknown> = {},
): Promise<string> {
	const flow = await api.call<{ id: string }>('POST', '/flows?fields=id', {
		data: {
			name,
			icon: 'bolt',
			status: 'active',
			accountability: 'all',
			trigger: 'manual',
			options: { collections: ['bo_content'] },
			...extra,
		},
	});
	return flow.id;
}

/** Deletes every flow whose name starts with `${DATA_PREFIX}-${spec}` (operations go with them). */
export async function deleteTempFlows(api: AdminApi, spec: string): Promise<void> {
	const rows = await api.call<{ id: string }[]>(
		'GET',
		`/flows?filter[name][_starts_with]=${encodeURIComponent(`${DATA_PREFIX}-${spec}`)}&fields=id&limit=-1`,
	);
	if (rows.length > 0) await api.call('DELETE', '/flows', { data: rows.map((row) => row.id) });
}

/** The bo_flows table row of a flow on the overview page. */
export const flowRow = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name });

/* ---------------------------------------------------------------- canvas (017 wave 2) */

/** The canvas panel of an operation (its key) or of the trigger (`$trigger`). */
export const panel = (page: Page, key: string) => page.locator(`[data-panel-key="${key}"]`);

/** `{ key, x, y }` of every panel, from the grid cell the tile exposes (`data-pos-x`, `data-pos-y`). */
export async function readGrid(page: Page): Promise<{ key: string; x: number; y: number }[]> {
	return page.locator('[data-panel-key]').evaluateAll((tiles) =>
		tiles
			.map((tile) => ({
				key: tile.getAttribute('data-panel-key')!,
				x: Number(tile.getAttribute('data-pos-x')),
				y: Number(tile.getAttribute('data-pos-y')),
			}))
			.sort((a, b) => a.key.localeCompare(b.key)),
	);
}

/** The drawn arrows (hints left out) by branch. */
export async function countArrows(page: Page): Promise<{ resolve: number; reject: number }> {
	const count = (type: string) =>
		page.locator(`[data-flow-arrows] path[data-arrow="${type}"]:not([data-hint])`).count();
	return { resolve: await count('resolve'), reject: await count('reject') };
}

/**
 * Moves the pressed mouse to (x, y) in 10 steps, waiting between them, then waits before release. The canvas reads
 * pointermove in requestAnimationFrame (tile drag and arrow drag, as Directus) and pointerup cancels the pending frame:
 * moves sent in one burst can all land in one frame that is cancelled (firefox, webkit), losing the drop position.
 */
export async function moveAndRelease(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
	for (let i = 1; i <= 10; i++) {
		await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10);
		await page.waitForTimeout(40);
	}
	await settleFrames(page);
	await page.mouse.up();
}

/** Waits for two animation frames of the page: the rAF pointermove handlers have read the last position. */
export async function settleFrames(page: Page): Promise<void> {
	await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/** Drags a panel by its header by whole cells (18 px), in small steps so the pointer events follow. */
export async function dragPanel(page: Page, key: string, cells: { dx: number; dy: number }): Promise<void> {
	const header = panel(page, key).locator(':scope > div').first();
	await header.scrollIntoViewIfNeeded();
	const box = (await header.boundingBox())!;
	const x = box.x + 40;
	const y = box.y + 10;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await moveAndRelease(page, { x, y }, { x: x + cells.dx * 18, y: y + cells.dy * 18 });
}

/** Drags the resolve or reject handle of `from` onto the input handle of `to` (or `null`: empty space, detach). */
export async function linkHandle(
	page: Page,
	from: string,
	type: 'resolve' | 'reject',
	to: string | null,
): Promise<void> {
	const source = panel(page, from).locator(`[data-handle="${type}"]`);
	const input = to ? panel(page, to).locator('[data-handle="input"]') : null;
	const view = page.viewportSize()!;
	await source.scrollIntoViewIfNeeded();

	// Both ends must be in the viewport: Firefox sends no pointer position outside it (the move reads (0, -85) and the
	// pointerup is lost). Scroll the canvas under the pointer until the target fits.
	if (input) {
		const [s, t] = [(await source.boundingBox())!, (await input.boundingBox())!];
		const dx = Math.max(0, t.x + t.width + 16 - view.width);
		const dy = Math.max(0, t.y + t.height + 16 - view.height);
		if (dx || dy) {
			await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
			await page.mouse.wheel(dx, dy);
			await page.waitForTimeout(200);
		}
	}

	const handle = (await source.boundingBox())!;
	const start = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();

	let target: { x: number; y: number };
	if (input) {
		const box = (await input.boundingBox())!;
		target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	} else {
		// Empty space straight below the handle, inside the viewport: attachments sit 72 px to the side of a handle.
		target = { x: start.x, y: Math.min(start.y + 30 * 18, view.height - 24) };
	}

	await moveAndRelease(page, start, target);
}

/** The first panel whose key starts with `prefix` (keys the app generates: `condition_ab12c`). */
export const panelByPrefix = (page: Page, prefix: string) => page.locator(`[data-panel-key^="${prefix}"]`).first();

/** Switches the flow page to edit mode (a flow without operations opens in it). */
export async function editFlow(page: Page): Promise<void> {
	await expect(panel(page, '$trigger')).toBeVisible({ timeout: 15_000 });
	const edit = page.getByRole('button', { name: 'Edit Flow' });
	if (await edit.isVisible()) await edit.click();
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
}

/** Saves the flow page and waits for view mode. */
export async function saveFlow(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Edit Flow' })).toBeVisible({ timeout: 30_000 });
}

/** "+" on the resolve or reject handle of `from`, picks `type` in the operation drawer (default name and key), Done. */
export async function addOperation(page: Page, from: Locator, hint: 'resolve' | 'reject', type: string): Promise<void> {
	await from.scrollIntoViewIfNeeded();
	await from.hover();
	await from.locator(`[data-hint="${hint}"]`).click();
	await page
		.getByRole('dialog')
		.getByRole('button', { name: new RegExp(`^${type}`) })
		.click();
	await page.getByRole('button', { name: 'Done' }).click();
	await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Opens the menu of a panel in edit mode and picks `entry` (`Duplicate`, `Delete`, `Copy To`). */
export async function tileMenu(page: Page, key: string, entry: string): Promise<void> {
	await panel(page, key)
		.getByRole('button', { name: /^Options for/ })
		.click();
	await page.getByRole('menuitem', { name: entry }).click();
}
