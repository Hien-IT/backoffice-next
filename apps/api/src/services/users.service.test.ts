// Tests of the UsersService subset of feature 003 (research R5) on the auth test database, with the SchemaOverview
// of the system collections (specials from @backoffice/system-data, like DR).
import { createInspector } from '@backoffice/schema';
import type { Accountability, SchemaOverview } from '@backoffice/types';
import jwt from 'jsonwebtoken';
import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAuthDb } from '../../test/directus-db.js';
import { clearSystemCache } from '../cache.js';
import { createDefaultAccountability } from '../permissions/utils/create-default-accountability.js';
import { getDatabaseSchema } from '../schema/get-database-schema.js';
import { UsersService } from './users.service.js';

vi.mock('../cache.js', () => ({ getCache: () => ({ cache: null }), clearSystemCache: vi.fn() }));
const logger = vi.hoisted(() => ({ warn: vi.fn(), trace: vi.fn() }));
vi.mock('../logger/index.js', () => ({ useLogger: () => logger }));

vi.mock('@backoffice/env', () => ({
	useEnv: () => ({
		MAX_BATCH_MUTATION: Infinity,
		USERS_ADMIN_ACCESS_LIMIT: Infinity,
		USERS_APP_ACCESS_LIMIT: Infinity,
		USERS_API_ACCESS_LIMIT: Infinity,
		SECRET: 'test-secret',
		USER_INVITE_URL_ALLOW_LIST: 'https://allowed.example.com/invite',
	}),
}));

// translateDatabaseError asks the client of the default connection, and ItemsService puts the default connection in
// the context of its action events (emitter stand-in, feature 004), like DR.
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
const OTHER_ROLE = 'a0000000-0000-4000-8000-000000000002';

beforeEach(async () => {
	db = await createAuthDb();
	schema = await getDatabaseSchema(db, createInspector(db));

	await db('directus_roles').insert([{ id: ADMIN_ROLE }, { id: OTHER_ROLE }]);
	await db('directus_policies').insert({ id: 'b0000000-0000-4000-8000-000000000001', admin_access: true });
	await db('directus_access').insert({
		id: 'c0000000-0000-4000-8000-000000000001',
		role: ADMIN_ROLE,
		policy: 'b0000000-0000-4000-8000-000000000001',
	});
});

afterEach(async () => {
	await db.destroy();
	vi.clearAllMocks();
});

const service = (accountability: Accountability | null = null) =>
	new UsersService({ knex: db, schema, accountability });

describe('createOne', () => {
	test('creates the user with a uuid and the column defaults', async () => {
		const id = await service().createOne({ email: 'new@example.com', provider: 'oidc', external_identifier: 'sub-1' });
		expect(await db('directus_users').where({ id }).first()).toMatchObject({ status: 'active', provider: 'oidc' });
	});

	test('rejects an invalid email and a duplicate email of another case', async () => {
		await expect(service().createOne({ email: 'not-an-email' })).rejects.toMatchObject({ code: 'FAILED_VALIDATION' });

		await service().createOne({ email: 'Taken@example.com' });

		await expect(service().createOne({ email: 'taken@EXAMPLE.com' })).rejects.toMatchObject({
			code: 'RECORD_NOT_UNIQUE',
			extensions: { collection: 'directus_users', field: 'email' },
		});
	});

	test('checks auth_password_policy', async () => {
		await db('directus_settings').insert({ auth_password_policy: '/^.{8,}$/' });

		await expect(service().createOne({ email: 'p@example.com', password: 'short' })).rejects.toMatchObject({
			code: 'FAILED_VALIDATION',
			extensions: { field: 'password', type: 'regex' },
		});

		await expect(service().createOne({ email: 'q@example.com', password: 'long enough' })).resolves.toBeTruthy();
	});
});

describe('deleteMany', () => {
	test('nulls the references of directus/directus#19912, deletes the rows and their sessions', async () => {
		await service().createOne({ email: 'keeper@example.com', role: ADMIN_ROLE });
		const id = String(await service().createOne({ email: 'gone@example.com' }));

		await db('directus_comments').insert({ id: 'e0000000-0000-4000-8000-000000000001', user_updated: id });
		await db('directus_notifications').insert({ sender: id });
		await db('directus_versions').insert({ id: 'f0000000-0000-4000-8000-000000000001', user_updated: id });
		await db('directus_sessions').insert({ token: 'c'.repeat(64), user: id, expires: new Date(Date.now() + 60_000) });

		await service().deleteOne(id);

		expect(await db('directus_users').where({ id }).first()).toBeUndefined();
		expect(await db('directus_sessions').where({ user: id })).toEqual([]);
		expect((await db('directus_comments').first()).user_updated).toBeNull();
		expect((await db('directus_notifications').first()).sender).toBeNull();
		expect((await db('directus_versions').first()).user_updated).toBeNull();
	});

	test('the last admin: 422 UNPROCESSABLE_CONTENT, the user is kept', async () => {
		const admin = await service().createOne({ email: 'admin@example.com', role: ADMIN_ROLE });

		await expect(service().deleteMany([admin])).rejects.toMatchObject({ code: 'UNPROCESSABLE_CONTENT' });
		expect(await db('directus_users').where({ id: admin }).first()).toBeDefined();
	});
});

describe('updateMany', () => {
	async function userWithSessions(): Promise<string> {
		// A status change checks that an admin remains, like DR.
		await service().createOne({ email: 'keeper@example.com', role: ADMIN_ROLE });
		const id = String(await service().createOne({ email: 's@example.com', password: 'old-password' }));
		const expires = new Date(Date.now() + 60_000);
		await db('directus_sessions').insert([
			{ token: 'a'.repeat(64), user: id, expires },
			{ token: 'b'.repeat(64), user: id, expires },
		]);
		return id;
	}

	test('a password change deletes the other sessions; a status change deletes all', async () => {
		const id = await userWithSessions();
		const withSession: Accountability = { ...createDefaultAccountability(), admin: true, session: 'a'.repeat(64) };

		await service(withSession).updateOne(id, { password: 'new-password' });
		expect((await db('directus_sessions').where({ user: id })).map((s) => s.token)).toEqual(['a'.repeat(64)]);

		await service().updateOne(id, { status: 'suspended' });
		expect(await db('directus_sessions').where({ user: id })).toEqual([]);
	});

	test('rejects tfa_secret and an email for several users; a provider change clears auth_data', async () => {
		const id = await service().createOne({ email: 't@example.com', auth_data: '{"refreshToken":"x"}' });

		await expect(service().updateOne(id, { tfa_secret: 'x' })).rejects.toMatchObject({ code: 'INVALID_PAYLOAD' });
		await expect(service().updateMany([id, id], { email: 'u@example.com' })).rejects.toMatchObject({
			code: 'RECORD_NOT_UNIQUE',
		});

		await service().updateOne(id, { provider: 'oidc' });
		expect((await db('directus_users').where({ id }).first()).auth_data).toBeNull();
	});

	test('a role change checks the remaining admins and clears the caches', async () => {
		const admin = await service().createOne({ email: 'admin@example.com', role: ADMIN_ROLE });
		const other = await service().createOne({ email: 'other@example.com', role: ADMIN_ROLE });

		await service().updateOne(other, { role: OTHER_ROLE });
		expect(clearSystemCache).toHaveBeenCalledTimes(1);

		await expect(service().updateOne(admin, { role: OTHER_ROLE })).rejects.toMatchObject({
			code: 'UNPROCESSABLE_CONTENT',
		});
	});
});

describe('inviteUser and acceptInvite', () => {
	const invited = (email: string) => db('directus_users').where({ email }).first();
	const sign = (payload: object, secret = 'test-secret') =>
		jwt.sign(payload, secret, { issuer: 'directus', expiresIn: '1d' });

	test('creates invited users and logs instead of mailing; re-invites log again and change the role', async () => {
		// A role change checks that an active admin remains, like DR.
		await service().createOne({ email: 'keeper@example.com', role: ADMIN_ROLE });
		logger.warn.mockClear();

		await service().inviteUser(['a@example.com', 'b@example.com'], OTHER_ROLE, null);

		expect(await invited('a@example.com')).toMatchObject({ status: 'invited', role: OTHER_ROLE });
		expect(logger.warn).toHaveBeenCalledWith(
			'[email] Invitation email to "a@example.com" was not sent: Backoffice does not send email.',
		);

		logger.warn.mockClear();
		await service().inviteUser('a@example.com', ADMIN_ROLE, null);

		expect(await invited('a@example.com')).toMatchObject({ status: 'invited', role: ADMIN_ROLE });
		expect(logger.warn).toHaveBeenCalledTimes(1);
		expect(JSON.stringify(logger.warn.mock.calls)).not.toMatch(/token|http/);
	});

	test('users in another status are left alone and get no log', async () => {
		await service().createOne({ email: 'active@example.com', role: OTHER_ROLE });
		await service().inviteUser('active@example.com', ADMIN_ROLE, null);

		expect(await invited('active@example.com')).toMatchObject({ status: 'active', role: OTHER_ROLE });
		expect(logger.warn).not.toHaveBeenCalled();
	});

	test('an invite URL outside USER_INVITE_URL_ALLOW_LIST fails at the first write', async () => {
		await expect(service().inviteUser('c@example.com', OTHER_ROLE, 'https://evil.example.com')).rejects.toMatchObject({
			code: 'INVALID_PAYLOAD',
			message: 'Invalid payload. URL "https://evil.example.com" can\'t be used to invite users.',
		});

		expect(await invited('c@example.com')).toBeUndefined();
		await expect(
			service().inviteUser('c@example.com', OTHER_ROLE, 'https://allowed.example.com/invite'),
		).resolves.toBeUndefined();
	});

	test('acceptInvite: scope, status, then password and active without accountability', async () => {
		await service().inviteUser('d@example.com', OTHER_ROLE, null);

		await expect(service().acceptInvite(sign({ email: 'd@example.com', scope: 'other' }), 'pw')).rejects.toMatchObject({
			code: 'FORBIDDEN',
		});

		await expect(
			service().acceptInvite(sign({ email: 'nobody@example.com', scope: 'invite' }), 'pw'),
		).rejects.toMatchObject({ code: 'INVALID_INVITE' });

		await expect(
			service().acceptInvite(sign({ email: 'd@example.com', scope: 'invite' }, 'wrong'), 'pw'),
		).rejects.toMatchObject({ code: 'INVALID_TOKEN' });

		await service().acceptInvite(sign({ email: 'd@example.com', scope: 'invite' }), 'new-password');
		const user = await invited('d@example.com');
		expect(user.status).toBe('active');
		expect(user.password).toMatch(/^\$argon2/);
	});
});
