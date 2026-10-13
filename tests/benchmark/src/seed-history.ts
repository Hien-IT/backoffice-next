// Seed of the history benchmark (feature 008, contracts/parity.md §6): a collection with content versioning and
// accountability `all` made through the Directus API, then on the host (Postgres, batch inserts) ITEMS items, REVISIONS
// update activity rows with one revision each per item, and one `draft` version with a delta per item; an admin and a
// user with the app minimal permissions (static tokens).
import { randomBytes, randomUUID } from 'node:crypto';
import { db, directus } from './seed-permissions.ts';

const ITEMS = Number(process.env['BENCH_HISTORY_ITEMS'] ?? 2000);
const REVISIONS = Number(process.env['BENCH_HISTORY_REVISIONS'] ?? 20);

export interface HistorySeed {
	tag: string;
	collection: string;
	tokens: { admin: string; user: string };
	items: number[];
	versions: string[];
	seconds: number;
}

/** Inserts rows 500 at a time on the host and returns their `id` (serial ids as numbers). */
async function insertAll(table: string, rows: Record<string, unknown>[]): Promise<number[]> {
	const ids: number[] = [];

	for (let i = 0; i < rows.length; i += 500) {
		const out = await db(table)
			.insert(rows.slice(i, i + 500))
			.returning('id');
		ids.push(...out.map((row: any) => Number(row.id ?? row)));
	}

	return ids;
}

export async function seed(): Promise<HistorySeed> {
	const started = Date.now();
	const tag = `bench-history-${randomBytes(3).toString('hex')}`;
	const collection = `bench_history_${tag.slice(-6)}`;

	await directus('POST', '/collections', {
		collection,
		schema: {},
		meta: { versioning: true, accountability: 'all' },
		fields: [
			{
				field: 'id',
				type: 'integer',
				meta: { hidden: true },
				schema: { is_primary_key: true, has_auto_increment: true },
			},
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

	const items = await insertAll(
		collection,
		Array.from({ length: ITEMS }, (_, i) => ({ title: `${tag} item ${i}` })),
	);

	const now = new Date();
	const admin = users['admin']!;

	for (let r = 0; r < REVISIONS; r++) {
		const activity = await insertAll(
			'directus_activity',
			items.map((item) => ({
				action: r === 0 ? 'create' : 'update',
				user: admin,
				timestamp: now,
				ip: '127.0.0.1',
				user_agent: 'benchmark',
				origin: 'http://benchmark',
				collection,
				item: String(item),
			})),
		);

		await insertAll(
			'directus_revisions',
			items.map((item, i) => ({
				activity: activity[i],
				collection,
				item: String(item),
				data: JSON.stringify({ id: item, title: `${tag} item ${i} r${r}` }),
				delta: JSON.stringify({ title: `${tag} item ${i} r${r}` }),
			})),
		);
	}

	const versions = items.map(() => randomUUID());

	await insertAll(
		'directus_versions',
		items.map((item, i) => ({
			id: versions[i],
			key: 'draft',
			name: 'Draft',
			collection,
			item: String(item),
			hash: 'benchmark',
			date_created: now,
			user_created: admin,
			delta: JSON.stringify({ title: `${tag} draft ${i}`, _user: admin, _date: now.toISOString() }),
		})),
	);

	return { tag, collection, tokens, items, versions, seconds: Math.round((Date.now() - started) / 1000) };
}

export async function cleanup(seeded: HistorySeed): Promise<void> {
	// Versions, revisions and activity of the collection go first: no foreign key ties them to the collection.
	await db('directus_versions').where({ collection: seeded.collection }).delete();
	await db('directus_activity').where({ collection: seeded.collection }).delete();
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

	await db.destroy();
}
