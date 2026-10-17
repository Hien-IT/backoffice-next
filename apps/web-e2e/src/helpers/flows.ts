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
