// Seed of the system benchmark (feature 010, contracts/parity.md §8): an admin and a user with the app minimal
// permissions (static tokens); on the host (Postgres, batch inserts) PRESETS presets of the user, NOTIFICATIONS
// notifications to the user (half in the inbox), DASHBOARDS dashboards of PANELS panels each, a collection with a sort
// field and SORT_ROWS rows; one share with a password made through the Directus API (argon2 hash).
import { randomBytes, randomUUID } from 'node:crypto';
import { db, directus } from './seed-permissions.ts';

const PRESETS = Number(process.env['BENCH_SYSTEM_PRESETS'] ?? 200);
const NOTIFICATIONS = Number(process.env['BENCH_SYSTEM_NOTIFICATIONS'] ?? 500);
const DASHBOARDS = Number(process.env['BENCH_SYSTEM_DASHBOARDS'] ?? 20);
const PANELS = Number(process.env['BENCH_SYSTEM_PANELS'] ?? 10);
const SORT_ROWS = Number(process.env['BENCH_SYSTEM_SORT_ROWS'] ?? 1000);

export const SHARE_PASSWORD = 'bench-share-password';

export interface SystemSeed {
	tag: string;
	collection: string;
	tokens: { admin: string; user: string };
	user: string;
	rows: number[];
	share: string;
	seconds: number;
}

/** Inserts rows 500 at a time on the host and returns their `id`. */
async function insertAll(table: string, rows: Record<string, unknown>[]): Promise<(number | string)[]> {
	const ids: (number | string)[] = [];

	for (let i = 0; i < rows.length; i += 500) {
		const out = await db(table)
			.insert(rows.slice(i, i + 500))
			.returning('id');
		ids.push(...out.map((row: any) => row.id ?? row));
	}

	return ids;
}

export async function seed(): Promise<SystemSeed> {
	const started = Date.now();
	const tag = `bench-system-${randomBytes(3).toString('hex')}`;
	const collection = `bench_system_${tag.slice(-6)}`;

	await directus('POST', '/collections', {
		collection,
		schema: {},
		meta: { sort_field: 'sort' },
		fields: [
			{
				field: 'id',
				type: 'integer',
				meta: { hidden: true },
				schema: { is_primary_key: true, has_auto_increment: true },
			},
			{ field: 'sort', type: 'integer' },
			{ field: 'title', type: 'string' },
		],
	});

	const policy = async (name: string, body: Record<string, unknown>) =>
		(await directus('POST', '/policies', { name: `${tag}-${name}`, icon: 'badge', ...body })).data.id as string;

	const tokens = { admin: `${tag}-admin`, user: `${tag}-user` };
	const users: Record<string, string> = {};

	for (const [name, body] of [
		['admin', { admin_access: true, app_access: true }],
		['user', { app_access: true }],
	] as const) {
		const id = (
			await directus('POST', '/users', { email: `${tag}-${name}@example.com`, token: tokens[name], status: 'active' })
		).data.id as string;
		await directus('POST', '/access', { user: id, policy: await policy(name, body) });
		users[name] = id;
	}

	const user = users['user']!;
	const now = new Date();

	await insertAll(
		'directus_presets',
		Array.from({ length: PRESETS }, (_, i) => ({
			user,
			collection,
			layout: 'tabular',
			bookmark: i % 4 === 0 ? `${tag} bookmark ${i}` : null,
			layout_query: JSON.stringify({ tabular: { sort: ['sort'], page: 1 } }),
		})),
	);

	await insertAll(
		'directus_notifications',
		Array.from({ length: NOTIFICATIONS }, (_, i) => ({
			recipient: user,
			sender: users['admin'],
			subject: `${tag} notification ${i}`,
			status: i % 2 === 0 ? 'inbox' : 'archived',
			timestamp: now,
		})),
	);

	const dashboards = Array.from({ length: DASHBOARDS }, () => randomUUID());

	await insertAll(
		'directus_dashboards',
		dashboards.map((id, i) => ({ id, name: `${tag} dashboard ${i}`, icon: 'insights', date_created: now })),
	);

	await insertAll(
		'directus_panels',
		dashboards.flatMap((dashboard) =>
			Array.from({ length: PANELS }, (_, p) => ({
				id: randomUUID(),
				dashboard,
				name: `${tag} panel ${p}`,
				type: 'label',
				position_x: 1 + (p % 4) * 10,
				position_y: 1 + Math.floor(p / 4) * 10,
				width: 10,
				height: 10,
				show_header: true,
				options: JSON.stringify({ text: `${tag} ${p}` }),
				date_created: now,
			})),
		),
	);

	const rows = (await insertAll(
		collection,
		Array.from({ length: SORT_ROWS }, (_, i) => ({ sort: i + 1, title: `${tag} row ${i}` })),
	)) as number[];

	const share = (
		await directus('POST', '/shares', {
			name: tag,
			collection,
			item: String(rows[0]),
			password: SHARE_PASSWORD,
		})
	).data.id as string;

	return { tag, collection, tokens, user, rows, share, seconds: Math.round((Date.now() - started) / 1000) };
}

export async function cleanup(seeded: SystemSeed): Promise<void> {
	await db('directus_sessions').where({ share: seeded.share }).delete();
	await db('directus_shares').where({ id: seeded.share }).delete();
	await db('directus_panels').where('name', 'like', `${seeded.tag}%`).delete();
	await db('directus_dashboards').where('name', 'like', `${seeded.tag}%`).delete();
	await db('directus_notifications').where('subject', 'like', `${seeded.tag}%`).delete();
	await db('directus_presets').where({ collection: seeded.collection }).delete();
	await directus('DELETE', `/collections/${seeded.collection}`);

	const users = await db('directus_users').select('id').where('email', 'like', `${seeded.tag}%`);
	if (users.length)
		await directus(
			'DELETE',
			'/users',
			users.map((u) => u.id),
		);

	for (const { id: policy } of await db('directus_policies').select('id').where('name', 'like', `${seeded.tag}%`)) {
		await directus('DELETE', `/policies/${policy}`);
	}
}
