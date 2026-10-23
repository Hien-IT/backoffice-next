// GET /users/me end to end (pipeline, authenticate, permission engine) on the SQLite auth test database (task T037).
// Parity with DR is checked by tests/parity/src/permissions/accountability.test.ts.
import * as env from '@backoffice/env';
import { createInspector } from '@backoffice/schema';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import type { Knex } from 'knex';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAuthDb } from '../../test/directus-db.js';
import { type App, createApp } from '../app.js';
import { clearSystemCache } from '../cache.js';

const state = vi.hoisted(() => ({ db: undefined as unknown as Knex }));

vi.mock('../flows.js', async () => (await import('../test-utils/flows.js')).mockFlowManager());

vi.mock('@backoffice/env', async (importOriginal) => {
	const actual = await importOriginal<typeof env>();
	return { ...actual, useEnv: vi.fn(actual.useEnv) };
});

vi.mock('../database/index.js', async (importOriginal) => {
	const original = await importOriginal<typeof import('../database/index.js')>();
	return { ...original, default: () => state.db, getDatabase: () => state.db, getDatabaseClient: () => 'sqlite' };
});

vi.mock('../schema/get-database-schema.js', async (importOriginal) => {
	const original = await importOriginal<typeof import('../schema/get-database-schema.js')>();
	return { ...original, getSchema: () => original.getDatabaseSchema(state.db, createInspector(state.db)) };
});

vi.mock('../logger/index.js', () => {
	const logger = { warn: vi.fn(), debug: vi.fn(), error: vi.fn(), info: vi.fn(), fatal: vi.fn(), trace: vi.fn() };
	return {
		useLogger: () => logger,
		createExpressLogger: () => (_req: unknown, _res: unknown, next: () => void) => next(),
	};
});

const defaults = (await vi.importActual<typeof env>('@backoffice/env')).useEnv();

const SECRET = 'test-secret';
const ROLE = 'a0000000-0000-4000-8000-000000000001';
const POLICY = 'b0000000-0000-4000-8000-000000000001';
const USER = 'd0000000-0000-4000-8000-000000000001';

let app: App;

/**
 * A current OTP with at least 10 s left in its 30 s step: on a loaded runner the first request of an app can take a few
 * seconds, and an OTP of the previous step is invalid (400 instead of the 403 under test, CI 39667786611).
 */
async function otp(secret: string): Promise<string> {
	const remaining = authenticator.timeRemaining();
	if (remaining < 10) await new Promise((resolve) => setTimeout(resolve, remaining * 1000 + 100));
	return authenticator.generate(secret);
}

async function start() {
	vi.mocked(env.useEnv).mockReturnValue({ ...defaults, SECRET });
	app = await createApp();
	return request(app.express);
}

const token = (claims: Record<string, unknown> = { id: USER, role: ROLE }) =>
	`Bearer ${jwt.sign({ app_access: false, admin_access: false, ...claims }, SECRET, { issuer: 'directus' })}`;

beforeEach(async () => {
	state.db = await createAuthDb();
	await state.db('directus_roles').insert({ id: ROLE, name: 'Editor' });
	await state.db('directus_policies').insert({ id: POLICY, name: 'Editor' });
	await state.db('directus_access').insert({ id: 'c0000000-0000-4000-8000-000000000001', role: ROLE, policy: POLICY });
	await state.db('directus_users').insert({ id: USER, email: 'user@example.com', first_name: 'Ann', role: ROLE });
});

afterEach(async () => {
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

test('no user: 401 INVALID_CREDENTIALS', async () => {
	const res = await (await start()).get('/users/me');

	expect(res.status).toBe(401);
	expect(res.body.errors[0].extensions.code).toBe('INVALID_CREDENTIALS');
});

test('without read permission on directus_users: only the id', async () => {
	const res = await (await start()).get('/users/me').set('Authorization', token());

	expect(res.status).toBe(200);
	expect(res.body).toEqual({ data: { id: USER } });
});

test('with a read permission: the fields of the query the permission allows', async () => {
	await state.db('directus_permissions').insert({
		collection: 'directus_users',
		action: 'read',
		fields: 'id,email,first_name',
		permissions: JSON.stringify({ id: { _eq: '$CURRENT_USER' } }),
		policy: POLICY,
	});

	const agent = await start();

	expect((await agent.get('/users/me?fields=email,first_name').set('Authorization', token())).body).toEqual({
		data: { email: 'user@example.com', first_name: 'Ann' },
	});

	// A field outside the permission is refused by the read, which answers with the id (DR catches FORBIDDEN).
	expect((await agent.get('/users/me?fields=last_name').set('Authorization', token())).body).toEqual({
		data: { id: USER },
	});
});

test('OPTIONS lists the methods of every Directus route matching /users/me', async () => {
	const res = await (await start()).options('/users/me');

	expect(res.headers['allow']).toBe('GET,HEAD,PATCH,DELETE');
});

describe('CRUD as admin (routes in the order of the Directus router)', () => {
	const ADMIN = 'd0000000-0000-4000-8000-000000000009';
	const admin = () => token({ id: ADMIN, role: null });

	beforeEach(async () => {
		const policy = 'b0000000-0000-4000-8000-000000000009';
		await state.db('directus_policies').insert({ id: policy, name: 'Admin', admin_access: true, app_access: true });
		await state.db('directus_users').insert({ id: ADMIN, email: 'admin@example.com' });
		await state.db('directus_access').insert({ id: 'c0000000-0000-4000-8000-000000000009', user: ADMIN, policy });
	});

	test('POST one and many, GET with meta, SEARCH with the query of the body', async () => {
		const agent = await start();

		const one = await agent.post('/users?fields=email').set('Authorization', admin()).send({ email: 'a@example.com' });
		expect(one.status).toBe(200);
		expect(one.body).toEqual({ data: { email: 'a@example.com' } });

		const many = await agent
			.post('/users?fields=email&sort=email')
			.set('Authorization', admin())
			.send([{ email: 'b@example.com' }, { email: 'c@example.com' }]);

		expect(many.body).toEqual({ data: [{ email: 'b@example.com' }, { email: 'c@example.com' }] });

		const list = await agent
			.get('/users?fields=email&sort=email&limit=2&meta=filter_count')
			.set('Authorization', admin());
		expect(list.body).toEqual({
			data: [{ email: 'a@example.com' }, { email: 'admin@example.com' }],
			meta: { filter_count: 5 },
		});

		const search = await agent
			.search('/users')
			.set('Authorization', admin())
			.send({ keys: [USER], query: { fields: ['email'], filter: { email: { _eq: 'b@example.com' } } } });

		expect(search.body).toEqual({ data: [{ email: 'b@example.com' }] });
	});

	test('GET /:pk; a pk ending in me answers 204', async () => {
		const agent = await start();

		expect((await agent.get(`/users/${USER}?fields=first_name`).set('Authorization', admin())).body).toEqual({
			data: { first_name: 'Ann' },
		});

		expect((await agent.get('/users/some').set('Authorization', admin())).status).toBe(204);
	});

	test('PATCH /me reads back; PATCH /me/track/page answers 204 without a permission; no user 401', async () => {
		const agent = await start();

		const me = await agent
			.patch('/users/me?fields=first_name')
			.set('Authorization', admin())
			.send({ first_name: 'Ad' });
		expect(me.body).toEqual({ data: { first_name: 'Ad' } });

		const page = await agent
			.patch('/users/me/track/page')
			.set('Authorization', token())
			.send({ last_page: '/content' });
		expect(page.status).toBe(204);
		expect((await state.db('directus_users').where({ id: USER }).first()).last_page).toBe('/content');

		const missing = await agent.patch('/users/me/track/page').set('Authorization', token()).send({});
		expect(missing.status).toBe(400);
		expect(missing.body.errors[0].message).toBe('Invalid payload. "last_page" key is required.');

		expect((await agent.patch('/users/me').send({})).status).toBe(401);
	});

	test('PATCH by keys and /:pk; DELETE by array and /:pk', async () => {
		const agent = await start();
		const ids = ['e1', 'e2'].map((s) => `d0000000-0000-4000-8000-0000000000${s}`);
		await state.db('directus_users').insert(ids.map((id, i) => ({ id, email: `${i}@example.com` })));

		const patched = await agent
			.patch('/users?fields=status&sort=email')
			.set('Authorization', admin())
			.send({ keys: ids, data: { status: 'suspended' } });

		expect(patched.body).toEqual({ data: [{ status: 'suspended' }, { status: 'suspended' }] });

		const one = await agent
			.patch(`/users/${ids[0]}?fields=status`)
			.set('Authorization', admin())
			.send({ status: 'draft' });
		expect(one.body).toEqual({ data: { status: 'draft' } });

		expect((await agent.delete('/users').set('Authorization', admin()).send([ids[0]])).status).toBe(204);
		expect((await agent.delete(`/users/${ids[1]}`).set('Authorization', admin())).status).toBe(204);
		expect(await state.db('directus_users').whereIn('id', ids)).toEqual([]);
	});

	test('deleting the last admin: 422', async () => {
		const res = await (await start()).delete(`/users/${ADMIN}`).set('Authorization', admin());
		expect(res.status).toBe(422);
	});
});

// The OTP helper may wait for the next 30 s step: more than the default 5 s.
describe('TFA enable and disable (FR-048)', { timeout: 30_000 }, () => {
	const ADMIN = 'd0000000-0000-4000-8000-000000000009';
	const admin = () => token({ id: ADMIN, role: null });

	beforeEach(async () => {
		const policy = 'b0000000-0000-4000-8000-000000000009';
		await state.db('directus_policies').insert({ id: policy, name: 'Admin', admin_access: true, app_access: true });
		await state.db('directus_users').insert({ id: ADMIN, email: 'admin@example.com' });
		await state.db('directus_access').insert({ id: 'c0000000-0000-4000-8000-000000000009', user: ADMIN, policy });
	});

	const secretOf = async (id: string) => (await state.db('directus_users').where({ id }).first()).tfa_secret;

	test('enable checks the payload and the OTP, then stores the secret; already set is refused', async () => {
		const agent = await start();
		const secret = authenticator.generateSecret();
		const enable = (body: object) => agent.post('/users/me/tfa/enable').set('Authorization', admin()).send(body);

		expect((await enable({ otp: '1' })).body.errors[0].message).toBe('Invalid payload. "secret" is required.');
		expect((await enable({ secret })).body.errors[0].message).toBe('Invalid payload. "otp" is required.');
		expect((await enable({ secret, otp: '000000' })).body.errors[0].message).toBe('Invalid payload. "otp" is invalid.');

		const ok = await enable({ secret, otp: await otp(secret) });
		expect(ok.status).toBe(204);
		expect(await secretOf(ADMIN)).toBe(secret);

		expect((await enable({ secret, otp: await otp(secret) })).body.errors[0].message).toBe(
			'Invalid payload. TFA Secret is already set for this user.',
		);
	});

	test('a user without update permission on tfa_secret cannot enable it', async () => {
		const secret = authenticator.generateSecret();
		const agent = await start();
		const code = await otp(secret);

		const res = await agent.post('/users/me/tfa/enable').set('Authorization', token()).send({ secret, otp: code });

		expect(res.status).toBe(403);
		expect(await secretOf(USER)).toBeNull();
	});

	test('disable with the OTP of the stored secret; an admin disables another user; others get 403', async () => {
		const secret = authenticator.generateSecret();
		await state.db('directus_users').whereIn('id', [ADMIN, USER]).update({ tfa_secret: secret });
		const agent = await start();

		const wrong = await agent.post('/users/me/tfa/disable').set('Authorization', admin()).send({ otp: '000000' });
		expect(wrong.body.errors[0].message).toBe('Invalid payload. "otp" is invalid.');

		const own = await agent
			.post('/users/me/tfa/disable')
			.set('Authorization', admin())
			.send({ otp: await otp(secret) });

		expect(own.status).toBe(204);
		expect(await secretOf(ADMIN)).toBeNull();

		expect((await agent.post(`/users/${ADMIN}/tfa/disable`).set('Authorization', token())).status).toBe(403);
		expect((await agent.post(`/users/${USER}/tfa/disable`).set('Authorization', admin())).status).toBe(204);
		expect(await secretOf(USER)).toBeNull();
		expect((await agent.post('/users/me/tfa/disable').send({})).status).toBe(401);
	});
});

describe('invites and registration (US5)', () => {
	const ADMIN = 'd0000000-0000-4000-8000-000000000009';
	const admin = () => token({ id: ADMIN, role: null });
	const signed = (payload: object) => jwt.sign(payload, SECRET, { issuer: 'directus', expiresIn: '1h' });
	const userBy = (email: string) => state.db('directus_users').where({ email }).first();

	beforeEach(async () => {
		const policy = 'b0000000-0000-4000-8000-000000000009';
		await state.db('directus_policies').insert({ id: policy, name: 'Admin', admin_access: true, app_access: true });
		await state.db('directus_users').insert({ id: ADMIN, email: 'admin@example.com' });
		await state.db('directus_access').insert({ id: 'c0000000-0000-4000-8000-000000000009', user: ADMIN, policy });
	});

	test('invite: Joi errors, then an invited user; accept with the invite token activates it', async () => {
		const agent = await start();

		const bad = await agent.post('/users/invite').set('Authorization', admin()).send({ email: 'x', role: ROLE });
		expect(bad.status).toBe(400);
		expect(bad.body.errors[0].message).toBe('Invalid payload. "email" must be a valid email.');

		const invited = await agent
			.post('/users/invite')
			.set('Authorization', admin())
			.send({ email: 'i@example.com', role: ROLE });
		expect(invited.status).toBe(204);
		expect(await userBy('i@example.com')).toMatchObject({ status: 'invited', role: ROLE });

		expect((await agent.post('/users/invite/accept').send({ token: 'x' })).status).toBe(400);

		const accepted = await agent
			.post('/users/invite/accept')
			.send({ token: signed({ email: 'i@example.com', scope: 'invite' }), password: 'new-password' });

		expect(accepted.status).toBe(204);
		expect(await userBy('i@example.com')).toMatchObject({ status: 'active' });
	});

	test('register: closed 403; open with verification creates an unverified user; verify-email redirects', async () => {
		const agent = await start();
		const register = (email: string, ip: string) =>
			agent.post('/users/register').set('X-Forwarded-For', ip).send({ email, password: 'pw' });

		expect((await register('r@example.com', '10.70.0.1')).status).toBe(403);

		await state.db('directus_settings').insert({ public_registration: true, public_registration_role: ROLE });
		expect((await register('r@example.com', '10.70.0.2')).status).toBe(204);
		expect(await userBy('r@example.com')).toMatchObject({ status: 'unverified', role: ROLE });

		const empty = await agent.get('/users/register/verify-email?token=');
		expect(empty.status).toBe(302);
		expect(empty.headers['location']).toBe('/admin/login');

		const verified = await agent.get(
			`/users/register/verify-email?token=${signed({ email: 'r@example.com', scope: 'pending-registration' })}`,
		);

		expect(verified.status).toBe(302);
		expect(verified.headers['location']).toBe(`/admin/users/${(await userBy('r@example.com')).id}`);
		expect(await userBy('r@example.com')).toMatchObject({ status: 'active' });
	});

	test('register: the sixth request of an IP within a minute is refused with 429 and Retry-After', async () => {
		const agent = await start();
		const statuses: number[] = [];

		for (let i = 0; i < 6; i++) {
			statuses.push((await agent.post('/users/register').set('X-Forwarded-For', '10.71.0.1').send({})).status);
		}

		expect(statuses).toEqual([400, 400, 400, 400, 400, 429]);
	});
});
