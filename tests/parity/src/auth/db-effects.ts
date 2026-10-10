// Feature 003 (SC-005, research R6): the rows an auth flow writes, read from the host (SELECT only, so SQLite works
// on Linux CI) and normalized so the two apps can be compared. Generated values become markers of their kind.
import knex, { type Knex } from 'knex';
import { knexConfig } from '../config.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { tokenKind } from '../normalizers.js';

let db: Knex | undefined;

export function hostDb(): Knex {
	if (db) return db;
	const [vendor] = getDbsToTest();
	const { waitTestSQL: _sql, ...config } = knexConfig[vendor!];
	db = knex(config);
	return db;
}

export async function closeHostDb(): Promise<void> {
	await db?.destroy();
	db = undefined;
}

export interface RawEffects {
	sessions: Record<string, unknown>[];
	activity: Record<string, unknown>[];
	revisions: Record<string, unknown>[];
	user: Record<string, unknown> | undefined;
}

const maxId = async (table: string) => Number((await hostDb().max({ id: 'id' }).from(table).first())?.['id'] ?? 0);

/** Rows written while `fn` runs: new activity and revisions about the user, its sessions and its row afterwards. */
export async function captureDbEffects(userId: string, fn: () => Promise<unknown>): Promise<RawEffects> {
	const lastActivity = await maxId('directus_activity');
	const lastRevision = await maxId('directus_revisions');
	const sessionsBefore = new Set(
		(await hostDb().select('token').from('directus_sessions').where({ user: userId })).map((r) => r.token as string),
	);

	await fn();

	const activity = await hostDb()
		.select('*')
		.from('directus_activity')
		.where('id', '>', lastActivity)
		.andWhere((q) => q.where({ item: userId }).orWhere({ user: userId }))
		.orderBy('id');

	const revisions = await hostDb()
		.select('*')
		.from('directus_revisions')
		.where('id', '>', lastRevision)
		.whereIn(
			'activity',
			activity.map((a) => a.id),
		)
		.orderBy('id');

	const sessions = (await hostDb().select('*').from('directus_sessions').where({ user: userId })).filter(
		(s) => !sessionsBefore.has(s.token),
	);

	const user = await hostDb().select('*').from('directus_users').where({ id: userId }).first();

	return { sessions, activity, revisions, user };
}

const DATE_COLUMNS = new Set(['timestamp', 'expires', 'last_access']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

function normalizeValue(column: string, value: unknown): unknown {
	if (value === null || value === undefined) return value ?? null;
	if (DATE_COLUMNS.has(column)) return '<date>';
	if (typeof value === 'string' && (column === 'token' || column === 'next_token')) return tokenKind(value);
	if (column === 'password' && typeof value === 'string') return value.replace(/\$[^$]+\$[^$]+$/, '$<salt>$<hash>');
	if (column === 'data' || column === 'delta') {
		let parsed = value;

		try {
			if (typeof value === 'string') parsed = JSON.parse(value);
		} catch {
			return value;
		}

		// Revision snapshots carry the same columns (last_access, password, ...): same markers.
		return isRecord(parsed)
			? Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, normalizeValue(k, v)]))
			: parsed;
	}

	return value;
}

const normalizeRow = (row: Record<string, unknown>, drop: string[] = []) =>
	Object.fromEntries(
		Object.entries(row)
			.filter(([column]) => !drop.includes(column))
			.map(([column, value]) => [column, normalizeValue(column, value)]),
	);

/**
 * Comparable form: ids dropped, revisions point to the index of their activity, dates and tokens as markers,
 * argon2 hashes without salt and hash, revision JSON parsed. Sessions sorted by expiry, then token kind.
 */
export function normalizeEffects(raw: RawEffects): unknown {
	const activityIndex = new Map(raw.activity.map((a, i) => [a['id'], i]));

	return {
		sessions: raw.sessions
			.map((s) => ({ row: normalizeRow(s), expires: new Date(s['expires'] as string).getTime() }))
			.sort((a, b) => a.expires - b.expires)
			.map((s) => s.row),
		activity: raw.activity.map((a) => normalizeRow(a, ['id'])),
		revisions: raw.revisions.map((r) => ({
			...normalizeRow(r, ['id', 'activity']),
			activity: activityIndex.get(r['activity']),
		})),
		user: raw.user ? normalizeRow(raw.user) : undefined,
	};
}
