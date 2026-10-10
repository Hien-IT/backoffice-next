import { useEnv } from '@backoffice/env';
import { createInspector } from '@backoffice/schema';
import type { SchemaOverview } from '@backoffice/types';
import knex, { type Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createDirectusDb } from '../../test/directus-db.js';
import { _cache as busCache, useBus } from '../bus/lib/use-bus.js';
import { _resetCache } from '../cache.js';
import { _cache as lockCache, useLock } from '../lock/lib/use-lock.js';
import { useLogger } from '../logger/index.js';
import { getDatabaseSchema, getSchema } from './get-database-schema.js';

vi.mock('@backoffice/env');
vi.mock('../logger/index.js');

const logger = { warn: vi.fn(), trace: vi.fn() };
let db: Knex;

beforeEach(async () => {
	vi.clearAllMocks();
	vi.mocked(useLogger).mockReturnValue(logger as any);
	vi.mocked(useEnv).mockReturnValue({ DB_EXCLUDE_TABLES: ['spatial_ref_sys'] });
	db = await createDirectusDb();

	await db.schema.createTable('articles', (t) => {
		t.increments('id');
		t.string('title').notNullable().defaultTo('untitled');
		t.decimal('price', 10, 2);
		t.uuid('author').references('id').inTable('directus_users');
	});

	await db.schema.createTable('no_pk', (t) => t.string('a'));
	await db.raw('create table "with space" (id integer primary key)');
	await db.schema.createTable('spatial_ref_sys', (t) => t.increments('id'));

	await db('directus_collections').insert({
		collection: 'articles',
		note: 'Articles',
		singleton: false,
		sort_field: 'title',
		accountability: null,
	});

	await db('directus_fields').insert([
		{
			collection: 'articles',
			field: 'title',
			special: null,
			note: 'The title',
			validation: JSON.stringify({ title: { _nnull: true } }),
			searchable: true,
		},
		{ collection: 'articles', field: 'comments', special: 'o2m', note: null, validation: null, searchable: false },
		{ collection: 'articles', field: 'divider', special: 'alias,no-data', note: null },
		{ collection: 'articles', field: 'ghost', special: null },
		{ collection: 'missing', field: 'x', special: null },
	]);

	await db('directus_relations').insert({
		many_collection: 'articles',
		many_field: 'author',
		one_collection: 'directus_users',
		one_allowed_collections: 'a,b',
	});
});

afterEach(() => db.destroy());

describe('getDatabaseSchema (SQLite, real queries)', () => {
	test('collections: user and system tables, metadata, excluded/no-pk/space tables skipped', async () => {
		const schema = await getDatabaseSchema(db, createInspector(db));
		expect(Object.keys(schema.collections)).toContain('articles');
		expect(Object.keys(schema.collections)).toContain('directus_settings');
		expect(schema.collections).not.toHaveProperty('no_pk');
		expect(schema.collections).not.toHaveProperty('with space');
		expect(schema.collections).not.toHaveProperty('spatial_ref_sys');
		expect(logger.warn).toHaveBeenCalledWith(
			`Collection "no_pk" doesn't have a primary key column and will be ignored`,
		);
		expect(logger.warn).toHaveBeenCalledWith(`Collection "with space" has a space in the name and will be ignored`);
		expect(logger.trace).toHaveBeenCalledWith(
			`Collection "spatial_ref_sys" is configured to be excluded and will be ignored`,
		);

		expect(schema.collections['articles']).toMatchObject({
			primary: 'id',
			singleton: false,
			note: 'Articles',
			sortField: 'title',
			accountability: null,
		});
		expect(schema.collections['directus_settings']).toMatchObject({ singleton: true });
	});

	test('fields: columns, directus_fields metadata, alias fields; no-data and unknown fields skipped', async () => {
		const { fields } = (await getDatabaseSchema(db, createInspector(db))).collections['articles']!;

		expect(fields['title']).toMatchObject({
			type: 'string',
			defaultValue: 'untitled',
			nullable: false,
			note: 'The title',
			validation: { title: { _nnull: true } },
			alias: false,
		});
		// knex creates decimal columns as `float` on SQLite.
		expect(fields['price']).toMatchObject({ type: 'float', dbType: 'float' });
		expect(fields['comments']).toMatchObject({ type: 'alias', alias: true, special: ['o2m'], searchable: false });
		expect(fields).not.toHaveProperty('divider');
		expect(fields).not.toHaveProperty('ghost');
	});

	test('relations: directus_relations (cast-csv) stitched with foreign keys, plus system relations', async () => {
		const { relations } = await getDatabaseSchema(db, createInspector(db));
		const author = relations.find((r) => r.collection === 'articles' && r.field === 'author')!;
		expect(author.related_collection).toBe('directus_users');
		expect(author.schema).toMatchObject({ table: 'articles', column: 'author', foreign_key_table: 'directus_users' });
		expect(author.meta).toMatchObject({ one_allowed_collections: ['a', 'b'] });
		expect(relations.some((r) => r.collection === 'directus_users' && r.field === 'role')).toBe(true);
	});
});

// getSchema with the in-memory cache, lock and bus (contracts/redis.md §2). No Redis in the env: the lock and the
// bus are the local ones of @backoffice/memory, which follow the same protocol in one process.
describe('getSchema (cache, lock, bus)', () => {
	const LOCK = 'schemaCache--preparing';
	const DONE = 'schemaCache--done';
	let queries: number;
	let messages: { schema: SchemaOverview | null }[];

	const env = (extra: Record<string, unknown> = {}) =>
		vi.mocked(useEnv).mockReturnValue({
			DB_EXCLUDE_TABLES: ['spatial_ref_sys'],
			CACHE_SCHEMA: true,
			CACHE_SCHEMA_MAX_ITERATIONS: 100,
			CACHE_SCHEMA_SYNC_TIMEOUT: 30,
			...extra,
		});

	/** Lets getSchema reach its subscription, then publishes on the bus like another process would. */
	const publishLater = async (payload: { schema: SchemaOverview | null }) => {
		await new Promise((r) => setTimeout(r, 5));
		await useBus().publish(DONE, payload);
	};

	beforeEach(async () => {
		_resetCache();
		busCache.bus = undefined;
		lockCache.lock = undefined;
		env();
		queries = 0;
		messages = [];
		db.on('query', () => queries++);
		await useBus().subscribe(DONE, (m: { schema: SchemaOverview | null }) => messages.push(m));
	});

	test('process with turn 1 builds the schema, publishes it and deletes the lock', async () => {
		const schema = await getSchema({ database: db });
		expect(Object.keys(schema.collections)).toContain('articles');
		expect(messages).toHaveLength(1);
		expect(messages[0]!.schema).toBe(schema);
		expect(await useLock().has(LOCK)).toBe(false);
	});

	test('the next call uses the in-memory schema without a query', async () => {
		await getSchema({ database: db });
		const before = queries;
		const again = await getSchema({ database: db });
		expect(queries).toBe(before);
		expect(Object.keys(again.collections)).toContain('articles');
		expect(messages).toHaveLength(1);
	});

	test('CACHE_SCHEMA=false builds on every call and never touches the lock or the bus', async () => {
		env({ CACHE_SCHEMA: false });
		const increment = vi.spyOn(useLock(), 'increment');
		await getSchema({ database: db });
		const first = queries;
		await getSchema({ database: db });
		expect(queries).toBe(first * 2);
		expect(increment).not.toHaveBeenCalled();
		expect(messages).toHaveLength(0);
	});

	test('bypassCache builds even when a schema is cached', async () => {
		await getSchema({ database: db });
		const before = queries;
		await getSchema({ database: db, bypassCache: true });
		expect(queries).toBeGreaterThan(before);
	});

	test('turn 2 waits for schemaCache--done and uses the schema another process built', async () => {
		const other = { collections: {}, relations: [] } as SchemaOverview;
		await useLock().increment(LOCK);
		const [schema] = await Promise.all([getSchema({ database: db }), publishLater({ schema: other })]);
		expect(schema).toEqual(other);
		expect(queries).toBe(0);
		expect(logger.trace).toHaveBeenCalledWith('Schema cache is prepared in another process, waiting for result.');
	});

	test('{schema: null} makes the waiting process retry and build the schema itself', async () => {
		await useLock().increment(LOCK);

		const pending = getSchema({ database: db });
		await new Promise((r) => setTimeout(r, 5));
		await useLock().delete(LOCK);
		await useBus().publish(DONE, { schema: null });

		expect(Object.keys((await pending).collections)).toContain('articles');
	});

	test('no message within CACHE_SCHEMA_SYNC_TIMEOUT: retries, then fails after 3 attempts', async () => {
		await useLock().increment(LOCK);
		await expect(getSchema({ database: db })).rejects.toThrow('Failed to get Schema information: hit infinite loop');
		expect(await useLock().get(LOCK)).toBe(4);
	});

	test('turn >= CACHE_SCHEMA_MAX_ITERATIONS deletes the lock, so the retry builds the schema', async () => {
		env({ CACHE_SCHEMA_MAX_ITERATIONS: 2 });
		await useLock().increment(LOCK);
		const schema = await getSchema({ database: db });
		expect(Object.keys(schema.collections)).toContain('articles');
	});

	test('a failed build still publishes {schema: null} and deletes the lock', async () => {
		const broken = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
		await broken.destroy();
		await expect(getSchema({ database: broken })).rejects.toThrow();
		expect(messages).toEqual([{ schema: null }]);
		expect(await useLock().has(LOCK)).toBe(false);
	});
});
