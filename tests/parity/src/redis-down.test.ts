// FR-025 (startup part): the API does not check Redis at startup and does not stop when Redis is unreachable.
// The rate limiter and health parts with Redis down live in server/errors.test.ts and server/health.test.ts.
import getPort from 'get-port';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { compose } from './docker.js';
import { getDbsToTest } from './get-dbs-to-test.js';
import { type RunningApi, hostDbEnv, runApi, stopApi, waitForPing } from './startup/run-api.js';

const [vendor] = getDbsToTest();
let api: RunningApi;
let port: number;

beforeAll(async () => {
	compose('stop', 'redis');
	port = await getPort();

	api = runApi({
		...hostDbEnv(vendor!),
		PORT: String(port),
		REDIS: 'redis://127.0.0.1:6108',
		CACHE_ENABLED: 'true',
		CACHE_STORE: 'redis',
		RATE_LIMITER_ENABLED: 'false',
	});
}, 60_000);

afterAll(async () => {
	await stopApi(api);
	compose('start', 'redis');
});

test('starts and answers pong while Redis is down', async () => {
	expect(await waitForPing(api, port), api.output()).toBe(true);
	expect(api.output()).toContain('Server started at');
});
