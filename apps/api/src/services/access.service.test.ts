// AccessService on real SQLite tables (task T024; DR 11.17.4 has no test for this service): integrity flags and the
// cache points of spec FR-082 (system and permission caches through clearSystemCache, data cache always).
import { createInspector } from '@backoffice/schema';
import type { Accountability, SchemaOverview } from '@backoffice/types';
import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAuthDb } from '../../test/directus-db.js';
import { clearSystemCache } from '../cache.js';
import { createDefaultAccountability } from '../permissions/utils/create-default-accountability.js';
import { getDatabaseSchema } from '../schema/get-database-schema.js';
import { AccessService } from './access.service.js';

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
const service = () => new AccessService({ knex: db, schema, accountability: admin });

describe('AccessService', () => {
	test('createOne attaches a policy to a role, a user or the public role, then clears the caches', async () => {
		const toUser = await service().createOne({ policy: OTHER_POLICY, user: ADMIN_USER });
		const toPublic = await service().createOne({ policy: OTHER_POLICY });

		expect(await db('directus_access').where({ id: toUser }).first()).toMatchObject({ user: ADMIN_USER, role: null });
		expect(await db('directus_access').where({ id: toPublic }).first()).toMatchObject({ user: null, role: null });
		expect(clearSystemCache).toHaveBeenCalledTimes(2);
		expect(dataCache.clear).toHaveBeenCalledTimes(2);
	});

	test('the data cache is cleared even when the caller asks not to (opts are not passed on)', async () => {
		await service().createOne({ policy: OTHER_POLICY, role: ADMIN_ROLE }, { autoPurgeCache: false });
		expect(dataCache.clear).toHaveBeenCalledTimes(1);
	});

	test('updateMany and deleteMany clear the caches', async () => {
		const key = await service().createOne({ policy: OTHER_POLICY, role: ADMIN_ROLE });
		vi.clearAllMocks();

		await service().updateOne(key, { sort: 2 });
		await service().deleteOne(key);

		expect(clearSystemCache).toHaveBeenCalledTimes(2);
		expect(dataCache.clear).toHaveBeenCalledTimes(2);
		expect(await db('directus_access').where({ id: key }).first()).toBeUndefined();
	});

	test('removing the last admin access is refused with 422 and the row is kept', async () => {
		await expect(service().deleteOne(ADMIN_ACCESS)).rejects.toMatchObject({
			code: 'UNPROCESSABLE_CONTENT',
			message: "Can't process content. Cannot remove the last admin user from the system.",
		});

		expect(await db('directus_access').where({ id: ADMIN_ACCESS }).first()).toBeDefined();
	});
});
