// Feature 002, US4.1 and US4.4: CACHE_SCHEMA=false builds the schema on every request without the shared lock or
// bus; CACHE_SCHEMA_FREEZE_ENABLED=true serves the frozen schema and the routes still answer like Directus. The API
// runs on the host (run-api.ts) with the env of the parity Directus plus the variable under test.
import getPort from 'get-port';
import { afterAll, describe, expect, it } from 'vitest';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { closeRedis, traceRedis } from '../redis.js';
import { type RunningApi, hostDbEnv, runApi, stopApi, waitForPing } from './run-api.js';

const [vendor] = getDbsToTest();
const supported = vendor === 'postgres' || vendor === 'sqlite3';

async function startApi(extra: Record<string, string>): Promise<{ api: RunningApi; url: string }> {
	const port = await getPort();

	const api = runApi({
		...hostDbEnv(vendor!),
		PORT: String(port),
		PUBLIC_URL: 'http://localhost:8155',
		REDIS: 'redis://127.0.0.1:6108',
		CACHE_STORE: 'redis',
		RATE_LIMITER_ENABLED: 'false',
		...extra,
	});

	expect(await waitForPing(api, port), api.output()).toBe(true);
	return { api, url: `http://127.0.0.1:${port}` };
}

describe.runIf(supported)('schema cache settings (host API)', () => {
	const running: RunningApi[] = [];

	afterAll(async () => {
		for (const api of running) await stopApi(api);
		await closeRedis();
	}, 60_000);

	it('CACHE_SCHEMA=false: no schemaCache-- command on Redis', async () => {
		const { api, url } = await startApi({ CACHE_SCHEMA: 'false' });
		running.push(api);

		const traced = await traceRedis(async () => {
			for (let i = 0; i < 2; i++) expect((await fetch(new URL('/server/info', url))).status).toBe(200);
		});

		expect(traced.filter((c) => c.key.includes('schemaCache--'))).toEqual([]);
	});

	it('CACHE_SCHEMA_FREEZE_ENABLED=true: OAS and info answer like with a mutable schema', async () => {
		const frozen = await startApi({ CACHE_SCHEMA_FREEZE_ENABLED: 'true' });
		const mutable = await startApi({});
		running.push(frozen.api, mutable.api);

		for (const path of ['/server/info', '/server/specs/oas']) {
			const [a, b] = await Promise.all(
				[frozen.url, mutable.url].map(async (url) => {
					const res = await fetch(new URL(path, url));
					const body = (await res.json()) as Record<string, any>;
					if (body['info']) delete body['info']['version'];
					return { status: res.status, body };
				}),
			);
			expect(a, path).toStrictEqual(b);
			expect(a!.status).toBe(200);
		}
	});
});
