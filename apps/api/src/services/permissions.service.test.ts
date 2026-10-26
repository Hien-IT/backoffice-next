// PermissionsService on real SQLite tables (task T026; DR 11.17.4 has no test for this service): minimal app
// permissions on reads, cache points of spec FR-082, getItemPermissions.
import { createInspector } from '@backoffice/schema';
import type { Accountability, SchemaOverview } from '@backoffice/types';
import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAuthDb } from '../../test/directus-db.js';
import { clearSystemCache } from '../cache.js';
import { createDefaultAccountability } from '../permissions/utils/create-default-accountability.js';
import { getDatabaseSchema } from '../schema/get-database-schema.js';
import { PermissionsService } from './permissions.service.js';

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

const ADMIN_ROLE = 'a0000000-0000-4000-8000-000000000001';
const ADMIN_POLICY = 'b0000000-0000-4000-8000-000000000001';
const OTHER_POLICY = 'b0000000-0000-4000-8000-000000000002';
const ADMIN_ACCESS = 'c0000000-0000-4000-8000-000000000001';
const ADMIN_USER = 'd0000000-0000-4000-8000-000000000001';

beforeEach(async () => {
	db = await createAuthDb();
	schema = await getDatabaseSchema(db, createInspector(db));

	await db('directus_roles').insert({ id: ADMIN_ROLE, name: 'Admin' });
	await db('directus_policies').insert([
		{ id: ADMIN_POLICY, name: 'Admin', admin_access: true },
		{ id: OTHER_POLICY, name: 'Other', admin_access: false },
	]);
	await db('directus_access').insert({ id: ADMIN_ACCESS, role: ADMIN_ROLE, policy: ADMIN_POLICY });
	await db('directus_users').insert({ id: ADMIN_USER, email: 'admin@example.com', role: ADMIN_ROLE });
});

afterEach(async () => {
	await db.destroy();
	vi.clearAllMocks();
});

const admin: Accountability = { ...createDefaultAccountability(), admin: true, app: true, user: ADMIN_USER };
const service = (accountability: Accountability | null = admin) =>
	new PermissionsService({ knex: db, schema, accountability });

describe('PermissionsService', () => {
	test('reads of an app user include the minimal app permissions (no id, no policy, system)', async () => {
		await db('directus_permissions').insert({ collection: 'directus_users', action: 'read', policy: OTHER_POLICY });

		const app: Accountability = { ...createDefaultAccountability(), app: true, admin: false, user: ADMIN_USER };
		const rows = await new PermissionsService({ knex: db, schema, accountability: null }).readByQuery({ limit: -1 });
		const appRows = await service({ ...app, admin: true }).readByQuery({ limit: -1 });

		expect(rows).toHaveLength(1);
		expect(appRows.length).toBeGreaterThan(1);
		const system = appRows.filter((p) => p['system'] === true);
		expect(system.length).toBeGreaterThan(0);
		expect(system.every((p) => p['policy'] === null && p['id'] === undefined)).toBe(true);
	});

	test('the minimal app permissions follow the filter of the query', async () => {
		const rows = await service().readByQuery({ filter: { collection: { _eq: 'directus_roles' } }, limit: -1 });
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.every((p) => p['collection'] === 'directus_roles')).toBe(true);
	});

	test('every write clears the system and permission caches and the data cache', async () => {
		const key = await service().createOne({ collection: 'directus_users', action: 'read', policy: OTHER_POLICY });
		const keys = await service().createMany([{ collection: 'directus_roles', action: 'read', policy: OTHER_POLICY }]);
		await service().updateOne(key, { fields: ['id'] });
		await service().updateBatch([{ id: keys[0], fields: ['name'] }]);
		await service().deleteMany([key, ...keys]);

		// As in DR, createMany and updateBatch go through the overridden createOne and updateMany, so the system
		// caches are cleared twice for them (1 + 2 + 1 + 2 + 1); the inner calls get autoPurgeCache: false, so the data
		// cache is cleared once per write.
		expect(clearSystemCache).toHaveBeenCalledTimes(7);
		expect(dataCache.clear).toHaveBeenCalledTimes(5);
	});

	test('autoPurgeCache: false keeps the data cache', async () => {
		await service().createOne(
			{ collection: 'directus_users', action: 'read', policy: OTHER_POLICY },
			{ autoPurgeCache: false },
		);
		expect(clearSystemCache).toHaveBeenCalledTimes(1);
		expect(dataCache.clear).not.toHaveBeenCalled();
	});

	test('getItemPermissions: no user is forbidden, an admin may do everything', async () => {
		await expect(
			service({ ...createDefaultAccountability() }).getItemPermissions('directus_users'),
		).rejects.toMatchObject({
			code: 'FORBIDDEN',
		});

		await expect(service().getItemPermissions('directus_users', ADMIN_USER)).resolves.toEqual({
			update: { access: true },
			delete: { access: true },
			share: { access: true },
		});
	});

	// Backoffice (spec 023, D-185)
	test.each([
		['permissions', { 'json(meta, a, number)': { _eq: 1 } }],
		['validation', { _and: [{ title: { _nnull: true } }, { 'json(meta, a)': { _eq: 'x' } }] }],
		['permissions', JSON.stringify({ _or: [{ owner: { 'json(details, x, text)': { _eq: 'y' } } }] })],
	])('a json path in %s is refused on create and update', async (key, value) => {
		const message = 'Permission filters cannot use a JSON path';

		await expect(
			service().createOne({ collection: 'directus_users', action: 'read', policy: OTHER_POLICY, [key]: value }),
		).rejects.toThrow(message);

		const id = await service().createOne({ collection: 'directus_users', action: 'read', policy: OTHER_POLICY });
		await expect(service().updateOne(id, { [key]: value })).rejects.toThrow(message);
		await expect(
			service().createMany([{ collection: 'directus_roles', action: 'read', policy: OTHER_POLICY, [key]: value }]),
		).rejects.toThrow(message);
		expect(await db('directus_permissions').where({ id }).first()).toMatchObject({ [key]: null });
	});

	test('filters without a json path are saved as before', async () => {
		const id = await service().createOne({
			collection: 'directus_users',
			action: 'read',
			policy: OTHER_POLICY,
			permissions: { _and: [{ id: { _eq: '$CURRENT_USER' } }, { 'count(tags)': { _gt: 0 } }] },
		});

		expect(id).toBeDefined();
	});
});
