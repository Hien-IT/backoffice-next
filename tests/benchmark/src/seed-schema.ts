// Seed of the data model benchmark (feature 006, FR-065, SC-007, research R10), through the Directus API: COLLECTIONS
// collections of FIELDS fields each (every common type, with metadata), each but the first with a many-to-one field to
// the previous one, an o2m alias on every other target (60 collections, about 930 fields, 59 relation rows by default:
// the snapshot stays under the default MAX_PAYLOAD_SIZE of 1 MB, which POST /schema/diff needs; 200 collections gave a
// 2.5 MB snapshot, 400 at both apps); a user who reads READABLE collections with part of their fields, and an admin user,
// both with a static token.
import { randomBytes } from 'node:crypto';
import { db, directus } from './seed-permissions.ts';

const COLLECTIONS = Number(process.env['BENCH_SCHEMA_COLLECTIONS'] ?? 60);
const READABLE = Math.min(COLLECTIONS, Number(process.env['BENCH_SCHEMA_READABLE'] ?? 50));
const TYPES = [
	'string',
	'text',
	'integer',
	'bigInteger',
	'float',
	'decimal',
	'boolean',
	'date',
	'dateTime',
	'timestamp',
	'json',
	'uuid',
	'csv',
];

export const PREFIX = 'bench_schema_';
export const collectionName = (i: number) => `${PREFIX}${String(i).padStart(3, '0')}`;

export interface SchemaSeed {
	tag: string;
	tokens: { admin: string; user: string };
	/** The snapshot of the seeded model, the body of the POST /schema/diff scenario (answers 204). */
	snapshot: unknown;
	counts: { collections: number; fields: number; relations: number };
	seconds: number;
}

const id = {
	field: 'id',
	type: 'integer',
	meta: { hidden: true },
	schema: { is_primary_key: true, has_auto_increment: true },
};

export async function dropCollections(): Promise<void> {
	const rows = await db('directus_collections').select('collection').where('collection', 'like', `${PREFIX}%`);
	// Last created first: each collection has a foreign key to the one before it.
	for (const { collection } of rows.sort((a, b) => b.collection.localeCompare(a.collection))) {
		await directus('DELETE', `/collections/${collection}`).catch(() => undefined);
	}
}

export async function seed(): Promise<SchemaSeed> {
	const started = Date.now();
	const tag = `bench-schema-${randomBytes(3).toString('hex')}`;
	await dropCollections();

	for (let i = 0; i < COLLECTIONS; i++) {
		await directus('POST', '/collections', {
			collection: collectionName(i),
			schema: {},
			meta: { note: `benchmark ${i}` },
			fields: [id, ...TYPES.map((type) => ({ field: `f_${type.toLowerCase()}`, type, meta: { interface: 'input' } }))],
		});

		if (i === 0) continue;

		await directus('POST', `/fields/${collectionName(i)}`, {
			field: 'parent',
			type: 'integer',
			meta: { special: ['m2o'] },
		});
		const reverse = i % 2 === 0;
		if (reverse)
			await directus('POST', `/fields/${collectionName(i - 1)}`, {
				field: 'children',
				type: 'alias',
				meta: { special: ['o2m'] },
			});

		await directus('POST', '/relations', {
			collection: collectionName(i),
			field: 'parent',
			related_collection: collectionName(i - 1),
			meta: reverse ? { one_field: 'children' } : {},
			schema: { on_delete: 'SET NULL' },
		});
	}

	const policy = async (name: string, body: Record<string, unknown>) =>
		(await directus('POST', '/policies', { name: `${tag}-${name}`, icon: 'badge', ...body })).data.id as string;

	const admin = await policy('admin', { admin_access: true, app_access: true });
	const reader = await policy('user', {
		app_access: true,
		permissions: Array.from({ length: READABLE }, (_, i) => ({
			collection: collectionName(i),
			action: 'read',
			fields: ['id', 'f_string', 'f_integer', 'parent'],
			permissions: {},
		})),
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

	const count = async (table: string, column: string) =>
		Number((await db(table).where(column, 'like', `${PREFIX}%`).count({ n: '*' }).first())?.['n']);

	return {
		tag,
		tokens,
		snapshot: (await directus('GET', '/schema/snapshot')).data,
		counts: {
			collections: await count('directus_collections', 'collection'),
			fields: await count('directus_fields', 'collection'),
			relations: await count('directus_relations', 'many_collection'),
		},
		seconds: Math.round((Date.now() - started) / 1000),
	};
}

export async function cleanup(seeded: SchemaSeed): Promise<void> {
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
