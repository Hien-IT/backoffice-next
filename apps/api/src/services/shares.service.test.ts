// Feature 010 (T027): SharesService (port of directus/api/src/services/shares.ts, which DR does not unit test).
// login runs on an in-memory SQLite with directus_shares and directus_sessions; createOne, updateMany, deleteMany and
// invite with the item service, the permission checks and the cache mocked.
import { ForbiddenError } from '@backoffice/errors';
import { SchemaBuilder } from '@backoffice/schema-builder';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import knex, { type Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearCache } from '../permissions/cache.js';
import { validateAccess } from '../permissions/modules/validate-access/validate-access.js';
import { ItemsService } from './items.service.js';
import { SharesService } from './shares.service.js';
import { UsersService } from './users.service.js';

const logger = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), info: vi.fn() }));

// services/shares.ts reads the env when it is imported, like DR.
const env = vi.hoisted(() => ({
	SECRET: 'test-secret',
	ACCESS_TOKEN_TTL: '15m',
	SESSION_COOKIE_TTL: '1d',
	REFRESH_TOKEN_TTL: '7d',
	PUBLIC_URL: 'http://example.com',
}));

vi.mock('@backoffice/env', () => ({ useEnv: () => env }));
vi.mock('../logger/index.js', () => ({ useLogger: () => logger }));
vi.mock('../cache.js', () => ({ getCache: () => ({ cache: undefined }) }));
vi.mock('../permissions/cache.js', () => ({ clearCache: vi.fn() }));
vi.mock('../permissions/modules/validate-access/validate-access.js', () => ({ validateAccess: vi.fn() }));
vi.mock('./users.service.js', () => ({ UsersService: vi.fn() }));

const SECRET = 'test-secret';
const schema = new SchemaBuilder().collection('directus_shares', (c) => c.field('id').uuid().primary()).build();

let db: Knex;
const now = Date.now();
const iso = (offset: number) => new Date(now + offset);

beforeEach(async () => {
	db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
	await db.schema.createTable('directus_shares', (t) => {
		t.uuid('id').primary();
		t.string('collection');
		t.string('item');
		t.string('password');
		t.dateTime('date_start');
		t.dateTime('date_end');
		t.integer('times_used').defaultTo(0);
		t.integer('max_uses');
	});
	await db.schema.createTable('directus_sessions', (t) => {
		t.string('token').primary();
		t.dateTime('expires');
		t.string('ip');
		t.string('user_agent');
		t.string('origin');
		t.uuid('share');
		t.uuid('user');
	});
});

afterEach(async () => {
	vi.clearAllMocks();
	vi.restoreAllMocks();
	await db.destroy();
});

const service = (accountability: any = null) => new SharesService({ knex: db, schema, accountability });

describe('login (spec FR-041)', () => {
	test('a share without password: JWT of the share, a session row, times_used + 1, expired sessions removed', async () => {
		await db('directus_shares').insert({ id: 's1', collection: 'posts', item: '1' });
		await db('directus_sessions').insert({ token: 'old', expires: iso(-1000) });

		const result = await service().login({ share: 's1' });

		expect(jwt.verify(result.accessToken, SECRET)).toMatchObject({
			app_access: false,
			admin_access: false,
			role: null,
			share: 's1',
			iss: 'directus',
		});
		expect((jwt.decode(result.accessToken) as any).session).toBeUndefined();
		expect(result.refreshToken).toMatch(/^[\w-]{64}$/);
		expect(result.expires).toBe(15 * 60 * 1000);

		expect((await db('directus_shares').first()).times_used).toBe(1);
		const sessions = await db('directus_sessions').select('token', 'share', 'ip');
		expect(sessions).toEqual([{ token: result.refreshToken, share: 's1', ip: null }]);
	});

	test('session mode: the session token in the JWT, the TTL of SESSION_COOKIE_TTL', async () => {
		await db('directus_shares').insert({ id: 's1', collection: 'posts', item: '1' });

		const result = await service().login({ share: 's1' }, { session: true });

		expect((jwt.decode(result.accessToken) as any).session).toBe(result.refreshToken);
		expect(result.expires).toBe(24 * 60 * 60 * 1000);
	});

	test.each([
		['an unknown share', {}, { share: 'nope' }],
		['an ended share', { date_end: iso(-60_000) }, { share: 's1' }],
		['a share not started yet', { date_start: iso(60_000) }, { share: 's1' }],
		['max_uses below times_used', { max_uses: 1, times_used: 2 }, { share: 's1' }],
	])('%s → INVALID_CREDENTIALS, nothing written', async (_label, row, payload) => {
		await db('directus_shares').insert({ id: 's1', collection: 'posts', item: '1', ...row });

		await expect(service().login(payload)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
		expect(await db('directus_sessions').count({ n: '*' }).first()).toMatchObject({ n: 0 });
	});

	test('R-25: max_uses = times_used still logs in (the check comes before the increment)', async () => {
		await db('directus_shares').insert({ id: 's1', collection: 'posts', item: '1', max_uses: 1, times_used: 1 });

		await expect(service().login({ share: 's1' })).resolves.toBeDefined();
		expect((await db('directus_shares').first()).times_used).toBe(2);
	});

	test('password: wrong → INVALID_CREDENTIALS; right → logged in; missing → argon2 throws (R-29)', async () => {
		await db('directus_shares').insert({ id: 's1', collection: 'posts', item: '1', password: await argon2.hash('pw') });

		await expect(service().login({ share: 's1', password: 'bad' })).rejects.toMatchObject({
			code: 'INVALID_CREDENTIALS',
		});
		await expect(service().login({ share: 's1', password: 'pw' })).resolves.toBeDefined();
		await expect(service().login({ share: 's1' })).rejects.toBeInstanceOf(TypeError);
	});
});

describe('writes (spec FR-040)', () => {
	test('createOne checks the share action on the item when there is an accountability', async () => {
		const create = vi.spyOn(ItemsService.prototype, 'createOne').mockResolvedValue('s1');
		const accountability = { user: 'u1', role: null, admin: false } as any;

		await service(accountability).createOne({ collection: 'posts', item: '7' });
		expect(validateAccess).toHaveBeenCalledWith(
			{ accountability, action: 'share', collection: 'posts', primaryKeys: ['7'] },
			{ schema, knex: db },
		);

		vi.mocked(validateAccess).mockRejectedValueOnce(new ForbiddenError());
		await expect(service(accountability).createOne({ collection: 'posts', item: '8' })).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		expect(create).toHaveBeenCalledOnce();

		await service().createOne({ collection: 'posts', item: '9' });
		expect(validateAccess).toHaveBeenCalledTimes(2);
	});

	test('updateMany and deleteMany clear the permissions cache before writing', async () => {
		const order: string[] = [];
		vi.mocked(clearCache).mockImplementation(async () => void order.push('clear'));
		vi.spyOn(ItemsService.prototype, 'updateMany').mockImplementation(async () => (order.push('update'), ['s1']));
		vi.spyOn(ItemsService.prototype, 'deleteMany').mockImplementation(async () => (order.push('delete'), ['s1']));

		await service().updateMany(['s1'], { max_uses: 3 });
		await service().deleteMany(['s1']);

		expect(order).toEqual(['clear', 'update', 'clear', 'delete']);
	});
});

describe('invite (spec FR-044, D-36)', () => {
	test('no user → 403', async () => {
		await expect(service({ user: null, role: null }).invite({ share: 's1', emails: ['a@b.c'] })).rejects.toBeInstanceOf(
			ForbiddenError,
		);
	});

	test('one warning line per address with the subject of Directus, no mail', async () => {
		vi.spyOn(ItemsService.prototype, 'readOne').mockResolvedValue({ collection: 'posts' });
		vi.mocked(UsersService).mockImplementation(function () {
			return { readOne: async () => ({ first_name: 'Ann', last_name: 'Lee', email: 'ann@example.com' }) } as any;
		});

		await service({ user: 'u1', role: null }).invite({ share: 's1', emails: ['a@example.com', 'b@example.com'] });

		expect(logger.warn.mock.calls.map((call) => call[0])).toEqual([
			'Backoffice: mail sending is out of scope; share invitation "Ann Lee has shared an item with you" for a@example.com not sent',
			'Backoffice: mail sending is out of scope; share invitation "Ann Lee has shared an item with you" for b@example.com not sent',
		]);
	});

	test('a share the user cannot read → the error of readOne', async () => {
		vi.spyOn(ItemsService.prototype, 'readOne').mockRejectedValue(new ForbiddenError());

		await expect(service({ user: 'u1', role: null }).invite({ share: 's1', emails: ['a@b.c'] })).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		expect(logger.warn).not.toHaveBeenCalled();
	});
});
