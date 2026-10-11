// Feature 004 (research R13): write flows of US3 run the same steps at Directus, then at Backoffice, each app with
// its own fixture and as its own admin (scenario()). Every response and the rows the flow wrote become a transcript in
// which the ids made by the flow are replaced by labels given in creation order, so the two transcripts compare.
import type { Captured, ParityRequest } from '../parity.js';
import { hostDb } from '../auth/db-effects.js';
import { alias, type ScenarioContext, send, snapshotOf } from '../auth/scenario.js';
import { adminToken } from '../directus-api.js';

const SYSTEM_TABLES = [
	'directus_roles',
	'directus_policies',
	'directus_access',
	'directus_permissions',
	'directus_users',
	'directus_presets',
];

export interface Flow {
	/** Sends a request as the admin of the app (or with `headers`) and records the normalized response. */
	req(method: string, path: string, body?: ParityRequest['body'], headers?: Record<string, string>): Promise<Captured>;
	/** Labels an id made by the flow (`<label>` in the transcript). */
	name(id: string | number, label: string): void;
	/** Labels a value only where a whole string equals it (an OTP, short values that could occur inside others). */
	nameExact(value: string, label: string): void;
	/** Records rows of a table (all columns or `columns`), ordered by `orderBy` (or the primary key). */
	rows(table: string, where: (q: any) => any, options?: { orderBy?: string; columns?: string[] }): Promise<void>;
	/** Records the activity and revisions written on the permission tables since the flow started. */
	activity(): Promise<void>;
	transcript(): unknown;
}

const maxId = async (table: string) => Number((await hostDb().max({ id: 'id' }).from(table).first())?.['id'] ?? 0);

const DATE = /^(timestamp|date_created|date_updated|last_access|last_page)$/;

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(row)) {
		if (DATE.test(key) && value !== null) out[key] = '<date>';
		else if (key === 'password' && typeof value === 'string' && value.startsWith('$argon2')) out[key] = '<argon2>';
		else if (key === 'token' && typeof value === 'string' && /^[\w-]{64}$/.test(value)) out[key] = '<session>';
		else if (key === 'ip' || key === 'user_agent' || key === 'origin') out[key] = value === null ? null : `<${key}>`;
		else if (typeof value === 'string' && /^[[{]/.test(value)) {
			try {
				out[key] = JSON.parse(value);
			} catch {
				out[key] = value;
			}
		} else if (typeof value === 'boolean' || typeof value === 'number' || value === null) out[key] = value;
		else out[key] = value instanceof Date ? '<date>' : String(value);
	}

	return out;
}

export async function startFlow(ctx: ScenarioContext): Promise<Flow> {
	const aliases: Record<string, string> = {};
	// Numeric ids (directus_permissions) are replaced as whole tokens only, never inside another value (a UUID).
	const numeric: Record<string, string> = {};
	const exact: Record<string, string> = {};
	const entries: unknown[] = [];
	const token = await adminToken(ctx.app);
	const lastActivity = await maxId('directus_activity');
	const lastRevision = await maxId('directus_revisions');

	return {
		async req(method, path, body, headers) {
			const res = await send(
				ctx.url,
				{
					method,
					path,
					...(body !== undefined ? { body } : {}),
					headers: headers ?? { authorization: `Bearer ${token}` },
				},
				ctx.host,
			);

			entries.push({ request: `${method} ${path}`, body, response: snapshotOf(path.split('?')[0]!, res) });
			return res;
		},

		nameExact(value, label) {
			exact[value] = `<${label}>`;
		},

		name(id, label) {
			if (typeof id === 'number') numeric[String(id)] = `<${label}>`;
			else aliases[id] = `<${label}>`;
		},

		async rows(table, where, options = {}) {
			const rows = await where(
				hostDb()
					.select(options.columns ?? '*')
					.from(table),
			).orderBy(options.orderBy ?? 'id');
			entries.push({ table, rows: rows.map(normalizeRow) });
		},

		async activity() {
			const activity = await hostDb()
				.select('id', 'action', 'collection', 'item')
				.from('directus_activity')
				.where('id', '>', lastActivity)
				.whereIn('collection', SYSTEM_TABLES)
				.orderBy('id');

			const revisions = await hostDb()
				.select('activity', 'collection', 'item', 'data', 'delta')
				.from('directus_revisions')
				.where('id', '>', lastRevision)
				.whereIn(
					'activity',
					activity.map((a) => a.id),
				)
				.orderBy('id');

			// Directus sorts the keys of a batch (`keys.sort()` in ItemsService), so the order of the rows follows random
			// ids: the rows are compared as sets (sorted in transcript()), a revision names its activity by content.
			const label = new Map(activity.map((a) => [a.id, `${a.action} ${a.collection} ${a.item}`]));

			entries.push({
				activity: activity.map(({ id: _id, ...a }) => normalizeRow(a)),
				revisions: revisions.map((r) => ({ ...normalizeRow(r), activity: label.get(r.activity) })),
			});
		},

		transcript() {
			// Ids are replaced everywhere at the end, so a label also covers the responses before it was given. A number
			// equal to a numeric id is replaced too: ids of a flow are far above the small numbers it writes (sort).
			const token = (value: string) => value.replace(/(?<![\w-])\d+(?![\w-])/g, (n) => numeric[n] ?? n);

			const numbers = JSON.parse(JSON.stringify(entries), (_key, value) => {
				if (typeof value === 'number') return numeric[String(value)] ?? value;
				if (typeof value === 'string' && exact[value]) return exact[value];
				return typeof value === 'string' ? token(value) : value;
			});

			const out = alias(numbers, aliases) as Record<string, unknown>[];
			const bySerialized = (a: unknown, b: unknown) => JSON.stringify(a).localeCompare(JSON.stringify(b));

			for (const entry of out) {
				if (Array.isArray(entry['activity'])) entry['activity'].sort(bySerialized);
				if (Array.isArray(entry['revisions'])) entry['revisions'].sort(bySerialized);
			}

			return out;
		},
	};
}
