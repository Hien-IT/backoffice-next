// FR-025 (startup part): the API does not check Redis at startup and does not stop when Redis is unreachable.
// The rate limiter and health parts with Redis down live in server/errors.test.ts and server/health.test.ts.
// Feature 004, FR-085: with Redis down, a request that needs permissions and a permission write answer like Directus.
// The permissions cache keeps an entry in the memory of the process that wrote it last (CacheMulti tells the other
// processes to drop it), so each app is measured in the same state: shared caches emptied, then a request of that
// app only, then Redis down.
import getPort from 'get-port';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeHostDb, hostDb } from './auth/db-effects.js';
import { adminToken, type AppName, appUrl } from './directus-api.js';
import { redisDown, redisUp } from './docker.js';
import { capture, type Captured } from './parity.js';
import { cleanup, createPolicy, createRoleTree, createUser, type TestUser } from './permissions/fixtures.js';
import { closeRedis, flushSharedCaches } from './redis.js';
import { compose } from './docker.js';
import { getDbsToTest } from './get-dbs-to-test.js';
import { type RunningApi, hostDbEnv, runApi, stopApi, waitForPing } from './startup/run-api.js';

const [vendor] = getDbsToTest();
describe('startup with Redis down (FR-025)', () => {
	let api: RunningApi;
	let port: number;

	beforeAll(async () => {
		// Before Redis stops: hostDbEnv throws for the vendors it does not support yet, which must leave Redis running.
		const dbEnv = hostDbEnv(vendor!);
		compose('stop', 'redis');
		port = await getPort();

		api = runApi({
			...dbEnv,
			PORT: String(port),
			REDIS: 'redis://127.0.0.1:6108',
			CACHE_ENABLED: 'true',
			CACHE_STORE: 'redis',
			RATE_LIMITER_ENABLED: 'false',
		});
	}, 60_000);

	afterAll(async () => {
		if (api) await stopApi(api);
		compose('start', 'redis');
		// The apps reconnect before the next describe writes fixtures through them.
		await new Promise((resolve) => setTimeout(resolve, 5000));
	}, 30_000);

	// Feature 009: like Directus 11.17.4 (measured 2026-10-14 with `node cli.js start`, spec 001 FR-025), the process
	// exits once the Redis client gives up a command of the startup (the flows are loaded with the schema, whose lock is
	// in Redis): ioredis MaxRetriesPerRequestError after 20 attempts, exit code 1, never "Server started".
	test('exits with code 1 like Directus while Redis is down', async () => {
		expect(await waitForPing(api, port, 60_000), api.output()).toBe(false);
		const { code } = await api.exited;
		expect(code, api.output()).toBe(1);
		expect(api.output()).toContain('MaxRetriesPerRequestError');
		expect(api.text()).not.toContain('Server started at');
	}, 90_000);
});

describe('FR-085: permissions with Redis down', () => {
	let user: TestUser;
	let policy: string;
	const tokens: Partial<Record<AppName, string>> = {};

	beforeAll(async () => {
		const { leaf } = await createRoleTree('directus', 'parity-redis-down');
		user = await createUser('directus', 'parity-redis-down', { role: leaf });
		policy = await createPolicy('directus', 'parity-redis-down');
		for (const app of ['directus', 'backoffice'] as const) tokens[app] = await adminToken(app);
	}, 60_000);

	afterAll(async () => {
		await cleanup();
		await closeHostDb();
		await closeRedis();
	}, 60_000);

	async function measure(app: AppName): Promise<{ read: Captured; write: Captured }> {
		const url = appUrl(app);
		const read = () =>
			capture(url, { path: '/roles?fields=id', headers: { authorization: `Bearer ${user.token}` }, timeoutMs: 15_000 });

		await flushSharedCaches();
		await read();
		// The admin's entries too (roles tree, global access, policies), as the user's: both requests warm at this app.
		await capture(url, { path: '/permissions?limit=1', headers: { authorization: `Bearer ${tokens[app]}` } });

		redisDown();

		try {
			return {
				read: await read(),
				write: await capture(url, {
					method: 'POST',
					path: '/permissions',
					body: { policy, collection: 'directus_roles', action: 'read', fields: [app] },
					headers: { authorization: `Bearer ${tokens[app]}` },
					timeoutMs: 20_000,
				}),
			};
		} finally {
			await redisUp();
			await new Promise((resolve) => setTimeout(resolve, 3000));
		}
	}

	test('a warm read and a permission write: same status and code at both apps, the same rows kept', async () => {
		const directus = await measure('directus');
		const backoffice = await measure('backoffice');
		const code = (c: Captured) => (c.json as any)?.errors?.[0]?.extensions?.code;

		expect([backoffice.read.status, code(backoffice.read)]).toEqual([directus.read.status, code(directus.read)]);
		expect([backoffice.write.status, code(backoffice.write)]).toEqual([directus.write.status, code(directus.write)]);

		// Each app wrote its own row (fields = its name): the row is there for both or for neither.
		const fields = (await hostDb()('directus_permissions').where({ policy }).select('fields')).map((r) =>
			String(r.fields),
		);
		expect(
			fields.some((f) => f.includes('backoffice')),
			JSON.stringify(fields),
		).toBe(fields.some((f) => f.includes('directus')));
	}, 180_000);
});
