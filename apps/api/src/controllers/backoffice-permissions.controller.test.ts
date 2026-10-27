// Backoffice (spec 025, FR-020, D-189.6): /backoffice/permissions end to end on the SQLite auth test database. Parity
// (DR answers 404) is checked by tests/parity/src/permissions/backoffice-permissions.test.ts.
import * as env from '@backoffice/env';
import { createInspector } from '@backoffice/schema';
import jwt from 'jsonwebtoken';
import type { Knex } from 'knex';
import request from 'supertest';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createAuthDb } from '../../test/directus-db.js';
import { type App, createApp } from '../app.js';
import { clearSystemCache } from '../cache.js';
import { up } from '../database/backoffice-migrations/20261028A-create-backoffice-permissions.js';

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

async function start() {
	vi.mocked(env.useEnv).mockReturnValue({ ...defaults, SECRET });
	app = await createApp();
	return request(app.express);
}

const token = (claims: Record<string, unknown> = { id: USER, role: ROLE }) =>
	`Bearer ${jwt.sign({ app_access: false, admin_access: false, ...claims }, SECRET, { issuer: 'directus' })}`;

beforeEach(async () => {
	state.db = await createAuthDb();
	await up(state.db);
	await state.db('directus_roles').insert({ id: ROLE, name: 'Editor' });
	await state.db('directus_policies').insert({ id: POLICY, name: 'Editor', app_access: true, enforce_tfa: true });
	await state.db('directus_access').insert({ id: 'c0000000-0000-4000-8000-000000000001', role: ROLE, policy: POLICY });
	await state.db('directus_users').insert({ id: USER, email: 'user@example.com', first_name: 'Ann', role: ROLE });
});

afterEach(async () => {
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

const ADMIN = 'd0000000-0000-4000-8000-000000000009';
const admin = () => token({ id: ADMIN, role: null });

beforeEach(async () => {
	const policy = 'b0000000-0000-4000-8000-000000000009';
	await state.db('directus_policies').insert({ id: policy, name: 'Admin', admin_access: true, app_access: true });
	await state.db('directus_users').insert({ id: ADMIN, email: 'admin@example.com' });
	await state.db('directus_access').insert({ id: 'c0000000-0000-4000-8000-000000000009', user: ADMIN, policy });
});

const row = (collection: string, action = 'export') => ({ policy: POLICY, collection, action });

test('POST one and many, GET with filter and meta, GET :pk, PATCH array and :pk, DELETE array and :pk', async () => {
	const agent = await start();

	const one = await agent
		.post('/backoffice/permissions')
		.set('Authorization', admin())
		.send({ ...row('a'), options: { formats: ['csv'] }, fields: ['id'] });
	expect(one.status).toBe(200);
	expect(one.body.data).toMatchObject({
		collection: 'a',
		action: 'export',
		options: { formats: ['csv'] },
		fields: ['id'],
	});

	const many = await agent
		.post('/backoffice/permissions?fields=id,collection')
		.set('Authorization', admin())
		.send([row('b'), row('c', 'import')]);
	expect(many.body.data.map((r: any) => r.collection)).toEqual(['b', 'c']);
	const ids = [one.body.data.id, ...many.body.data.map((r: any) => r.id)];

	const listed = await agent
		.get(
			`/backoffice/permissions?filter[policy][_eq]=${POLICY}&filter[action][_eq]=export&meta=filter_count&fields=collection`,
		)
		.set('Authorization', admin());
	expect(listed.body).toEqual({ data: [{ collection: 'a' }, { collection: 'b' }], meta: { filter_count: 2 } });

	expect((await agent.get(`/backoffice/permissions/${ids[2]}`).set('Authorization', admin())).body.data).toMatchObject({
		action: 'import',
	});

	const patched = await agent
		.patch('/backoffice/permissions?fields=id,fields')
		.set('Authorization', admin())
		.send(ids.slice(0, 2).map((id) => ({ id, fields: ['title'] })));
	expect(patched.body.data.map((r: any) => r.fields)).toEqual([['title'], ['title']]);

	const patchedOne = await agent
		.patch(`/backoffice/permissions/${ids[0]}`)
		.set('Authorization', admin())
		.send({ permissions: { status: { _eq: 'published' } } });
	expect(patchedOne.body.data.permissions).toEqual({ status: { _eq: 'published' } });

	expect((await agent.delete('/backoffice/permissions').set('Authorization', admin()).send(ids.slice(1))).status).toBe(
		204,
	);
	expect((await agent.delete(`/backoffice/permissions/${ids[0]}`).set('Authorization', admin())).status).toBe(204);
	expect(await state.db('backoffice_permissions')).toEqual([]);
});

test('an action outside the registry: 400; a user without access to directus_permissions: 403', async () => {
	const agent = await start();

	const invalid = await agent.post('/backoffice/permissions').set('Authorization', admin()).send(row('a', 'share'));
	expect(invalid.status).toBe(400);
	expect(invalid.body.errors[0].extensions.code).toBe('INVALID_PAYLOAD');

	const refused = await agent.post('/backoffice/permissions').set('Authorization', token()).send(row('a'));
	expect(refused.status).toBe(403);
	expect((await agent.get('/backoffice/permissions').set('Authorization', token())).status).toBe(403);
});

test('/items/backoffice_permissions is refused like any system collection (D-189.5)', async () => {
	const res = await (await start()).get('/items/backoffice_permissions').set('Authorization', admin());
	expect(res.status).toBe(403);
});
