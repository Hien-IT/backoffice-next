// Feature 008 (research R6): shared helpers of the history parity files. Writes run as scenarios (Directus, then
// Backoffice) and compare the responses and the history rows each app wrote; reads that change nothing go to both apps
// at once with parity().
import { acceptedDifferences } from '../../accepted-differences.js';
import type { ScenarioContext, Snapshot } from '../auth/scenario.js';
import { call, snap } from '../files/helpers.js';
import { assertParity, type ParityOptions, type ParityRequest, parity } from '../parity.js';
import { createUserCollection } from '../permissions/fixtures.js';
import { comparable, historyEffects } from './history-effects.js';

export { admin, call, idsOf, snap } from '../files/helpers.js';

/**
 * The temporary D-09.6 entry ("/activity, /revisions, /versions, /comments are built by feature 008") would accept
 * every difference of these routes until the close of the feature; the history files compare without it.
 */
export const withoutD096 = acceptedDifferences.filter((d) => !(d.feature === '001' && d.id === 'D-09.6'));

/** parity() of a read, without D-09.6, failing on any difference. */
export async function same(req: ParityRequest, options: ParityOptions = {}) {
	const result = await parity(req, { accepted: withoutD096, ...options });
	assertParity(result);
	return result;
}

/** Headers of a browser request, so `user_agent` and `origin` of the activity rows are set and equal at both apps. */
export const BROWSER = { 'user-agent': 'Mozilla/5.0 (parity-history)', origin: 'http://parity.example' };

/** A user collection with a uuid key and a `title` field; history tracking and content versioning as given. */
export async function historyCollection(
	name: string,
	meta: { accountability?: 'all' | 'activity' | null; versioning?: boolean } = {},
	fields: Record<string, unknown>[] = [],
): Promise<string> {
	return createUserCollection(name, [{ field: 'title', type: 'string' }, ...fields], {
		primaryKey: 'uuid',
		meta: { accountability: meta.accountability === undefined ? 'all' : meta.accountability, ...meta },
	});
}

export interface Step {
	response: Snapshot;
	history: unknown;
}

/**
 * One request of a scenario with the history rows it wrote. `ids` names the ids of this run (placeholders in the
 * response and in the rows); `idsFrom` adds ids read from the response after it came back. Compare `step` only.
 */
export async function step(
	ctx: ScenarioContext,
	req: ParityRequest,
	path: string,
	ids: Record<string, string> = {},
	idsFrom?: (json: any) => Record<string, string> | Promise<Record<string, string>>,
): Promise<{ step: Step; json: any }> {
	const { result, rows } = await historyEffects(() => call(ctx, req));
	const all = { ...ids, ...((await idsFrom?.(result.json)) ?? {}) };
	// The raw body stays out of the transcript: only `step` (ids as placeholders) is compared.
	return { step: { response: snapHistory(result, path, all), history: comparable(rows, all) }, json: result.json };
}

/** snap() plus the `_date` stamps of version deltas (spec FR-033), kept only as set or not. */
export function snapHistory(...args: Parameters<typeof snap>): Snapshot {
	const stamp = (value: unknown, key?: string): unknown => {
		if (key === '_date') return value == null ? null : '<time>';
		if (Array.isArray(value)) return value.map((v) => stamp(v));
		if (value && typeof value === 'object')
			return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stamp(v, k)]));
		return value;
	};

	return stamp(snap(...args)) as Snapshot;
}
