// /items end to end (pipeline, authenticate, collectionExists, ItemsService) on the SQLite auth test database
// (feature 005, T011). Directus has no test for controllers/items.ts; parity is checked by tests/parity/src/items.
import * as env from '@backoffice/env';
import { createInspector } from '@backoffice/schema';
import jwt from 'jsonwebtoken';
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
const ADMIN = 'd0000000-0000-4000-8000-000000000009';
const USER = 'd0000000-0000-4000-8000-000000000001';
const USER_POLICY = 'b0000000-0000-4000-8000-000000000001';

let app: App;

async function start() {
	vi.mocked(env.useEnv).mockReturnValue({ ...defaults, SECRET });
	app = await createApp();
	return request(app.express);
}

const token = (id: string) =>
	`Bearer ${jwt.sign({ id, role: null, app_access: false, admin_access: false }, SECRET, { issuer: 'directus' })}`;

const admin = () => token(ADMIN);

beforeEach(async () => {
	state.db = await createAuthDb();

	await state.db.schema.createTable('articles', (t) => {
		t.increments('id');
		t.string('title');
		t.string('status').defaultTo('draft');
	});

	await state.db.schema.createTable('home', (t) => {
		t.increments('id');
		t.string('headline').defaultTo('Welcome');
	});

	await state.db('directus_collections').insert([{ collection: 'articles' }, { collection: 'home', singleton: true }]);
	await state.db('articles').insert([
		{ title: 'a', status: 'published' },
		{ title: 'b', status: 'draft' },
	]);

	const adminPolicy = 'b0000000-0000-4000-8000-000000000009';
	await state.db('directus_policies').insert([
		{ id: adminPolicy, name: 'Admin', admin_access: true, app_access: true },
		{ id: USER_POLICY, name: 'Writer', admin_access: false, app_access: false },
	]);
	await state.db('directus_users').insert([
		{ id: ADMIN, email: 'admin@example.com' },
		{ id: USER, email: 'user@example.com' },
	]);
	await state.db('directus_access').insert([
		{ id: 'c0000000-0000-4000-8000-000000000009', user: ADMIN, policy: adminPolicy },
		{ id: 'c0000000-0000-4000-8000-000000000001', user: USER, policy: USER_POLICY },
	]);
});

afterEach(async () => {
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

const forbiddenCollection = (collection: string) =>
	`You don't have permission to access collection "${collection}" or it does not exist. Queried in root.`;

describe('collections that do not answer', () => {
	test('unknown collection: 403 from collectionExists at every route, before validateBatch', async () => {
		const agent = await start();

		const responses = [
			await agent.get('/items/nope').set('Authorization', admin()),
			await agent.get('/items/nope/1').set('Authorization', admin()),
			await agent.post('/items/nope').set('Authorization', admin()).send({}),
			await agent.search('/items/nope').set('Authorization', admin()),
			await agent.patch('/items/nope').set('Authorization', admin()).send({}),
			await agent.patch('/items/nope/1').set('Authorization', admin()).send({}),
			await agent.delete('/items/nope').set('Authorization', admin()).send({}),
			await agent.delete('/items/nope/1').set('Authorization', admin()),
			await agent.get('/items/Articles').set('Authorization', admin()),
		];

		for (const res of responses) {
			expect(res.status).toBe(403);
			expect(res.body.errors[0].message).toMatch(/^You don't have permission to access collection "(nope|Articles)"/);
		}

		expect(responses[0]!.body.errors[0].message).toBe(forbiddenCollection('nope'));
	});

	test('system collection: 403 FORBIDDEN, after validateBatch for SEARCH and batch PATCH and DELETE', async () => {
		const agent = await start();

		for (const res of [
			await agent.get('/items/directus_users').set('Authorization', admin()),
			await agent.get(`/items/directus_users/${ADMIN}`).set('Authorization', admin()),
			await agent.post('/items/directus_users').set('Authorization', admin()).send({}),
			await agent
				.patch('/items/directus_users')
				.set('Authorization', admin())
				.send({ keys: [ADMIN], data: {} }),
			await agent.delete(`/items/directus_users/${ADMIN}`).set('Authorization', admin()),
		]) {
			expect(res.status).toBe(403);
			expect(res.body.errors[0]).toEqual({
				message: "You don't have permission to access this.",
				extensions: { code: 'FORBIDDEN' },
			});
		}

		const invalid = await agent.patch('/items/directus_users').set('Authorization', admin()).send({});
		expect(invalid.status).toBe(400);
		expect(invalid.body.errors[0].extensions.code).toBe('INVALID_PAYLOAD');
	});

	test('/items and three segments: 404 ROUTE_NOT_FOUND', async () => {
		const agent = await start();

		for (const path of ['/items', '/items/articles/1/x']) {
			const res = await agent.get(path).set('Authorization', admin());
			expect(res.status).toBe(404);
			expect(res.body.errors[0].extensions.code).toBe('ROUTE_NOT_FOUND');
		}

		// The path of the Directus router mounted at /items.
		const res = await agent.patch('/ITEMS/home/1').set('Authorization', admin()).send({});
		expect(res.body.errors[0]).toEqual({
			message: "Route /home/1 doesn't exist.",
			extensions: { path: '/home/1', code: 'ROUTE_NOT_FOUND' },
		});
	});
});

describe('CRUD as admin (routes in the order of the Directus router)', () => {
	test('POST one and many: 200 with the items read back by fields', async () => {
		const agent = await start();

		const one = await agent.post('/items/articles?fields=title').set('Authorization', admin()).send({ title: 'c' });
		expect(one.status).toBe(200);
		expect(one.body).toEqual({ data: { title: 'c' } });

		const many = await agent
			.post('/items/articles?fields=title&sort=title')
			.set('Authorization', admin())
			.send([{ title: 'e' }, { title: 'd' }]);

		expect(many.body).toEqual({ data: [{ title: 'd' }, { title: 'e' }] });
		expect(await state.db('directus_activity').where({ collection: 'articles', action: 'create' })).toHaveLength(3);
	});

	test('GET and SEARCH: data and meta; SEARCH reads keys and the query of the body', async () => {
		const agent = await start();

		const list = await agent.get('/items/articles?fields=title&sort=title&meta=*').set('Authorization', admin());
		expect(list.body).toEqual({
			data: [{ title: 'a' }, { title: 'b' }],
			meta: { total_count: 2, filter_count: 2 },
		});

		const keys = await agent
			.search('/items/articles')
			.set('Authorization', admin())
			.send({ keys: [2], query: { fields: ['title'] } });
		expect(keys.body).toEqual({ data: [{ title: 'b' }] });

		const query = await agent
			.search('/items/articles')
			.set('Authorization', admin())
			.send({ query: { fields: ['id'], filter: { status: { _eq: 'published' } } } });
		expect(query.body).toEqual({ data: [{ id: 1 }] });

		// body-parser 1.20.3 (Directus' express.json) sets req.body to {}, so "Payload in body is required" never fires.
		const noBody = await agent.search('/items/articles?fields=title&sort=title').set('Authorization', admin());
		expect(noBody.body).toEqual({ data: [{ title: 'a' }, { title: 'b' }] });
	});

	test('GET /:pk', async () => {
		const agent = await start();
		const res = await agent.get('/items/articles/1?fields=title').set('Authorization', admin());
		expect(res.body).toEqual({ data: { title: 'a' } });
	});

	test('PATCH by array, keys and query; PATCH /:pk; empty batches', async () => {
		const agent = await start();
		const patch = (body: object) =>
			agent.patch('/items/articles?fields=title').set('Authorization', admin()).send(body);

		expect((await patch([{ id: 1, title: 'A' }])).body).toEqual({ data: [{ title: 'A' }] });
		expect((await patch({ keys: [1], data: { title: 'B' } })).body).toEqual({ data: [{ title: 'B' }] });
		expect((await patch({ query: { filter: { id: { _eq: 1 } } }, data: { title: 'C' } })).body).toEqual({
			data: [{ title: 'C' }],
		});

		expect((await patch([])).body).toEqual({ data: [] });
		expect((await patch({ keys: [], data: { title: 'x' } })).body).toEqual({ data: [] });

		const one = await agent.patch('/items/articles/1?fields=title').set('Authorization', admin()).send({ title: 'D' });
		expect(one.body).toEqual({ data: { title: 'D' } });
	});

	test('DELETE by array, keys, query and /:pk: 204', async () => {
		const agent = await start();
		await state.db('articles').insert([{ title: 'x1' }, { title: 'x2' }]);

		const statuses = [
			(await agent.delete('/items/articles').set('Authorization', admin()).send([1])).status,
			(
				await agent
					.delete('/items/articles')
					.set('Authorization', admin())
					.send({ keys: [2] })
			).status,
			(
				await agent
					.delete('/items/articles')
					.set('Authorization', admin())
					.send({ query: { filter: { title: { _eq: 'x1' } } } })
			).status,
			(await agent.delete('/items/articles/4').set('Authorization', admin())).status,
			(await agent.delete('/items/articles').set('Authorization', admin()).send([])).status,
		];

		expect(statuses).toEqual([204, 204, 204, 204, 204]);
		expect(await state.db('articles')).toEqual([]);
	});

	test('wrong key type: 403 from validateKeys', async () => {
		const res = await (await start()).get('/items/articles/abc').set('Authorization', admin());
		expect(res.status).toBe(403);
	});
});

describe('singleton', () => {
	test('GET answers the defaults before the first row; PATCH creates then updates the only row', async () => {
		const agent = await start();

		const empty = await agent.get('/items/home?fields=headline').set('Authorization', admin());
		expect(empty.status).toBe(200);
		expect(empty.body).toEqual({ data: { headline: 'Welcome' } });

		// meta only when the query asks for it, like any list.
		const meta = await agent.get('/items/home?fields=headline&meta=*').set('Authorization', admin());
		expect(meta.body.meta).toEqual({ total_count: 0, filter_count: 0 });

		const created = await agent
			.patch('/items/home?fields=headline')
			.set('Authorization', admin())
			.send({ headline: 'Hello' });
		expect(created.body).toEqual({ data: { headline: 'Hello' } });

		await agent.patch('/items/home').set('Authorization', admin()).send({ headline: 'Again' });
		expect(await state.db('home')).toEqual([{ id: 1, headline: 'Again' }]);
	});

	test('POST /:collection and PATCH /:collection/:pk: 404 ROUTE_NOT_FOUND', async () => {
		const agent = await start();

		for (const res of [
			await agent.post('/items/home').set('Authorization', admin()).send({ headline: 'x' }),
			await agent.patch('/items/home/1').set('Authorization', admin()).send({ headline: 'x' }),
		]) {
			expect(res.status).toBe(404);
			expect(res.body.errors[0].extensions.code).toBe('ROUTE_NOT_FOUND');
		}
	});
});

test('create without read permission: 204 without body', async () => {
	await state.db('directus_permissions').insert({
		collection: 'articles',
		action: 'create',
		fields: '*',
		permissions: '{}',
		policy: USER_POLICY,
	});

	const res = await (await start()).post('/items/articles').set('Authorization', token(USER)).send({ title: 'u' });

	expect(res.status).toBe(204);
	expect(res.text).toBe('');
	expect(await state.db('articles').where({ title: 'u' })).toHaveLength(1);
});
