import { useEnv } from '@backoffice/env';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getCache } from '../cache.js';
import getDatabase, { hasDatabaseConnection } from '../database/index.js';
import { useLogger } from '../logger/index.js';
import { rateLimiterGlobal } from '../middleware/rate-limiter-global.js';
import { rateLimiter } from '../middleware/rate-limiter-ip.js';
import * as server from '../server.js';
import { getStorage } from '../storage/index.js';
import { ServerService } from './server.service.js';

vi.mock('@backoffice/env');
vi.mock('../cache.js');
vi.mock('../database/index.js');
vi.mock('../logger/index.js');
vi.mock('../storage/index.js');
vi.mock('../server.js', () => ({ SERVER_ONLINE: true }));
vi.mock('../middleware/rate-limiter-global.js', () => ({ rateLimiterGlobal: { consume: vi.fn(), delete: vi.fn() } }));
vi.mock('../middleware/rate-limiter-ip.js', () => ({ rateLimiter: { consume: vi.fn(), delete: vi.fn() } }));
vi.mock('./settings.service.js', () => ({
	SettingsService: vi.fn(function () {
		return { readProjectInfo: async () => ({ project_name: 'P' }) };
	}),
}));

const logger = { warn: vi.fn(), error: vi.fn() };
const write = vi.fn();
const cache = { set: vi.fn(), delete: vi.fn() };

function knexWithUsers(hasUser: boolean) {
	const db: any = vi.fn(() => ({ first: async () => (hasUser ? { id: 'u' } : undefined) }));
	db.client = { pool: { numFree: () => 3, numUsed: () => 1 } };
	return db;
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(useLogger).mockReturnValue(logger as any);
	vi.mocked(getDatabase).mockReturnValue(knexWithUsers(true));
	vi.mocked(hasDatabaseConnection).mockResolvedValue(true);
	vi.mocked(getCache).mockReturnValue({ cache } as any);
	vi.mocked(getStorage).mockResolvedValue({ location: () => ({ write }) } as any);
	vi.mocked(useEnv).mockReturnValue({ DB_CLIENT: 'pg', PUBLIC_URL: 'http://x', STORAGE_LOCATIONS: 's3' });
	vi.mocked(server).SERVER_ONLINE = true;
});

describe('serverInfo (public)', () => {
	test('project and setupCompleted; no version once a user exists', async () => {
		expect(await new ServerService({ knex: knexWithUsers(true) }).serverInfo()).toEqual({
			project: { project_name: 'P' },
			setupCompleted: true,
		});
	});

	test('version 11.17.4 before setup (FR-047)', async () => {
		expect(await new ServerService({ knex: knexWithUsers(false) }).serverInfo()).toEqual({
			project: { project_name: 'P' },
			setupCompleted: false,
			version: '11.17.4',
		});
	});
});

describe('health', () => {
	test('all ok → {status: ok} for non-admins; email:connection always ok (D-07)', async () => {
		expect(await new ServerService({}).health()).toEqual({ status: 'ok' });

		const admin = await new ServerService({ accountability: { admin: true } as any }).health();
		expect(admin).toMatchObject({ status: 'ok', releaseId: '11.17.4', serviceId: 'http://x' });
		expect(admin['checks']['email:connection']).toEqual([{ status: 'ok', componentType: 'email' }]);
		expect(admin['checks']['pg:connectionsAvailable'][0].observedValue).toBe(3);
		expect(write).toHaveBeenCalledWith('directus-health-file', expect.anything());
	});

	test('database down → error, logged', async () => {
		vi.mocked(hasDatabaseConnection).mockResolvedValue(false);
		expect(await new ServerService({}).health()).toEqual({ status: 'error' });
		expect(logger.error).toHaveBeenCalledWith("Can't connect to the database.", '%s in ERROR state', 'pg:responseTime');
	});

	test('threshold exceeded → warn, logged', async () => {
		vi.mocked(useEnv).mockReturnValue({ DB_CLIENT: 'pg', DB_HEALTHCHECK_THRESHOLD: 0.000001, STORAGE_LOCATIONS: '' });
		vi.mocked(hasDatabaseConnection).mockImplementation(async () => (await new Promise((r) => setTimeout(r, 2)), true));
		expect(await new ServerService({}).health()).toEqual({ status: 'warn' });
		expect(logger.warn.mock.calls[0]![0]).toMatch(
			/^pg:responseTime in WARN state, the observed value [\d.]+ is above the threshold of .+ms$/,
		);
	});

	test('cache, rate limiters and storage checks when enabled; their errors make the status error', async () => {
		vi.mocked(useEnv).mockReturnValue({
			DB_CLIENT: 'pg',
			CACHE_ENABLED: true,
			RATE_LIMITER_ENABLED: true,
			RATE_LIMITER_GLOBAL_ENABLED: true,
			STORAGE_LOCATIONS: 's3',
			STORAGE_S3_HEALTHCHECK_THRESHOLD: 100000,
			CACHE_HEALTHCHECK_THRESHOLD: 100000,
			RATE_LIMITER_HEALTHCHECK_THRESHOLD: 100000,
			RATE_LIMITER_GLOBAL_HEALTHCHECK_THRESHOLD: 100000,
		});

		const data = await new ServerService({ accountability: { admin: true } as any }).health();
		expect(Object.keys(data['checks'])).toEqual(
			expect.arrayContaining([
				'cache:responseTime',
				'rateLimiter:responseTime',
				'rateLimiterGlobal:responseTime',
				'storage:s3:responseTime',
			]),
		);
		expect(cache.set).toHaveBeenCalledWith(expect.stringMatching(/^directus-health-.{5}$/), true, 5);
		expect(rateLimiter.consume).toHaveBeenCalled();
		expect(rateLimiterGlobal.delete).toHaveBeenCalled();
		expect(data['status']).toBe('ok');

		for (const failing of [
			() => cache.set.mockRejectedValueOnce(new Error('redis')),
			() => vi.mocked(rateLimiter.consume).mockRejectedValueOnce(new Error('redis')),
			() => vi.mocked(rateLimiterGlobal.consume).mockRejectedValueOnce(new Error('redis')),
			() => write.mockRejectedValueOnce(new Error('s3')),
		]) {
			failing();
			expect(await new ServerService({}).health()).toEqual({ status: 'error' });
		}
	});

	test('low thresholds on cache, rate limiters and storage → warn', async () => {
		vi.mocked(useEnv).mockReturnValue({
			DB_CLIENT: 'pg',
			CACHE_ENABLED: true,
			RATE_LIMITER_ENABLED: true,
			RATE_LIMITER_GLOBAL_ENABLED: true,
			STORAGE_LOCATIONS: 's3',
			STORAGE_S3_HEALTHCHECK_THRESHOLD: 0.000001,
			CACHE_HEALTHCHECK_THRESHOLD: 0.000001,
			RATE_LIMITER_HEALTHCHECK_THRESHOLD: 0.000001,
			RATE_LIMITER_GLOBAL_HEALTHCHECK_THRESHOLD: 0.000001,
		});

		const slow = async () => void (await new Promise((r) => setTimeout(r, 2)));
		cache.set.mockImplementation(slow);
		vi.mocked(rateLimiter.consume).mockImplementation(slow as any);
		vi.mocked(rateLimiterGlobal.consume).mockImplementation(slow as any);
		write.mockImplementation(slow);

		const data = await new ServerService({ accountability: { admin: true } as any }).health();
		expect(data['status']).toBe('warn');

		for (const key of [
			'cache:responseTime',
			'rateLimiter:responseTime',
			'rateLimiterGlobal:responseTime',
			'storage:s3:responseTime',
		]) {
			expect(data['checks'][key][0].status).toBe('warn');
		}
	});

	test('server shutting down (SERVER_ONLINE=false) → error', async () => {
		vi.mocked(server).SERVER_ONLINE = false;
		expect(await new ServerService({}).health()).toEqual({ status: 'error' });
	});
});

describe('serverInfo (logged-in user)', () => {
	const env = {
		QUERY_LIMIT_DEFAULT: 100,
		QUERY_LIMIT_MAX: Infinity,
		FILES_MIME_TYPE_ALLOW_LIST: '*/*',
		FILES_MAX_UPLOAD_CONCURRENCY: Infinity,
		RATE_LIMITER_ENABLED: true,
		RATE_LIMITER_POINTS: 50,
		RATE_LIMITER_DURATION: 1,
	};

	test('limits, files, extensions and websocket flags, then version', async () => {
		vi.mocked(useEnv).mockReturnValue(env);

		const info = await new ServerService({
			knex: knexWithUsers(true),
			accountability: { user: 'u', admin: false } as any,
		}).serverInfo();

		expect(info).toEqual({
			project: { project_name: 'P' },
			setupCompleted: true,
			mcp_enabled: true,
			ai_enabled: true,
			files: { mimeTypeAllowList: ['*/*'] },
			rateLimit: { points: 50, duration: 1 },
			rateLimitGlobal: false,
			extensions: { limit: null },
			queryLimit: { default: 100, max: -1 },
			websocket: false,
			version: '11.17.4',
		});
	});

	test('websocket logs for admins only; upload concurrency and TUS', async () => {
		vi.mocked(useLogger).mockReturnValue({ levels: { values: { info: 30, error: 50, debug: 20 } } } as any);

		vi.mocked(useEnv).mockReturnValue({
			...env,
			WEBSOCKETS_ENABLED: true,
			WEBSOCKETS_REST_ENABLED: true,
			WEBSOCKETS_REST_AUTH: 'handshake',
			WEBSOCKETS_REST_PATH: '/websocket',
			WEBSOCKETS_HEARTBEAT_ENABLED: true,
			WEBSOCKETS_HEARTBEAT_PERIOD: 30,
			WEBSOCKETS_LOGS_ENABLED: true,
			FILES_MAX_UPLOAD_CONCURRENCY: 5,
			TUS_ENABLED: true,
			TUS_CHUNK_SIZE: '8mb',
		});

		const read = (admin: boolean) =>
			new ServerService({ knex: knexWithUsers(true), accountability: { user: 'u', admin } as any }).serverInfo();

		const admin = await read(true);

		expect(admin['websocket']).toEqual({
			rest: { authentication: 'handshake', path: '/websocket' },
			graphql: false,
			heartbeat: 30,
			collaborativeEditing: false,
			logs: { allowedLogLevels: { info: 30, error: 50 } },
		});

		expect(admin['uploads']).toEqual({ maxConcurrency: 5, tus: true, chunkSize: 8_388_608 });
		expect((await read(false))['websocket'].logs).toBe(false);
	});
});
