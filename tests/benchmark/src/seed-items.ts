// Seed of the items benchmark (feature 005, FR-048, SC-006, research R11), Postgres only. Through the Directus API:
// bench_categories (100 rows) and bench_articles (title, indexed status, body, indexed m2o category, indexed date_created,
// json payload {Amount, Currency} of spec 023) with the o2m alias categories.articles, a user with a read policy
// filtered on status = published (part of the fields) and create, update and delete on its rows, and an admin user,
// both with a static token. With knex on the host:
// BENCH_ITEMS_ROWS rows (10 million by default) in one INSERT ... SELECT FROM generate_series, then BENCH_DELETE_ROWS
// published rows (200,000) kept for DELETE, half for each app.
import { randomBytes } from 'node:crypto';
import { db, directus } from './seed-permissions.ts';

export const CATEGORIES = 'bench_categories';
export const ARTICLES = 'bench_articles';
const ROWS = Number(process.env['BENCH_ITEMS_ROWS'] ?? 10_000_000);
const DELETE_ROWS = Number(process.env['BENCH_DELETE_ROWS'] ?? 200_000);

export interface ItemsSeed {
	tag: string;
	tokens: { admin: string; user: string };
	/** Published rows for GET and PATCH by id. */
	pool: number[];
	/** Rows each app deletes, in order. */
	deletable: { directus: number[]; backoffice: number[] };
	seconds: number;
	bytes: number;
}

const id = {
	field: 'id',
	type: 'integer',
	meta: { hidden: true },
	schema: { is_primary_key: true, has_auto_increment: true },
};

async function dropCollections() {
	for (const collection of [ARTICLES, CATEGORIES]) {
		await directus('DELETE', `/collections/${collection}`).catch(() => undefined);
	}
}

export async function seed(): Promise<ItemsSeed> {
	const started = Date.now();
	const tag = `bench-items-${randomBytes(3).toString('hex')}`;
	await dropCollections();

	await directus('POST', '/collections', {
		collection: CATEGORIES,
		schema: {},
		meta: {},
		fields: [id, { field: 'name', type: 'string' }],
	});

	await directus('POST', '/collections', {
		collection: ARTICLES,
		schema: {},
		meta: {},
		fields: [
			id,
			{ field: 'title', type: 'string' },
			{ field: 'status', type: 'string', schema: { is_indexed: true } },
			{ field: 'body', type: 'text' },
			{ field: 'category', type: 'integer', schema: { is_indexed: true }, meta: { special: ['m2o'] } },
			// Indexed: the list sorts on it; without the index each fresh read sorts 5 million rows (first CI run).
			{ field: 'date_created', type: 'timestamp', schema: { is_indexed: true }, meta: { special: ['date-created'] } },
			// Spec 023 (T053): the json path filter scenario (Backoffice only).
			{ field: 'payload', type: 'json', meta: { special: ['cast-json'] } },
		],
	});

	await directus('POST', `/fields/${CATEGORIES}`, { field: 'articles', type: 'alias', meta: { special: ['o2m'] } });
	await directus('POST', '/relations', {
		collection: ARTICLES,
		field: 'category',
		related_collection: CATEGORIES,
		meta: { one_field: 'articles' },
		schema: { on_delete: 'SET NULL' },
	});

	await db(CATEGORIES).insert(Array.from({ length: 100 }, (_, i) => ({ name: `category ${i + 1}` })));

	await db.raw(
		`INSERT INTO ${ARTICLES} (title, status, body, category, date_created, payload)
		 SELECT 'article ' || g, CASE WHEN g % 2 = 0 THEN 'published' ELSE 'draft' END, 'lorem ipsum dolor sit amet ' || g,
		        (g % 100) + 1, now() - make_interval(secs => g), json_build_object('Amount', g % 10000, 'Currency', 'VND')
		 FROM generate_series(1, ?) AS g`,
		[ROWS],
	);

	await db.raw(
		`INSERT INTO ${ARTICLES} (title, status, body, category, date_created)
		 SELECT 'delete ' || g, 'published', 'to delete', (g % 100) + 1, now() FROM generate_series(1, ?) AS g`,
		[DELETE_ROWS],
	);

	await db.raw(`ANALYZE ${ARTICLES}`);

	const deletable = (await db(ARTICLES).select('id').where('title', 'like', 'delete %').orderBy('id')).map(
		(r) => r.id as number,
	);
	const pool = (
		await db(ARTICLES).select('id').where({ status: 'published' }).whereNot('title', 'like', 'delete %').limit(1000)
	).map((r) => r.id as number);

	const policy = async (name: string, body: Record<string, unknown>) =>
		(await directus('POST', '/policies', { name: `${tag}-${name}`, icon: 'badge', ...body })).data.id as string;

	const admin = await policy('admin', { admin_access: true, app_access: true });
	const published = { status: { _eq: 'published' } };
	const reader = await policy('user', {
		permissions: [
			{
				collection: ARTICLES,
				action: 'read',
				fields: ['id', 'title', 'status', 'category', 'date_created', 'payload'],
				permissions: published,
			},
			{ collection: ARTICLES, action: 'create', fields: ['*'], permissions: {} },
			{ collection: ARTICLES, action: 'update', fields: ['title'], permissions: published },
			{ collection: ARTICLES, action: 'delete', fields: ['*'], permissions: published },
			{ collection: CATEGORIES, action: 'read', fields: ['id', 'name'], permissions: {} },
		],
	});

	const tokens = { admin: `${tag}-admin`, user: `${tag}-user` };

	for (const [name, token, policyId] of [
		['admin', tokens.admin, admin],
		['user', tokens.user, reader],
	] as const) {
		const user = (await directus('POST', '/users', { email: `${tag}-${name}@example.com`, token, status: 'active' }))
			.data.id;
		await directus('POST', '/access', { user, policy: policyId });
	}

	const size = await db.raw(`SELECT pg_total_relation_size('${ARTICLES}') AS bytes`);
	const half = Math.floor(deletable.length / 2);

	return {
		tag,
		tokens,
		pool,
		deletable: { directus: deletable.slice(0, half), backoffice: deletable.slice(half) },
		seconds: Math.round((Date.now() - started) / 1000),
		bytes: Number(size.rows[0].bytes),
	};
}

export async function cleanup(seeded: ItemsSeed): Promise<void> {
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

	await dropCollections();
	await db.destroy();
}
