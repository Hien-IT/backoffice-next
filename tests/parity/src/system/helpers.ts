// Feature 010 (research R10, contracts/parity.md §2): shared helpers of the system collection parity files. Reads go to
// both apps at once with same(); writes run as scenarios (Directus, then Backoffice) and compare the responses and the
// rows each app wrote, read from the host with SELECT only (SQLite works on Linux CI).
import knex, { type Knex } from 'knex';
import { acceptedDifferences } from '../../accepted-differences.js';
import { hostDb } from '../auth/db-effects.js';
import { setupDbPort } from '../config.js';
import { type AppName, appRequest } from '../directus-api.js';
import { logs } from '../docker.js';
import { assertParity, type ParityOptions, type ParityRequest, parity } from '../parity.js';

export { admin, call, idsOf, snap } from '../files/helpers.js';
export { BROWSER } from '../history/helpers.js';

/**
 * D-09.8 hides every difference of the nine routes of this feature, and D-14 the ones of POST /server/setup, while the
 * feature is open (precedent: D-09.6 in 008, D-09.7 in 009).
 */
export const withoutD098 = acceptedDifferences.filter(
	(d) => !(d.feature === '001' && (d.id === 'D-09.8' || d.id === 'D-14')),
);

/** parity() without D-09.8 and D-14, failing on any difference that is not accepted. */
export async function same(req: ParityRequest, options: ParityOptions = {}) {
	const result = await parity(req, { accepted: withoutD098, ...options });
	assertParity(result);
	return result;
}

/** The tables of this feature with the column that tells new rows apart (serial ids grow, other keys are new). */
const TABLES = {
	presets: { table: 'directus_presets', key: 'id', serial: true },
	notifications: { table: 'directus_notifications', key: 'id', serial: true },
	shares: { table: 'directus_shares', key: 'id', serial: false },
	sessions: { table: 'directus_sessions', key: 'token', serial: false },
	translations: { table: 'directus_translations', key: 'id', serial: false },
	dashboards: { table: 'directus_dashboards', key: 'id', serial: false },
	panels: { table: 'directus_panels', key: 'id', serial: false },
	files: { table: 'directus_files', key: 'id', serial: false },
} as const;

export type SystemTable = keyof typeof TABLES;
export type SystemRows = Record<SystemTable, Record<string, unknown>[]>;

async function marker(name: SystemTable): Promise<number | Set<string>> {
	const { table, key, serial } = TABLES[name];
	if (serial) return Number((await hostDb().max({ m: key }).from(table).first())?.['m'] ?? 0);
	return new Set((await hostDb().select(key).from(table)).map((row) => String(row[key])));
}

/** Runs `fn` and returns its result with the rows of `tables` created while it ran (rows updated in place are not). */
export async function systemEffects<T>(
	tables: SystemTable[],
	fn: () => Promise<T>,
): Promise<{ result: T; rows: Partial<SystemRows> }> {
	const before = new Map(await Promise.all(tables.map(async (t) => [t, await marker(t)] as const)));
	const result = await fn();
	const rows: Partial<SystemRows> = {};

	for (const name of tables) {
		const { table, key } = TABLES[name];
		const mark = before.get(name)!;

		const all =
			typeof mark === 'number'
				? await hostDb().select('*').from(table).where(key, '>', mark).orderBy(key)
				: (await hostDb().select('*').from(table)).filter((row) => !mark.has(String(row[key])));

		rows[name] = all;
	}

	return { result, rows };
}

const TIME_KEYS = new Set([
	'timestamp',
	'date_created',
	'date_updated',
	'date_start',
	'date_end',
	'expires',
	'uploaded_on',
	'modified_on',
	'created_on',
	'last_access',
	'last_page',
]);

/**
 * Comparable form of rows or responses. `ids` names the ids of the run (`{ share: 'uuid' }` → `<share>`); times keep
 * only whether they are set; argon2 hashes, session tokens and file names on disk become markers of their kind, since
 * salts and generated values differ between the two runs (FR-100). Hashes are compared by verifying them instead.
 */
export function comparable<T>(value: T, ids: Record<string, string | number> = {}): T {
	const exact = new Map(Object.entries(ids).map(([name, id]) => [String(id), `<${name}>`]));

	const walk = (v: unknown, key?: string): unknown => {
		if (key !== undefined && TIME_KEYS.has(key)) return v == null ? null : '<time>';
		if (v === null || v === undefined) return v ?? null;
		if (Array.isArray(v)) return v.map((item) => walk(item));

		if (typeof v === 'object') {
			return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, inner]) => [k, walk(inner, k)]));
		}

		if (typeof v === 'string') {
			if (exact.has(v)) return exact.get(v);
			if (v.startsWith('$argon2')) return '<argon2>';
			if (key === 'token' && /^[\w-]{64}$/.test(v)) return '<token>';
			if (key === 'filename_disk') return '<filename_disk>';
			return v;
		}

		if (typeof v === 'number' && exact.has(String(v))) return exact.get(String(v));
		return v;
	};

	return walk(value) as T;
}

/** Payload of a JWT without the claims that differ between two logins (FR-100). */
export function jwtPayload(token: string): Record<string, unknown> {
	const {
		iat: _iat,
		exp: _exp,
		session: _session,
		...rest
	} = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8'));

	return rest;
}

/** Whether `plain` matches `hash` according to POST /utils/hash/verify of `app` (cross check of argon2 hashes). */
export async function verifyHashAt(app: AppName, hash: string, plain: string): Promise<boolean> {
	return (await appRequest(app, 'POST', '/utils/hash/verify', { string: plain, hash })).data === true;
}

/** Number of lines of the container log of `service` that contain `needle` (count before and after a step). */
export function warnLines(service: string, needle: string): number {
	return logs(service)
		.split('\n')
		.filter((line) => line.includes(needle)).length;
}

let setup: Knex | undefined;

/** The own Postgres of the setup pair (profile `setup`, research R11). */
export function setupDb(): Knex {
	setup ??= knex({
		client: 'pg',
		connection: { database: 'directus', user: 'postgres', password: 'secret', host: '127.0.0.1', port: setupDbPort },
	});

	return setup;
}

export async function closeSetupDb(): Promise<void> {
	await setup?.destroy();
	setup = undefined;
}
