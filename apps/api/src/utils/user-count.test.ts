// Tests of the user count integrity check (validate-user-count-integrity.ts, fetch-user-count/**), on SQLite.
import { useEnv } from '@backoffice/env';
import { UserIntegrityCheckFlag } from '@backoffice/types';
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { fetchUserCount } from './fetch-user-count/fetch-user-count.js';
import { validateUserCountIntegrity } from './validate-user-count-integrity.js';

vi.mock('@backoffice/env');

let db: Knex;

beforeAll(async () => {
	db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
	await db.schema.createTable('directus_roles', (t) => {
		t.string('id').primary();
		t.string('parent').nullable();
	});
	await db.schema.createTable('directus_policies', (t) => {
		t.string('id').primary();
		t.boolean('admin_access');
		t.boolean('app_access');
	});
	await db.schema.createTable('directus_users', (t) => {
		t.string('id').primary();
		t.string('role').nullable();
		t.string('status');
	});
	await db.schema.createTable('directus_access', (t) => {
		t.string('id').primary();
		t.string('role').nullable();
		t.string('user').nullable();
		t.string('policy');
	});

	await db('directus_roles').insert([
		{ id: 'admins', parent: null },
		{ id: 'editors', parent: null },
		{ id: 'sub-editors', parent: 'editors' },
	]);
	await db('directus_policies').insert([
		{ id: 'admin', admin_access: true, app_access: true },
		{ id: 'app', admin_access: false, app_access: true },
	]);
	await db('directus_access').insert([
		{ id: 'a1', role: 'admins', user: null, policy: 'admin' },
		{ id: 'a2', role: 'editors', user: null, policy: 'app' },
		{ id: 'a3', role: null, user: 'direct-admin', policy: 'admin' },
	]);
	await db('directus_users').insert([
		{ id: 'admin-1', role: 'admins', status: 'active' },
		{ id: 'direct-admin', role: null, status: 'active' },
		{ id: 'editor-1', role: 'sub-editors', status: 'active' },
		{ id: 'api-1', role: null, status: 'active' },
		{ id: 'old', role: 'admins', status: 'suspended' },
	]);
});

afterAll(() => db.destroy());

describe('fetchUserCount', () => {
	test('counts active users by admin, app (nested roles included) and api access', async () => {
		expect(await fetchUserCount({ knex: db })).toEqual({ admin: 2, app: 1, api: 1 });
	});

	test('adminOnly counts admins only, and excluded users are not counted', async () => {
		expect(await fetchUserCount({ knex: db, adminOnly: true })).toEqual({ admin: 2, app: 0, api: 0 });
		expect(await fetchUserCount({ knex: db, adminOnly: true, excludeUsers: ['admin-1'] })).toMatchObject({ admin: 1 });
	});
});

describe('validateUserCountIntegrity', () => {
	test('does nothing without flags, or for UserLimits when no limit is set (Infinity)', async () => {
		vi.mocked(useEnv).mockReturnValue({
			USERS_ADMIN_ACCESS_LIMIT: Infinity,
			USERS_APP_ACCESS_LIMIT: Infinity,
			USERS_API_ACCESS_LIMIT: Infinity,
		});

		await expect(validateUserCountIntegrity({ knex: db, flags: UserIntegrityCheckFlag.None })).resolves.toBeUndefined();
		await expect(
			validateUserCountIntegrity({ knex: db, flags: UserIntegrityCheckFlag.UserLimits }),
		).resolves.toBeUndefined();
	});

	test('rejects removing the last admin', async () => {
		await expect(
			validateUserCountIntegrity({
				knex: db,
				flags: UserIntegrityCheckFlag.RemainingAdmins,
				excludeUsers: ['admin-1', 'direct-admin'],
			}),
		).rejects.toMatchObject({ code: 'UNPROCESSABLE_CONTENT' });
	});

	test('rejects going over a user limit', async () => {
		vi.mocked(useEnv).mockReturnValue({
			USERS_ADMIN_ACCESS_LIMIT: 1,
			USERS_APP_ACCESS_LIMIT: Infinity,
			USERS_API_ACCESS_LIMIT: Infinity,
		});

		await expect(validateUserCountIntegrity({ knex: db, flags: UserIntegrityCheckFlag.All })).rejects.toMatchObject({
			code: 'LIMIT_EXCEEDED',
		});
	});
});
