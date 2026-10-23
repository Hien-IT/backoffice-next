// Feature 006 (T036): the /schema controller (port of directus/api/src/controllers/schema.ts, which DR does not
// unit test) through the real app pipeline on SQLite, with SchemaService mocked: the JSON and multipart bodies of
// schemaMultipartHandler and their errors, the two readings of `force`, 204 when there is no difference.
import * as env from '@backoffice/env';
import { ForbiddenError } from '@backoffice/errors';
import { createInspector } from '@backoffice/schema';
import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ADMIN, createDataModelDb, SECRET, startApp, token } from '../../test/data-model-app.js';
import type { App } from '../app.js';
import { clearSystemCache } from '../cache.js';

const state = vi.hoisted(() => ({ db: undefined as unknown as Knex }));

const service = vi.hoisted(() => ({
	snapshot: vi.fn(),
	diff: vi.fn(),
	apply: vi.fn(),
}));

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

vi.mock('../services/schema.service.js', () => ({
	SchemaService: vi.fn(function (this: unknown, options: unknown) {
		return Object.assign(Object.create(service), { options });
	}),
}));

vi.mock('../logger/index.js', () => {
	const logger = { warn: vi.fn(), debug: vi.fn(), error: vi.fn(), info: vi.fn(), fatal: vi.fn(), trace: vi.fn() };
	return {
		useLogger: () => logger,
		createExpressLogger: () => (_req: unknown, _res: unknown, next: () => void) => next(),
	};
});

const defaults = (await vi.importActual<typeof env>('@backoffice/env')).useEnv();
const admin = () => token(ADMIN);
let app: App;

async function agent() {
	vi.mocked(env.useEnv).mockReturnValue({ ...defaults, SECRET });
	const started = await startApp();
	app = started.app;
	return started.agent;
}

beforeEach(async () => {
	state.db = await createDataModelDb();
	for (const fn of Object.values(service)) fn.mockReset();
});

afterEach(async () => {
	await app?.nest.close();
	await state.db.destroy();
	await clearSystemCache();
});

const current = {
	version: 1,
	directus: '11.17.4',
	vendor: 'sqlite',
	collections: [],
	fields: [],
	systemFields: [],
	relations: [],
};
const diff = { collections: [{ collection: 'a', diff: [] }], fields: [], systemFields: [], relations: [] };

describe('/schema', () => {
	test('GET /snapshot: the snapshot of the service as data', async () => {
		service.snapshot.mockResolvedValue(current);
		const http = await agent();

		const res = await http.get('/schema/snapshot').set('Authorization', admin());
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ data: current });
	});

	test('POST /diff with JSON: hash of the current snapshot and the diff; 204 without difference; force by presence', async () => {
		service.snapshot.mockResolvedValue(current);
		service.diff.mockResolvedValue(diff);
		const http = await agent();

		const res = await http.post('/schema/diff').set('Authorization', admin()).send(current);
		expect(res.status).toBe(200);
		expect(res.body.data.diff).toEqual(diff);
		expect(res.body.data.hash).toMatch(/^[0-9a-f]{40}$/);
		expect(service.diff).toHaveBeenCalledWith(current, { currentSnapshot: current, force: false });

		await http.post('/schema/diff?force=false').set('Authorization', admin()).send(current);
		expect(service.diff).toHaveBeenLastCalledWith(current, { currentSnapshot: current, force: true });

		service.diff.mockResolvedValue(null);
		expect((await http.post('/schema/diff').set('Authorization', admin()).send(current)).status).toBe(204);
	});

	test('multipart: one JSON file by its mimetype, any other mimetype as YAML; errors', async () => {
		service.snapshot.mockResolvedValue(current);
		service.diff.mockResolvedValue(diff);
		const http = await agent();
		const post = () => http.post('/schema/diff').set('Authorization', admin());

		const json = await post().attach('file', Buffer.from(JSON.stringify(current)), {
			filename: 's.json',
			contentType: 'application/json',
		});
		expect(json.status).toBe(200);
		expect(service.diff).toHaveBeenLastCalledWith(current, expect.any(Object));

		const yaml = await post().attach('file', Buffer.from('version: 1\ndirectus: 11.17.4\n'), {
			filename: 's.yaml',
			contentType: 'text/yaml',
		});
		expect(yaml.status).toBe(200);
		expect(service.diff).toHaveBeenLastCalledWith({ version: 1, directus: '11.17.4' }, expect.any(Object));

		const reasons = async (res: { status: number; body: any }) => [res.status, res.body.errors[0].extensions.reason];

		expect(
			await reasons(
				await post().attach('file', Buffer.from('{bad'), { filename: 's.json', contentType: 'application/json' }),
			),
		).toEqual([400, 'The provided JSON is invalid']);
		expect(
			await reasons(
				await post().attach('file', Buffer.from('a: [b'), { filename: 's.yaml', contentType: 'text/yaml' }),
			),
		).toEqual([400, 'The provided YAML is invalid']);
		expect(await reasons(await post().field('x', 'y'))).toEqual([400, 'No file was included in the body']);
		expect(await reasons(await post().send({}))).toEqual([400, 'No data was included in the body']);

		const text = await post().set('Content-Type', 'text/plain').send('x');
		expect(text.status).toBe(415);
		expect(text.body.errors[0].extensions.code).toBe('UNSUPPORTED_MEDIA_TYPE');
	});

	test('POST /apply: 204, force through toBoolean; service errors keep their status', async () => {
		const http = await agent();
		const payload = { hash: 'abc', diff };

		const res = await http.post('/schema/apply?force=false').set('Authorization', admin()).send(payload);
		expect(res.status).toBe(204);
		expect(service.apply).toHaveBeenCalledWith(payload, { force: false });

		await http.post('/schema/apply?force=true').set('Authorization', admin()).send(payload);
		expect(service.apply).toHaveBeenLastCalledWith(payload, { force: true });

		service.apply.mockRejectedValue(new ForbiddenError());
		expect((await http.post('/schema/apply').set('Authorization', admin()).send(payload)).status).toBe(403);
	});
});
