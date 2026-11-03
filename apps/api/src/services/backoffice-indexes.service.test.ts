// Backoffice (spec 030, D-210, contracts/api.md): BackofficeIndexesService on real SQLite tables (the base helper
// creates the index for real); vendor-specific branches are driven through getDatabaseClient.
import { createInspector } from '@backoffice/schema';
import type { Accountability, SchemaOverview } from '@backoffice/types';
import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAuthDb } from '../../test/directus-db.js';
import { up } from '../database/backoffice-migrations/20261103A-create-backoffice-indexes.js';
import { createDefaultAccountability } from '../permissions/utils/create-default-accountability.js';
import { getDatabaseSchema } from '../schema/get-database-schema.js';
import { running } from './backoffice-indexes/jobs.js';
import { BackofficeIndexesService, TABLE } from './backoffice-indexes.service.js';

const state = vi.hoisted(() => ({ client: 'sqlite' as string, building: false }));

const localSchemaCache = new Map<string, unknown>();

vi.mock('../cache.js', () => ({
	getCache: () => ({
		cache: { clear: vi.fn() },
		localSchemaCache: { get: async (k: string) => localSchemaCache.get(k), set: async (k: string, v: unknown) => void localSchemaCache.set(k, v) },
	}),
	clearSystemCache: vi.fn(),
	getCacheValue: vi.fn(),
	setCacheValue: vi.fn(),
}));

vi.mock('../logger/index.js', () => ({
	useLogger: () => ({ warn: vi.fn(), trace: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

vi.mock('@backoffice/env', () => ({
	useEnv: () => ({
		MAX_BATCH_MUTATION: Infinity,
		CACHE_AUTO_PURGE: true,
		CACHE_AUTO_PURGE_IGNORE_LIST: ['directus_activity', 'directus_presets'],
	}),
}));

vi.mock('../database/index.js', async (importOriginal) => {
	const original = await importOriginal<typeof import('../database/index.js')>();
	const getDatabase = () => db;
	return { ...original, default: getDatabase, getDatabase, getDatabaseClient: () => state.client };
});

// The catalog of SQLite is real (PRAGMA); isBuilding is Postgres only and driven by state.
vi.mock('./backoffice-indexes/catalog.js', async (importOriginal) => {
	const original = await importOriginal<typeof import('./backoffice-indexes/catalog.js')>();
	return {
		...original,
		isBuilding: async () => state.building,
		listIndexNames: (knex: Knex, table: string) =>
			state.client === 'sqlite' ? original.listIndexNames(knex, table) : Promise.resolve(null),
	};
});

let db: Knex;
let schema: SchemaOverview;

const USER = 'd0000000-0000-4000-8000-000000000001';
const admin: Accountability = { ...createDefaultAccountability(), admin: true, app: true, user: USER };
const editor: Accountability = { ...createDefaultAccountability(), app: true, user: USER };

const service = (accountability: Accountability | null = admin) =>
	new BackofficeIndexesService({ knex: db, schema, accountability });

/** Waits for the background job of the last create. */
const settled = async () => {
	await Promise.all([...running]);
};

beforeEach(async () => {
	state.client = 'sqlite';
	state.building = false;
	db = await createAuthDb();
	await up(db);
	await db.schema.createTable('articles', (t) => {
		t.increments('id');
		t.string('provider', 64);
		t.string('provider_subject', 64);
		t.string('name', 255);
		t.text('note');
		t.json('payload');
	});
	await db('directus_collections').insert({ collection: 'articles' });
	await db('directus_fields').insert([
		{ collection: 'articles', field: 'tags', special: 'o2m' },
		{ collection: 'articles', field: 'payload', special: 'cast-json' },
	]);
	await db('directus_users').insert({ id: USER, email: 'admin@example.com' });
	schema = await getDatabaseSchema(db, createInspector(db));
});

afterEach(async () => {
	await settled();
	await db.destroy();
	vi.clearAllMocks();
});

const sqliteIndexes = async (table = 'articles') =>
	(await db.raw(`select name from sqlite_master where type = 'index' and tbl_name = '${table}'`)).map(
		(r: { name: string }) => r.name,
	);

describe('validate (research R6)', () => {
	test('403 for system collections, unknown collections and non-admins', async () => {
		await expect(service().create('directus_users', { fields: ['email'] })).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(service().create('backoffice_permissions', { fields: ['policy'] })).rejects.toMatchObject({
			code: 'FORBIDDEN',
		});
		await expect(service().create('nope', { fields: ['a'] })).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(service(editor).create('articles', { fields: ['name'] })).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(service(editor).list('articles')).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(service(null).list('articles')).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	test.each([
		[{ fields: [] }, /field/i],
		[{ fields: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] }, /8/],
		[{ fields: ['name', 'name'] }, /twice|duplicate/i],
		[{ fields: ['tags'] }, /tags/],
		[{ fields: ['nope'] }, /nope/],
		[{ fields: ['payload'] }, /payload/],
		[{ fields: ['id'] }, /primary/i],
		[{ fields: ['name'], type: 'hash' }, /type/i],
		[{ fields: ['name', 'note'], type: 'trigram' }, /one field/i],
		[{ fields: ['provider'], type: 'trigram', unique: true }, /unique/i],
	])('400 for %j', async (body, message) => {
		await expect(service().create('articles', body as never)).rejects.toMatchObject({
			code: 'INVALID_PAYLOAD',
			message: expect.stringMatching(message),
		});
	});

	test('text goes into a btree on Postgres and SQLite, not on MySQL; trigram needs Postgres (FR-001a, FR-002)', async () => {
		state.client = 'mysql';
		await expect(service().create('articles', { fields: ['note'] })).rejects.toMatchObject({
			code: 'INVALID_PAYLOAD',
			message: expect.stringMatching(/note.*text.*MySQL/i),
		});
		await expect(service().create('articles', { fields: ['name'], type: 'trigram' })).rejects.toMatchObject({
			code: 'INVALID_PAYLOAD',
			message: expect.stringMatching(/PostgreSQL/),
		});
		state.client = 'sqlite';
		await expect(service().create('articles', { fields: ['name'], type: 'trigram' })).rejects.toMatchObject({
			message: expect.stringMatching(/PostgreSQL/),
		});
		await expect(service().create('articles', { fields: ['note'] })).resolves.toMatchObject({ status: 'creating' });
	});
});

describe('create and list (US1)', () => {
	test('inserts a creating row, answers it, and the job builds the index and sets ready', async () => {
		const row = await service().create('articles', { fields: ['provider', 'provider_subject'], unique: true });

		expect(row).toMatchObject({
			collection: 'articles',
			name: 'articles_provider_provider_subject_unique',
			fields: ['provider', 'provider_subject'],
			type: 'btree',
			unique: true,
			status: 'creating',
			error: null,
			missing: null,
		});
		expect(row.id).toMatch(/^[0-9a-f-]{36}$/);

		await settled();

		expect(await sqliteIndexes()).toContain('articles_provider_provider_subject_unique');
		const { data, meta } = await service().list('articles');
		expect(data).toHaveLength(1);
		expect(data[0]).toMatchObject({ status: 'ready', error: null, missing: false, unique: true });
		expect(meta).toEqual({ trigram: false, concurrent: false });

		const activity = await db('directus_activity').where({ collection: TABLE }).orderBy('id');
		expect(activity.map((a) => a.action)).toEqual(['create', 'update']);
		expect(activity.every((a) => a.user === USER)).toBe(true);
	});

	test('a duplicate definition and a name already on the database are 400', async () => {
		await service().create('articles', { fields: ['provider', 'provider_subject'], unique: true });
		await settled();
		await expect(
			service().create('articles', { fields: ['provider', 'provider_subject'], unique: true }),
		).rejects.toMatchObject({ code: 'INVALID_PAYLOAD', message: expect.stringMatching(/already exists/) });
		// Same fields, not unique: another index.
		await expect(service().create('articles', { fields: ['provider', 'provider_subject'] })).resolves.toMatchObject({
			name: 'articles_provider_provider_subject_index',
		});
		await settled();

		await db.raw('CREATE INDEX articles_name_index ON articles (name)');
		await expect(service().create('articles', { fields: ['name'] })).rejects.toMatchObject({
			code: 'INVALID_PAYLOAD',
			message: expect.stringMatching(/already in use/),
		});
	});

	test('a row another replica inserted first (unique name) is 400, not 500', async () => {
		await db(TABLE).insert({
			id: '3f6c1b2a-9d4e-4c8b-8a1f-2b3c4d5e6f70',
			collection: 'articles',
			name: 'articles_name_index',
			fields: JSON.stringify(['name']),
			type: 'btree',
			unique: false,
			status: 'creating',
		});
		await expect(service().create('articles', { fields: ['name'] })).rejects.toMatchObject({
			code: 'INVALID_PAYLOAD',
			message: expect.stringMatching(/already exists/),
		});
	});

	test('meta reports trigram and concurrent per vendor', async () => {
		state.client = 'postgres';
		expect((await service().list('articles')).meta).toEqual({ trigram: true, concurrent: true });
		state.client = 'mysql';
		expect((await service().list('articles')).meta).toEqual({ trigram: false, concurrent: true });
	});
});

describe('job failures, missing and stale rows (US3, US4)', () => {
	test('a failing build sets failed with the error and keeps the row', async () => {
		await db('articles').insert([
			{ provider: 'p', provider_subject: 's' },
			{ provider: 'p', provider_subject: 's' },
		]);
		await service().create('articles', { fields: ['provider', 'provider_subject'], unique: true });
		await settled();

		const { data } = await service().list('articles');
		expect(data[0]).toMatchObject({ status: 'failed', error: expect.stringMatching(/unique|UNIQUE/i) });
		expect(await sqliteIndexes()).not.toContain('articles_provider_provider_subject_unique');
	});

	test('ready rows whose index is gone are missing; creating rows older than an hour read as failed', async () => {
		await service().create('articles', { fields: ['name'] });
		await settled();
		await db.raw('DROP INDEX articles_name_index');
		expect((await service().list('articles')).data[0]).toMatchObject({ status: 'ready', missing: true });

		// DR drops one column of a composite index: SQLite (Knex) keeps the name on the remaining column (D-210.3).
		await service().create('articles', { fields: ['provider', 'provider_subject'], unique: true });
		await settled();
		await db.schema.alterTable('articles', (t) => t.dropColumn('provider_subject'));
		expect(await sqliteIndexes()).toContain('articles_provider_provider_subject_unique');
		schema = await getDatabaseSchema(db, createInspector(db));
		expect(
			(await service().list('articles')).data.find((r) => r.name === 'articles_provider_provider_subject_unique'),
		).toMatchObject({ status: 'ready', missing: true });
		await db.schema.alterTable('articles', (t) => t.string('provider_subject', 64));
		schema = await getDatabaseSchema(db, createInspector(db));

		// As the DB default writes it on SQLite: a UTC string without zone.
		const old = new Date(Date.now() - 2 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
		await db(TABLE).insert({
			id: '3f6c1b2a-9d4e-4c8b-8a1f-2b3c4d5e6f71',
			collection: 'articles',
			name: 'articles_note_index',
			fields: JSON.stringify(['note']),
			type: 'btree',
			unique: false,
			status: 'creating',
			date_created: old,
		});
		await db(TABLE).insert({
			id: '3f6c1b2a-9d4e-4c8b-8a1f-2b3c4d5e6f72',
			collection: 'articles',
			name: 'articles_provider_index',
			fields: JSON.stringify(['provider']),
			type: 'btree',
			unique: false,
			status: 'creating',
		});

		const { data } = await service().list('articles');
		const byName = Object.fromEntries(data.map((r) => [r.name, r]));
		expect(byName['articles_note_index']).toMatchObject({ status: 'failed', error: expect.stringMatching(/stopped/) });
		expect(byName['articles_provider_index']).toMatchObject({ status: 'creating' });
		expect(await db(TABLE).where({ name: 'articles_note_index' }).first()).toMatchObject({ status: 'creating' });

		// Postgres: a build still running keeps it creating (analyze U1).
		state.building = true;
		expect(
			(await service().list('articles')).data.find((r) => r.name === 'articles_note_index'),
		).toMatchObject({ status: 'creating' });
	});

	test('remove drops the index and the row; a creating row is refused; a missing row is just deleted', async () => {
		await service().create('articles', { fields: ['name'] });
		await settled();
		await service().remove('articles', 'articles_name_index');
		expect(await sqliteIndexes()).not.toContain('articles_name_index');
		expect(await db(TABLE)).toEqual([]);
		expect((await db('directus_activity').where({ collection: TABLE }).orderBy('id')).map((a) => a.action)).toEqual([
			'create',
			'update',
			'delete',
		]);

		await expect(service().remove('articles', 'articles_name_index')).rejects.toMatchObject({ code: 'FORBIDDEN' });

		await service().create('articles', { fields: ['note'] });
		await settled();
		await db.raw('DROP INDEX articles_note_index');
		await service().remove('articles', 'articles_note_index');
		expect(await db(TABLE)).toEqual([]);

		await db(TABLE).insert({
			id: '3f6c1b2a-9d4e-4c8b-8a1f-2b3c4d5e6f73',
			collection: 'articles',
			name: 'articles_provider_index',
			fields: JSON.stringify(['provider']),
			type: 'btree',
			unique: false,
			status: 'creating',
		});
		await expect(service().remove('articles', 'articles_provider_index')).rejects.toMatchObject({
			code: 'INVALID_PAYLOAD',
			message: expect.stringMatching(/still being created/),
		});
	});

	test('dropForField drops every index with the field before the column goes; deleteForCollection removes rows', async () => {
		await service().create('articles', { fields: ['provider', 'provider_subject'], unique: true });
		await settled();
		await service().create('articles', { fields: ['name'] });
		await settled();

		await service().dropForField('articles', 'provider');
		expect(await sqliteIndexes()).not.toContain('articles_provider_provider_subject_unique');
		expect(await sqliteIndexes()).toContain('articles_name_index');
		expect((await db(TABLE)).map((r) => r.name)).toEqual(['articles_name_index']);

		await db(TABLE).insert({
			id: '3f6c1b2a-9d4e-4c8b-8a1f-2b3c4d5e6f74',
			collection: 'articles',
			name: 'articles_note_index',
			fields: JSON.stringify(['note']),
			type: 'btree',
			unique: false,
			status: 'creating',
		});
		await expect(service().dropForField('articles', 'note')).rejects.toMatchObject({ code: 'INVALID_PAYLOAD' });
		await expect(service().deleteForCollection('articles')).rejects.toMatchObject({ code: 'INVALID_PAYLOAD' });
		await db(TABLE).where({ name: 'articles_note_index' }).delete();

		await service().deleteForCollection('articles');
		expect(await db(TABLE)).toEqual([]);
	});
});
