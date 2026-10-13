// Feature 009 (research R10, contracts/parity.md §2): shared helpers of the flows parity files. A flow is seeded once
// through the API of one app (both apps of the main pair share the bus, so both reload it); the same trigger is then
// sent to both apps and the responses and the run logs each app wrote are compared.
import { randomUUID } from 'node:crypto';
import { acceptedDifferences } from '../../accepted-differences.js';
import { type AppName, appRequest } from '../directus-api.js';
import { comparable as historyComparable, type HistoryRows, historyEffects } from '../history/history-effects.js';
import { assertParity, type ParityOptions, type ParityRequest, parity } from '../parity.js';

export { BROWSER } from '../history/helpers.js';

/** D-09.7 hides every difference of /flows and /operations while the feature is open (precedent: D-09.6 in 008). */
export const withoutD097 = acceptedDifferences.filter((d) => !(d.feature === '001' && d.id === 'D-09.7'));

/** parity() without D-09.7, failing on any difference that is not accepted. */
export async function same(req: ParityRequest, options: ParityOptions = {}) {
	const result = await parity(req, { accepted: withoutD097, ...options });
	assertParity(result);
	return result;
}

export interface OperationDef {
	key: string;
	type: string;
	options?: Record<string, unknown>;
	/** `key` of the next operation on resolve / reject. */
	resolve?: string;
	reject?: string;
}

export interface FlowDef {
	name?: string;
	status?: 'active' | 'inactive';
	trigger: 'event' | 'schedule' | 'operation' | 'webhook' | 'manual';
	options?: Record<string, unknown>;
	accountability?: 'all' | 'activity' | null;
	/** The first operation is the root of the flow. */
	operations?: OperationDef[];
}

export interface SeededFlow {
	id: string;
	/** Operation ids by key, and the flow id as `flow`: placeholders for `comparable()`. */
	ids: Record<string, string>;
}

/** Time the apps need to reload the flows after the bus message of a write (milliseconds). */
export const RELOAD_WAIT = 500;

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates the flow and its operations through the API of `via` (operations last to first, so resolve and reject point
 * to existing rows), points the flow to its root, then waits for both apps to reload.
 */
export async function seedFlow(def: FlowDef, via: AppName = 'directus', baseUrl?: string): Promise<SeededFlow> {
	const id = randomUUID();
	const ids: Record<string, string> = { flow: id };
	for (const op of def.operations ?? []) ids[op.key] = randomUUID();

	await appRequest(
		via,
		'POST',
		'/flows',
		{
			id,
			name: def.name ?? `parity-flow-${id.slice(0, 8)}`,
			status: def.status ?? 'active',
			trigger: def.trigger,
			options: def.options ?? {},
			accountability: def.accountability === undefined ? 'all' : def.accountability,
		},
		baseUrl,
	);

	for (const op of [...(def.operations ?? [])].reverse()) {
		await appRequest(
			via,
			'POST',
			'/operations',
			{
				id: ids[op.key],
				key: op.key,
				name: op.key,
				type: op.type,
				options: op.options ?? {},
				position_x: 1,
				position_y: 1,
				flow: id,
				resolve: op.resolve ? ids[op.resolve] : null,
				reject: op.reject ? ids[op.reject] : null,
			},
			baseUrl,
		);
	}

	if (def.operations?.length) {
		await appRequest(via, 'PATCH', `/flows/${id}`, { operation: ids[def.operations[0]!.key] }, baseUrl);
	}

	await sleep(RELOAD_WAIT);
	return { id, ids };
}

/** Deletes the flows (their operations go with them) through `via`, then waits for both apps to reload. */
export async function cleanupFlows(ids: string[], via: AppName = 'directus', baseUrl?: string): Promise<void> {
	if (ids.length === 0) return;
	await appRequest(via, 'DELETE', '/flows', ids, baseUrl);
	await sleep(RELOAD_WAIT);
}

/** Runs `fn` and returns the run log rows (and notifications) it created, like historyEffects of feature 008. */
export const flowEffects = historyEffects;

/**
 * Comparable form of run log rows: history comparable() (ids of the flow as placeholders, times as `<time>`), plus
 * the run revision without `$env` (equal at both apps by construction, D-free) and with only the content type of the
 * headers of a `request` operation result (servers add their own date and connection headers).
 */
export function comparable(rows: HistoryRows, ids: Record<string, string | number> = {}): any {
	const base = historyComparable(rows, ids) as any;

	for (const revision of base.revisions as any[]) {
		const data = revision.data?.data;
		if (data && typeof data === 'object') delete data.$env;
		if (data && typeof data === 'object') for (const key of Object.keys(data)) data[key] = stableHeaders(data[key]);
	}

	return base;
}

/** Keeps only `content-type` of a `{status, statusText, headers, data}` result of the request operation. */
export function stableHeaders(value: unknown): unknown {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
	const record = value as Record<string, any>;

	if ('status' in record && 'statusText' in record && record['headers'] && typeof record['headers'] === 'object') {
		return { ...record, headers: { 'content-type': record['headers']['content-type'] } };
	}

	return value;
}

/** The run activity rows of a flow written since `afterId` (activity id), for polling the result of async runs. */
export async function runRows(flowId: string, afterId = 0): Promise<Record<string, unknown>[]> {
	const { hostDb } = await import('../auth/db-effects.js');

	return hostDb()
		.select('*')
		.from('directus_activity')
		.where({ action: 'run', collection: 'directus_flows', item: flowId })
		.andWhere('id', '>', afterId)
		.orderBy('id');
}

/** Polls `check` until it returns true or `timeoutMs` passes (action and async flows run after the response). */
export async function until(check: () => Promise<boolean>, timeoutMs = 5000, stepMs = 200): Promise<boolean> {
	const end = Date.now() + timeoutMs;

	while (Date.now() < end) {
		if (await check()) return true;
		await sleep(stepMs);
	}

	return check();
}
