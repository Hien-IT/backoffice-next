// Feature 017 (contracts/components.md §6): the flows of the fixture set and the temporary flows a spec creates. A spec
// names its flows `${DATA_PREFIX}-<spec>-<n>` (the three configurations never touch each other's rows) and deletes
// them in `afterAll`; no spec runs `bo_all_ops`, whose three log rows come from the seed (CHK007).
import type { Page } from '@playwright/test';
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

/** Drags a panel by its header by whole cells (18 px), in small steps so the pointer events follow. */
export async function dragPanel(page: Page, key: string, cells: { dx: number; dy: number }): Promise<void> {
	const header = panel(page, key).locator(':scope > div').first();
	await header.scrollIntoViewIfNeeded();
	const box = (await header.boundingBox())!;
	const x = box.x + 40;
	const y = box.y + 10;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x + cells.dx * 18, y + cells.dy * 18, { steps: 8 });
	await page.mouse.up();
}

/** Drags the resolve or reject handle of `from` onto the input handle of `to` (or `null`: empty space, detach). */
export async function linkHandle(
	page: Page,
	from: string,
	type: 'resolve' | 'reject',
	to: string | null,
): Promise<void> {
	await panel(page, from).locator(`[data-handle="${type}"]`).scrollIntoViewIfNeeded();
	const handle = (await panel(page, from).locator(`[data-handle="${type}"]`).boundingBox())!;
	await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
	await page.mouse.down();

	let target: { x: number; y: number };
	if (to) {
		// Both ends must be in the viewport: the canvas scrolls, the pointer does not.
		const input = (await panel(page, to).locator('[data-handle="input"]').boundingBox())!;
		target = { x: input.x + input.width / 2, y: input.y + input.height / 2 };
	} else {
		target = { x: handle.x + 20 * 18, y: handle.y + 30 * 18 };
	}

	await page.mouse.move(target.x, target.y, { steps: 10 });
	await page.mouse.up();
}
