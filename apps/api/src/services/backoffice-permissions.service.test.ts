// Backoffice (spec 025, FR-020, SC-006): BackofficePermissionsService on real SQLite tables.
import { createInspector } from '@backoffice/schema';
import type { Accountability, SchemaOverview } from '@backoffice/types';
import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAuthDb } from '../../test/directus-db.js';
import { clearSystemCache } from '../cache.js';
import { up } from '../database/backoffice-migrations/20261028A-create-backoffice-permissions.js';
import { clearCache as clearPermissionsCache } from '../permissions/cache.js';
import { createDefaultAccountability } from '../permissions/utils/create-default-accountability.js';
import { getDatabaseSchema } from '../schema/get-database-schema.js';
import { BackofficePermissionsService, withCasts } from './backoffice-permissions.service.js';

const dataCache = { clear: vi.fn() };

vi.mock('../cache.js', () => ({
	getCache: () => ({ cache: dataCache }),
	clearSystemCache: vi.fn(),
	getCacheValue: vi.fn(),
	setCacheValue: vi.fn(),
}));

vi.mock('../logger/index.js', () => ({ useLogger: () => ({ warn: vi.fn(), trace: vi.fn(), error: vi.fn() }) }));

vi.mock('@backoffice/env', () => ({
	useEnv: () => ({
		MAX_BATCH_MUTATION: Infinity,
		USERS_ADMIN_ACCESS_LIMIT: Infinity,
		USERS_APP_ACCESS_LIMIT: Infinity,
		USERS_API_ACCESS_LIMIT: Infinity,
		CACHE_AUTO_PURGE: true,
		CACHE_AUTO_PURGE_IGNORE_LIST: ['directus_activity', 'directus_presets'],
	}),
}));

vi.mock('../database/index.js', async (importOriginal) => {
	const original = await importOriginal<typeof import('../database/index.js')>();
	const getDatabase = () => db;

	return {
		...original,
		default: getDatabase,
		getDatabase,
		getDatabaseClient: (database?: Knex) => (database ? original.getDatabaseClient(database) : 'sqlite'),
	};
});

let db: Knex;
let schema: SchemaOverview;

const ROLE = 'a0000000-0000-4000-8000-000000000001';
const POLICY = 'b0000000-0000-4000-8000-000000000001';
const TARGET_POLICY = 'b0000000-0000-4000-8000-000000000002';
const USER = 'd0000000-0000-4000-8000-000000000001';

beforeEach(async () => {
	db = await createAuthDb();
	await up(db);
	schema = await getDatabaseSchema(db, createInspector(db));
	await clearPermissionsCache();

	await db('directus_roles').insert({ id: ROLE, name: 'Editor' });
	await db('directus_policies').insert([
		{ id: POLICY, name: 'Editor', admin_access: false, app_access: true },
		{ id: TARGET_POLICY, name: 'Target', admin_access: false, app_access: false },
	]);
	await db('directus_access').insert({ id: 'c0000000-0000-4000-8000-000000000001', role: ROLE, policy: POLICY });
	await db('directus_users').insert({ id: USER, email: 'editor@example.com', role: ROLE });
});

afterEach(async () => {
	await db.destroy();
	vi.clearAllMocks();
});

const admin: Accountability = { ...createDefaultAccountability(), admin: true, app: true, user: USER };
const editor: Accountability = { ...createDefaultAccountability(), app: true, user: USER, role: ROLE, roles: [ROLE] };
const service = (accountability: Accountability | null = admin) =>
	new BackofficePermissionsService({ knex: db, schema, accountability });

const ROW = {
	policy: TARGET_POLICY,
	collection: 'articles',
	action: 'export',
	permissions: { status: { _eq: 'published' } },
	fields: ['id', 'title'],
	options: { formats: ['csv'] },
};

describe('BackofficePermissionsService', () => {
	test('JSON and csv columns are stored as strings and read back as objects and arrays', async () => {
		const key = await service().createOne(ROW);

		const raw = await db('backoffice_permissions').where({ id: key }).first();
		expect(typeof raw.permissions).toBe('string');
		expect(raw.fields).toBe('id,title');

		expect(await service().readOne(key)).toMatchObject(ROW);
	});

	test('the shared SchemaOverview is not changed by the casts', () => {
		const before = JSON.stringify(schema.collections['backoffice_permissions']);
		const cast = withCasts(schema);

		expect(cast.collections['backoffice_permissions']!.fields['options']!.special).toEqual(['cast-json']);
		expect(cast.collections['backoffice_permissions']!.fields['fields']!.special).toEqual(['cast-csv']);
		expect(JSON.stringify(schema.collections['backoffice_permissions'])).toBe(before);
	});

	test('an action outside the registry is refused; a later action of the registry needs no migration (SC-006)', async () => {
		await expect(service().createOne({ ...ROW, action: 'share' })).rejects.toMatchObject({ code: 'INVALID_PAYLOAD' });

		const { BACKOFFICE_PERMISSION_ACTIONS } = await import('@backoffice/constants');
		(BACKOFFICE_PERMISSION_ACTIONS as Record<string, unknown>)['batch_update_items'] = {
			requires: ['update'],
			formats: [],
		};

		try {
			const key = await service().createOne({ ...ROW, action: 'batch_update_items' });
			expect(await service().readOne(key)).toMatchObject({ action: 'batch_update_items' });
		} finally {
			delete (BACKOFFICE_PERMISSION_ACTIONS as Record<string, unknown>)['batch_update_items'];
		}
	});

	test('a writer clears the system and data caches (FR-013)', async () => {
		const key = await service().createOne(ROW);
		await service().updateOne(key, { fields: ['id'] });
		await service().deleteOne(key);

		expect(clearSystemCache).toHaveBeenCalledTimes(3);
		// ItemsService also purges on its own (CACHE_AUTO_PURGE), as for PermissionsService.
		expect(dataCache.clear.mock.calls.length).toBeGreaterThanOrEqual(3);
	});

	test('a user without access to directus_permissions is refused', async () => {
		await expect(service(editor).createOne(ROW)).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(service(editor).readByQuery({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	test('a user who may create directus_permissions may create here; activity names the user', async () => {
		await db('directus_permissions').insert([
			{ collection: 'directus_permissions', action: 'create', policy: POLICY, fields: '*' },
			{ collection: 'directus_permissions', action: 'read', policy: POLICY, fields: '*' },
		]);
		await clearPermissionsCache();

		const key = await service(editor).createOne(ROW);
		expect(await service(editor).readOne(key)).toMatchObject({ action: 'export' });
		await expect(service(editor).deleteOne(key)).rejects.toMatchObject({ code: 'FORBIDDEN' });

		const activity = await db('directus_activity').where({ collection: 'backoffice_permissions', action: 'create' });
		expect(activity).toHaveLength(1);
		expect(activity[0].user).toBe(USER);
	});
});
