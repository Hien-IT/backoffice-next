// Tests of the ItemsService subset of feature 003 (research R5), on SQLite with directus_* like tables.
import { SchemaBuilder } from '@backoffice/schema-builder';
import type { Accountability, SchemaOverview } from '@backoffice/types';
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { createDefaultAccountability } from '../permissions/utils/create-default-accountability.js';
import { ItemsService } from './items.service.js';
import { RevisionsService } from './revisions.service.js';

vi.mock('../cache.js', () => ({ getCache: () => ({ cache: null }) }));

// translateDatabaseError asks the client of the default connection, like Directus.
vi.mock('../database/index.js', async (importOriginal) => {
	const original = await importOriginal<typeof import('../database/index.js')>();
	return { ...original, getDatabaseClient: (database?: Knex) => (database ? original.getDatabaseClient(database) : 'sqlite') };
});

vi.mock('@backoffice/env', () => ({
	useEnv: () => ({ MAX_BATCH_MUTATION: Infinity, CACHE_AUTO_PURGE: false, USERS_ADMIN_ACCESS_LIMIT: Infinity }),
}));

let db: Knex;
let schema: SchemaOverview;

const admin: Accountability = {
	...createDefaultAccountability({ ip: '10.0.0.1' }),
	userAgent: 'test-agent',
	origin: 'http://example.com',
	admin: true,
};

beforeAll(async () => {
	db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });

	await db.schema.createTable('directus_roles', (t) => t.uuid('id').primary());

	await db.schema.createTable('directus_users', (t) => {
		t.uuid('id').primary();
		t.string('email').unique();
		t.string('password');
		t.string('status').defaultTo('active');
		t.uuid('role').references('id').inTable('directus_roles');
		t.boolean('email_notifications').defaultTo(true);
		t.json('auth_data');
		t.timestamp('last_access');
	});

	await db.schema.createTable('directus_activity', (t) => {
		t.increments('id');
		t.string('action');
		t.uuid('user');
		t.timestamp('timestamp');
		t.string('ip');
		t.string('user_agent');
		t.string('collection');
		t.string('item');
		t.string('origin');
	});

	await db.schema.createTable('directus_revisions', (t) => {
		t.increments('id');
		t.integer('activity');
		t.string('collection');
		t.string('item');
		t.json('data');
		t.json('delta');
		t.integer('parent');
	});

	await db.schema.createTable('directus_settings', (t) => {
		t.increments('id');
		t.integer('auth_login_attempts').defaultTo(25);
	});

	schema = new SchemaBuilder()
		.collection('directus_roles', (c) => c.field('id').uuid().primary())
		.collection('directus_users', (c) => {
			c.field('id').uuid().primary();
			c.field('email').string();
			c.field('password').hash().options({ special: ['hash', 'conceal'] });
			c.field('status').string().options({ defaultValue: 'active' });
			c.field('role').m2o('directus_roles');
			c.field('email_notifications').boolean().options({ special: ['cast-boolean'] });
			c.field('auth_data').json().options({ special: ['cast-json'] });
			c.field('last_access').timestamp();
		})
		.collection('directus_activity', (c) => {
			c.field('id').id();
			c.field('action').string();
			c.field('user').uuid().options({ special: [] });
			c.field('timestamp').timestamp().options({ special: ['date-created'] });
			c.field('ip').string();
			c.field('user_agent').string();
			c.field('collection').string();
			c.field('item').string();
			c.field('origin').string();
		})
		.collection('directus_revisions', (c) => {
			c.field('id').id();
			c.field('activity').integer();
			c.field('collection').string();
			c.field('item').string();
			c.field('data').json().options({ special: ['cast-json'] });
			c.field('delta').json().options({ special: ['cast-json'] });
			c.field('parent').integer();
		})
		.collection('directus_settings', (c) => {
			c.field('id').id();
			c.field('auth_login_attempts').integer().options({ defaultValue: 25 });
		})
		.build();

	schema.collections['directus_activity']!.accountability = null;
	schema.collections['directus_revisions']!.accountability = null;
});

beforeEach(async () => {
	for (const table of ['directus_revisions', 'directus_activity', 'directus_users', 'directus_settings']) {
		await db(table).delete();
	}
});

afterAll(() => db.destroy());

const users = (accountability: Accountability | null = null) =>
	new ItemsService('directus_users', { knex: db, schema, accountability });

describe('createOne', () => {
	test('generates the uuid, writes the row and no activity without accountability', async () => {
		const id = await users().createOne({ email: 'a@example.com' });

		expect(id).toMatch(/^[0-9a-f-]{36}$/);
		expect(await db('directus_users').where({ id }).first()).toMatchObject({ email: 'a@example.com', status: 'active' });
		expect(await db('directus_activity').count({ n: '*' }).first()).toEqual({ n: 0 });
	});

	test('with accountability: activity `create` and a revision with the prepared payload', async () => {
		const id = await users(admin).createOne({ email: 'b@example.com', password: 'secret', role: null });
		const activity = await db('directus_activity').first();
		const revision = await db('directus_revisions').first();

		expect(activity).toMatchObject({
			action: 'create',
			user: null,
			ip: '10.0.0.1',
			user_agent: 'test-agent',
			origin: 'http://example.com',
			collection: 'directus_users',
			item: id,
		});

		expect(activity.timestamp).not.toBeNull();
		expect(revision).toMatchObject({ activity: activity.id, collection: 'directus_users', item: id });
		// Relational fields are left out, concealed fields are masked (prepareDelta of Directus).
		expect(JSON.parse(revision.data)).toEqual({ email: 'b@example.com', password: '**********' });
		expect(revision.delta).toBe(revision.data);
	});

	test('translates unique violations and throws the pre-mutation error', async () => {
		await users().createOne({ email: 'dup@example.com' });

		await expect(users().createOne({ email: 'dup@example.com' })).rejects.toMatchObject({
			code: 'RECORD_NOT_UNIQUE',
		});

		await expect(users().createOne({ email: 'x@example.com' }, { preMutationError: new Error('policy') as never })).rejects.toThrow(
			'policy',
		);
	});

	test('createMany returns the keys in order', async () => {
		const keys = await users().createMany([{ email: 'c1@example.com' }, { email: 'c2@example.com' }]);
		expect(keys).toHaveLength(2);
		expect((await db('directus_users').whereIn('id', keys)).map((u) => u.email).sort()).toEqual([
			'c1@example.com',
			'c2@example.com',
		]);
	});

	test('integer keys come from returning or max(id) (RevisionsService defaults)', async () => {
		const service = new RevisionsService({ knex: db, schema });
		const [first, second] = await service.createMany([{ collection: 'x', item: '1' }, { collection: 'x', item: '2' }]);
		expect(second).toBe(Number(first) + 1);
	});
});

describe('read', () => {
	test('reads flat fields with the read processing (conceal, booleans, JSON)', async () => {
		const id = await users().createOne({ email: 'r@example.com', password: 'secret', auth_data: '{"refreshToken":"t"}' });
		const user = await users().readOne(id, { fields: ['email', 'password', 'email_notifications', 'auth_data'] });

		expect(user).toEqual({
			email: 'r@example.com',
			password: '**********',
			email_notifications: true,
			auth_data: { refreshToken: 't' },
		});

		expect(await users().readMany([id], { fields: ['*'] })).toHaveLength(1);
	});

	test('readSingleton returns the schema defaults without a row', async () => {
		const settings = new ItemsService('directus_settings', { knex: db, schema });
		expect(await settings.readSingleton({ fields: ['auth_login_attempts'] })).toEqual({ auth_login_attempts: 25 });

		await db('directus_settings').insert({ auth_login_attempts: 3 });
		expect(await settings.readSingleton({ fields: ['auth_login_attempts'] })).toEqual({ auth_login_attempts: 3 });
	});

	test('readOne of an unknown key is forbidden', async () => {
		await expect(users().readOne('00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});
});

describe('updateMany', () => {
	test('with accountability: hashes, writes activity `update` and a revision with the snapshot', async () => {
		const id = await users().createOne({ email: 'u@example.com', password: 'old' });
		await users(admin).updateOne(id, { password: 'new', status: 'active' });

		const row = await db('directus_users').where({ id }).first();
		expect(row.password).toMatch(/^\$argon2id\$/);

		const activity = await db('directus_activity').first();
		expect(activity).toMatchObject({ action: 'update', item: id, ip: '10.0.0.1' });

		const revision = await db('directus_revisions').first();
		expect(JSON.parse(revision.delta)).toEqual({ password: '**********', status: 'active' });

		expect(JSON.parse(revision.data)).toEqual({
			id,
			email: 'u@example.com',
			password: '**********',
			status: 'active',
			email_notifications: true,
			auth_data: null,
			last_access: null,
		});
	});

	test('without accountability: no activity; an empty payload updates nothing', async () => {
		const id = await users().createOne({ email: 'n@example.com' });
		await users().updateOne(id, { status: 'suspended' });
		await users().updateOne(id, {});

		expect((await db('directus_users').where({ id }).first()).status).toBe('suspended');
		expect(await db('directus_activity').count({ n: '*' }).first()).toEqual({ n: 0 });
	});
});

describe('user integrity check (items.test.ts of Directus)', () => {
	test('createOne and updateMany pass the flags to the callback when given', async () => {
		const onRequire = vi.fn();
		const id = await users().createOne({ email: 'f@example.com' }, { userIntegrityCheckFlags: 2, onRequireUserIntegrityCheck: onRequire });
		await users().updateOne(id, { status: 'active' }, { userIntegrityCheckFlags: 2, onRequireUserIntegrityCheck: onRequire });
		expect(onRequire).toHaveBeenNthCalledWith(1, 2);
		expect(onRequire).toHaveBeenNthCalledWith(2, 2);
	});
});

describe('parts that come with feature 005', () => {
	test('content versions throw', async () => {
		await expect(users().readOne('00000000-0000-4000-8000-000000000000', { version: 'draft' })).rejects.toThrow('feature 005');
		await expect(users().readSingleton({ version: 'draft' })).rejects.toThrow('feature 005');
	});

	test('throw instead of skipping permissions, nested writes or other filters', async () => {
		const user: Accountability = { ...admin, admin: false, user: 'u' };

		await expect(users(user).createOne({ email: 'p@example.com' })).rejects.toThrow('feature 005');
		await expect(users().createOne({ email: 'q@example.com', role: { id: 'x' } })).rejects.toThrow('feature 005');
		await expect(users().readByQuery({ filter: { email: { _eq: 'a' } } })).rejects.toThrow('feature 005');
		await expect(users().readByQuery({ sort: ['email'] })).rejects.toThrow('feature 005');
		await expect(users().readByQuery({ fields: ['role.id'] })).rejects.toThrow('feature 005');
	});
});
