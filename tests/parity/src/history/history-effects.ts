// Feature 008 (spec FR-060, research R6): the history rows a flow writes (directus_activity, directus_revisions,
// directus_versions, directus_comments, directus_notifications), read from the host with SELECT only (SQLite works on
// Linux CI), and their comparable form. Each app runs the same steps (scenario()), so ids and times differ between
// the two transcripts: generated ids become placeholders, times become `<time>`, links between rows become indexes.
import { hostDb } from '../auth/db-effects.js';

export interface HistoryRows {
	activity: Record<string, unknown>[];
	revisions: Record<string, unknown>[];
	versions: Record<string, unknown>[];
	comments: Record<string, unknown>[];
	notifications: Record<string, unknown>[];
	/** `key` of every version a captured revision points to (`directus_revisions.version`). */
	versionKeys: Record<string, string>;
}

const SERIAL_TABLES = {
	activity: 'directus_activity',
	revisions: 'directus_revisions',
	notifications: 'directus_notifications',
} as const;

const UUID_TABLES = { versions: 'directus_versions', comments: 'directus_comments' } as const;

const maxId = async (table: string) => Number((await hostDb().max({ id: 'id' }).from(table).first())?.['id'] ?? 0);

const idsOf = async (table: string) =>
	new Set((await hostDb().select('id').from(table)).map((row) => String(row['id'])));

/** Runs `fn` and returns its result with the history rows created while it ran (rows updated in place are not). */
export async function historyEffects<T>(fn: () => Promise<T>): Promise<{ result: T; rows: HistoryRows }> {
	const serial = Object.fromEntries(
		await Promise.all(Object.entries(SERIAL_TABLES).map(async ([name, table]) => [name, await maxId(table)])),
	) as Record<keyof typeof SERIAL_TABLES, number>;

	const uuids = Object.fromEntries(
		await Promise.all(Object.entries(UUID_TABLES).map(async ([name, table]) => [name, await idsOf(table)])),
	) as Record<keyof typeof UUID_TABLES, Set<string>>;

	const result = await fn();

	const rows = { versionKeys: {} } as HistoryRows;

	for (const [name, table] of Object.entries(SERIAL_TABLES) as [keyof typeof SERIAL_TABLES, string][]) {
		rows[name] = await hostDb().select('*').from(table).where('id', '>', serial[name]).orderBy('id');
	}

	for (const [name, table] of Object.entries(UUID_TABLES) as [keyof typeof UUID_TABLES, string][]) {
		rows[name] = (await hostDb().select('*').from(table).orderBy('date_created')).filter(
			(row) => !uuids[name].has(String(row['id'])),
		);
	}

	const versionIds = [...new Set(rows.revisions.map((r) => r['version']).filter((v) => v != null))] as string[];

	if (versionIds.length > 0) {
		for (const v of await hostDb().select('id', 'key').from('directus_versions').whereIn('id', versionIds)) {
			rows.versionKeys[String(v['id'])] = String(v['key']);
		}
	}

	return { result, rows };
}

const TIME_KEYS = new Set(['timestamp', 'date_created', 'date_updated', '_date']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);

/** JSON columns come back as text on MySQL, SQLite, MSSQL and Oracle, as objects on Postgres. */
function parseJson(value: unknown): unknown {
	if (typeof value !== 'string') return value;

	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

/**
 * Comparable form of the rows. `ids` names the ids of the flow (`{ item: 12, author: 'uuid' }`); new comment and
 * version ids are added as `<comment:i>`, `<version:i>`. A value equal to an id becomes its placeholder; inside text
 * (notification messages, links) an id is replaced as a whole token. Times keep only whether they are set.
 */
export function comparable(rows: HistoryRows, ids: Record<string, string | number> = {}): unknown {
	const exact = new Map<string, string>();
	for (const [name, id] of Object.entries(ids)) exact.set(String(id), `<${name}>`);
	rows.comments.forEach((row, i) => exact.set(String(row['id']), `<comment:${i}>`));
	rows.versions.forEach((row, i) => exact.set(String(row['id']), `<version:${i}>`));

	// Inside text an id is replaced only as a whole token (`/posts/7"` yes, `17` or `v7-a` no).
	const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const tokens = [...exact].map(([id, name]) => [new RegExp(`(?<![\\w-])${escape(id)}(?![\\w-])`, 'g'), name] as const);

	const value = (v: unknown, key?: string): unknown => {
		if (key !== undefined && TIME_KEYS.has(key)) return v == null ? null : '<time>';
		if (v === null || v === undefined) return null;
		if (Array.isArray(v)) return v.map((item) => value(item));
		if (isRecord(v)) return Object.fromEntries(Object.entries(v).map(([k, inner]) => [k, value(inner, k)]));
		if (typeof v === 'string' || typeof v === 'number') {
			const hit = exact.get(String(v));
			if (hit) return hit;
			if (typeof v === 'string') return tokens.reduce((text, [pattern, name]) => text.replace(pattern, name), v);
		}

		return v;
	};

	const row = (r: Record<string, unknown>, drop: string[], json: string[] = []) =>
		Object.fromEntries(
			Object.entries(r)
				.filter(([column]) => !drop.includes(column))
				.map(([column, v]) => [column, value(json.includes(column) ? parseJson(v) : v, column)]),
		);

	const activityIndex = new Map(rows.activity.map((a, i) => [String(a['id']), i]));
	const revisionIndex = new Map(rows.revisions.map((r, i) => [String(r['id']), i]));

	const indexOf = (index: Map<string, number>, id: unknown) =>
		id == null ? null : (index.get(String(id)) ?? '<outside>');

	return {
		activity: rows.activity.map((a) => row(a, ['id'])),
		revisions: rows.revisions.map((r) => ({
			...row(r, ['id', 'activity', 'parent', 'version'], ['data', 'delta']),
			activity: indexOf(activityIndex, r['activity']),
			parent: indexOf(revisionIndex, r['parent']),
			version: r['version'] == null ? null : `key:${rows.versionKeys[String(r['version'])] ?? '<outside>'}`,
		})),
		versions: rows.versions.map((v) => row(v, ['id'], ['delta'])),
		comments: rows.comments.map((c) => row(c, ['id'])),
		notifications: rows.notifications.map((n) => row(n, ['id'])),
	};
}
