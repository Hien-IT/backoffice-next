// Backoffice (spec 030, D-210): /backoffice/collections/:collection/indexes end to end on the SQLite auth test
// database (the index is built for real). Parity with DR (404) is tests/parity/src/schema/indexes.test.ts.
import * as env from '@backoffice/env';
import { createInspector } from '@backoffice/schema';
import jwt from 'jsonwebtoken';
import type { Knex } from 'knex';
import request from 'supertest';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createAuthDb } from '../../test/directus-db.js';
import { type App, createApp } from '../app.js';
import { clearSystemCache } from '../cache.js';
import { up } from '../database/backoffice-migrations/20261103A-create-backoffice-indexes.js';
import { running } from '../services/backoffice-indexes/jobs.js';
import { wantsConcurrent } from './backoffice-indexes.controller.js';

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
const USER = 'd0000000-0000-4000-8000-000000000001';
const ADMIN = 'd0000000-0000-4000-8000-000000000009';

let app: App;

async function start() {
	vi.mocked(env.useEnv).mockReturnValue({ ...defaults, SECRET });
	app = await createApp();
	return request(app.express);
}

const token = (claims: Record<string, unknown>) =>
	`Bearer ${jwt.sign({ app_access: true, admin_access: false, ...claims }, SECRET, { issuer: 'directus' })}`;
const user = () => token({ id: USER, role: ROLE });
const admin = () => token({ id: ADMIN, role: null, admin_access: true });

beforeEach(async () => {
	state.db = await createAuthDb();
	await up(state.db);
	await state.db.schema.createTable('articles', (t) => {
		t.increments('id');
		t.string('provider', 64);
		t.string('provider_subject', 64);
	});
	await state.db('directus_collections').insert({ collection: 'articles' });
	await state.db('directus_roles').insert({ id: ROLE, name: 'Editor' });
	await state.db('directus_users').insert([
		{ id: USER, email: 'user@example.com', role: ROLE },
		{ id: ADMIN, email: 'admin@example.com' },
	]);
	const policy = 'b0000000-0000-4000-8000-000000000009';
	await state.db('directus_policies').insert({ id: policy, name: 'Admin', admin_access: true, app_access: true });
	await state.db('directus_access').insert({ id: 'c0000000-0000-4000-8000-000000000009', user: ADMIN, policy });
});

afterEach(async () => {
	await Promise.all([...running]);
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

const PATH = '/backoffice/collections/articles/indexes';

test('401 without a token, 403 for a user who is not admin, 403 on a system collection', async () => {
	const agent = await start();
	expect((await agent.get(PATH)).status).toBe(401);
	expect((await agent.get(PATH).set('Authorization', user())).status).toBe(403);
	expect((await agent.post(PATH).set('Authorization', user()).send({ fields: ['provider'] })).status).toBe(403);
	expect((await agent.get('/backoffice/collections/directus_users/indexes').set('Authorization', admin())).status).toBe(
		403,
	);
});

test('POST 202 with the creating row, GET lists it ready with meta, DELETE 204; no cache headers', async () => {
	const agent = await start();

	const created = await agent
		.post(`${PATH}?concurrentIndexCreation=false`)
		.set('Authorization', admin())
		.send({ fields: ['provider', 'provider_subject'], unique: true });
	expect(created.status).toBe(202);
	expect(created.body.data).toMatchObject({
		name: 'articles_provider_provider_subject_unique',
		fields: ['provider', 'provider_subject'],
		status: 'creating',
		missing: null,
	});
	await Promise.all([...running]);

	const listed = await agent.get(PATH).set('Authorization', admin());
	expect(listed.status).toBe(200);
	expect(listed.body.data[0]).toMatchObject({ status: 'ready', missing: false });
	expect(listed.body.meta).toEqual({ trigram: false, concurrent: false });
	// res.locals.cache = false: the respond middleware answers no-cache instead of the shared-cache headers.
	expect(listed.headers['cache-control']).toBe('no-cache');

	const invalid = await agent.post(PATH).set('Authorization', admin()).send({ fields: 'provider' });
	expect(invalid.status).toBe(400);
	expect(invalid.body.errors[0].extensions.code).toBe('INVALID_PAYLOAD');

	expect(
		(await agent.delete(`${PATH}/articles_provider_provider_subject_unique`).set('Authorization', admin())).status,
	).toBe(204);
	expect((await agent.get(PATH).set('Authorization', admin())).body.data).toEqual([]);

});

test('wantsConcurrent is on unless the query says false', () => {
	expect(wantsConcurrent({ query: {} } as never)).toBe(true);
	expect(wantsConcurrent({ query: { concurrentIndexCreation: 'true' } } as never)).toBe(true);
	expect(wantsConcurrent({ query: { concurrentIndexCreation: 'false' } } as never)).toBe(false);
});
