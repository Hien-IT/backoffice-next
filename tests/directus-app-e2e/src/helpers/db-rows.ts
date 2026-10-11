// The rows a scenario wrote, read from the host database (SELECT only) and put in a comparable form: generated keys
// become markers in order of appearance, dates and hashes become markers, JSON is parsed (like db-effects of 003).
import knex, { type Knex } from 'knex';

const TABLES = ['directus_users', 'directus_roles', 'directus_policies', 'directus_access', 'directus_permissions'];
const DATES = new Set(['date_created', 'date_updated', 'timestamp', 'last_access', 'expires']);

let db: Knex | undefined;

export function hostDb(): Knex {
	db ??= knex({
		client: 'pg',
		connection: { database: 'directus', user: 'postgres', password: 'secret', host: '127.0.0.1', port: 6100 },
	});

	return db;
}

export async function closeHostDb(): Promise<void> {
	await db?.destroy();
	db = undefined;
}

type Row = Record<string, unknown>;

export interface Snapshot {
	tables: Record<string, Map<string, Row>>;
	activity: number;
	revisions: number;
}

const keyOf = (row: Row) => String(row['id']);

export async function snapshot(): Promise<Snapshot> {
	const tables: Record<string, Map<string, Row>> = {};

	for (const table of TABLES) {
		const rows = (await hostDb().select('*').from(table)) as Row[];
		tables[table] = new Map(rows.map((row) => [keyOf(row), row]));
	}

	const max = async (table: string) => Number((await hostDb().max({ id: 'id' }).from(table).first())?.['id'] ?? 0);
	return { tables, activity: await max('directus_activity'), revisions: await max('directus_revisions') };
}

/** Rows added, changed or removed since `before`, and the activity and revisions written since, normalized. */
export async function changesSince(before: Snapshot): Promise<unknown> {
	const after = await snapshot();
	const markers = new Map<string, string>();
	const mark = (value: string) => {
		if (!markers.has(value)) markers.set(value, `<id${markers.size + 1}>`);
		return markers.get(value)!;
	};

	const isId = (value: unknown) =>
		typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);

	const normalize = (value: unknown, column?: string): unknown => {
		if (value === null || value === undefined) return null;
		if (column && DATES.has(column)) return '<date>';
		if (column === 'password' && typeof value === 'string') return '<argon2>';
		if (column === 'token' && typeof value === 'string') return '<token>';
		if (value instanceof Date) return '<date>';
		if (isId(value)) return mark(value as string);
		if (typeof value === 'string' && /^[[{]/.test(value)) {
			try {
				return normalize(JSON.parse(value));
			} catch {
				return value;
			}
		}

		if (Array.isArray(value)) return value.map((v) => normalize(v));
		if (typeof value === 'object') {
			return Object.fromEntries(Object.entries(value as Row).map(([k, v]) => [k, normalize(v, k)]));
		}

		return value;
	};

	const changes: Record<string, unknown> = {};

	for (const table of TABLES) {
		const old = before.tables[table]!;
		const now = after.tables[table]!;
		const added = [...now.entries()].filter(([key]) => !old.has(key)).map(([, row]) => row);
		const removed = [...old.entries()].filter(([key]) => !now.has(key)).map(([, row]) => row);
		const changed = [...now.entries()]
			.filter(([key, row]) => old.has(key) && JSON.stringify(old.get(key)) !== JSON.stringify(row))
			.map(([, row]) => row);

		// Numeric keys (directus_permissions) are dropped: their value depends on the rows of earlier runs.
		const drop = (row: Row) => (typeof row['id'] === 'number' ? { ...row, id: '<serial>' } : row);
		changes[table] = { added: added.map(drop), changed: changed.map(drop), removed: removed.map(drop) };
	}

	changes['activity'] = await hostDb()
		.select('action', 'collection', 'item')
		.from('directus_activity')
		.where('id', '>', before.activity)
		.whereIn('collection', TABLES)
		.orderBy('id');

	// Normalized in one pass so markers follow the order of appearance in the whole result.
	return normalize(changes);
}
