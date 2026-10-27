// PoliciesService on real SQLite tables (task T025; DR 11.17.4 has no test for this service): ip_access validation,
// integrity flags and the cache points of spec FR-082.
import { createInspector } from '@backoffice/schema';
import type { Accountability, SchemaOverview } from '@backoffice/types';
import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAuthDb } from '../../test/directus-db.js';
import { clearSystemCache } from '../cache.js';
import { up } from '../database/backoffice-migrations/20261028A-create-backoffice-permissions.js';
import { createDefaultAccountability } from '../permissions/utils/create-default-accountability.js';
import { getDatabaseSchema } from '../schema/get-database-schema.js';
import { clearCache as clearPermissionsCache } from '../permissions/cache.js';
import { PoliciesService } from './policies.service.js';

const dataCache = { clear: vi.fn() };

vi.mock('../cache.js', () => ({
	getCache: () => ({ cache: dataCache }),
	clearSystemCache: vi.fn(),
	getCacheValue: vi.fn(),
	setCacheValue: vi.fn(),
}));

vi.mock('../permissions/cache.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../permissions/cache.js')>()),
	clearCache: vi.fn(),
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
const service = () => new PoliciesService({ knex: db, schema, accountability: admin });
const IP_ERROR =
	'Invalid payload. IP Access contains an incorrect value. Valid values are: IP addresses, IP ranges and CIDR blocks.';

describe('PoliciesService', () => {
	test.each([[null], [[]], [['10.0.0.1']], [['10.0.0.0/8']], [['10.0.0.1-10.0.0.9']], [['::1', '192.168.0.0/16']]])(
		'accepts ip_access %j',
		async (ipAccess) => {
			await expect(service().createOne({ name: 'p', admin_access: false, ip_access: ipAccess })).resolves.toBeDefined();
		},
	);

	test.each([[['*']], [['10.0.*.*']], [['10.0.0.0/255.0.0.0']], [['not an ip']], [[42]], [undefined]])(
		'refuses ip_access %j with the message of Directus',
		async (ipAccess) => {
			await expect(
				service().createOne({ name: 'p', admin_access: false, ip_access: ipAccess as any }),
			).rejects.toMatchObject({
				code: 'INVALID_PAYLOAD',
				message: IP_ERROR,
			});
		},
	);

	test('createOne clears the permission cache only', async () => {
		await service().createOne({ name: 'p', admin_access: false });
		expect(clearPermissionsCache).toHaveBeenCalledTimes(1);
		expect(clearSystemCache).not.toHaveBeenCalled();
		expect(dataCache.clear).not.toHaveBeenCalled();
	});

	test('updateMany clears the caches only when one of the four flags is in the payload', async () => {
		await service().updateOne(OTHER_POLICY, { name: 'renamed' });
		expect(clearSystemCache).not.toHaveBeenCalled();

		for (const flag of ['app_access', 'ip_access', 'enforce_tfa'] as const) {
			vi.clearAllMocks();
			await service().updateOne(OTHER_POLICY, { [flag]: flag === 'ip_access' ? null : true });
			expect(clearSystemCache, flag).toHaveBeenCalledTimes(1);
			expect(dataCache.clear, flag).toHaveBeenCalledTimes(1);
		}
	});

	test('deleteMany clears the caches; deleting the only admin policy is refused with 422', async () => {
		await service().deleteOne(OTHER_POLICY);
		expect(clearSystemCache).toHaveBeenCalledTimes(1);

		await expect(service().deleteOne(ADMIN_POLICY)).rejects.toMatchObject({ code: 'UNPROCESSABLE_CONTENT' });
		expect(await db('directus_policies').where({ id: ADMIN_POLICY }).first()).toBeDefined();
	});

	// Spec 025 (FR-021): no foreign key, so the service removes the import/export rows of the policy.
	test('deleteMany removes the backoffice_permissions rows of the deleted policies only', async () => {
		await up(db);
		await db('backoffice_permissions').insert([
			{ policy: OTHER_POLICY, collection: 'a', action: 'export' },
			{ policy: ADMIN_POLICY, collection: 'a', action: 'import' },
		]);

		await service().deleteOne(OTHER_POLICY);

		expect(await db('backoffice_permissions').select('policy')).toEqual([{ policy: ADMIN_POLICY }]);
	});

	test('admin_access set to false on the only admin policy is refused with 422', async () => {
		await expect(service().updateOne(ADMIN_POLICY, { admin_access: false })).rejects.toMatchObject({
			code: 'UNPROCESSABLE_CONTENT',
		});

		expect(await db('directus_policies').where({ id: ADMIN_POLICY }).first()).toMatchObject({ admin_access: 1 });
	});
});
