// Feature 019, US6 (FR-033..FR-035, FR-064, SC-002, SC-008): continuous reads and writes through the load balancer
// while a BE replica gets SIGTERM and comes back: no request fails, the replica ends with 143 within the grace period
// and its DB and Redis connections close.
import autocannon from 'autocannon';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	adminToken,
	api,
	compose,
	containerIp,
	containerName,
	directusUrl,
	docker,
	lbUrl,
	psql,
	SEPARATE,
	sleep,
	waitFor,
} from './instances.js';

const collection = `bo_deploy_load_${randomUUID().slice(0, 8)}`;
const GRACE_MS = 30_000; // stop_grace_period of backoffice-api
let admin: string;

const dbConnections = (ip: string) =>
	Number(psql(`select count(*) from pg_stat_activity where client_addr = '${ip}'`)[0]);
const redisConnections = (ip: string) =>
	compose('exec', '-T', 'redis', 'redis-cli', 'client', 'list')
		.split('\n')
		.filter((l) => l.includes(` addr=${ip}:`)).length;

beforeAll(async () => {
	admin = await adminToken(directusUrl);
	await api(directusUrl, 'POST', '/collections', {
		token: admin,
		body: {
			collection,
			schema: {},
			meta: {},
			fields: [
				{ field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } },
				{ field: 'title', type: 'string' },
			],
		},
	});
	await api(directusUrl, 'POST', `/items/${collection}`, { token: admin, body: { title: 'seed' } });
});

afterAll(async () => {
	await api(directusUrl, 'DELETE', `/collections/${collection}`, { token: admin });
});

describe.skipIf(SEPARATE)('a BE replica stops and comes back under load', () => {
	it('fails no request', async () => {
		const victim = containerName('backoffice-api', 2);
		const ip = containerIp(victim);
		const before = { db: dbConnections(ip), redis: redisConnections(ip) };
		expect(before.db).toBeGreaterThan(0);
		expect(before.redis).toBeGreaterThan(0);

		const load = autocannon({
			url: lbUrl,
			connections: 20,
			duration: 60,
			headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' },
			requests: [
				{ method: 'GET', path: `/items/${collection}?limit=1` },
				{ method: 'POST', path: `/items/${collection}`, body: JSON.stringify({ title: 'load' }) },
			],
		});

		await sleep(15_000);
		const killedAt = Date.now();
		docker('kill', '-s', 'TERM', victim);
		const exitCode = docker('wait', victim);
		const stopMs = Date.parse(docker('inspect', '-f', '{{.State.FinishedAt}}', victim)) - killedAt;
		const after = { db: dbConnections(ip), redis: redisConnections(ip) };

		await sleep(Math.max(0, killedAt + 20_000 - Date.now()));
		compose('up', '-d', 'backoffice-api');
		const startedAt = Date.parse(docker('inspect', '-f', '{{.State.StartedAt}}', victim));
		const [, port] = docker('port', victim, '8055').split('\n')[0]!.split(':');
		await waitFor(`http://127.0.0.1:${port}/server/health`, 60_000);
		const readyMs = Date.now() - startedAt;

		const result = await load;
		const report = {
			requests: result.requests.total,
			errors: result.errors,
			timeouts: result.timeouts,
			non2xx: result.non2xx,
			statusCodes: result.statusCodeStats,
			exitCode,
			stopMs,
			readyMs,
			connections: { before, after },
		};
		// eslint-disable-next-line no-console -- SC-002, SC-008 numbers, read from the CI log
		console.log('shutdown under load', JSON.stringify(report));

		expect(report.errors).toBe(0);
		expect(report.timeouts).toBe(0);
		expect(report.non2xx).toBe(0);
		expect(report.requests).toBeGreaterThanOrEqual(5000);
		expect(exitCode).toBe('143');
		expect(stopMs).toBeLessThanOrEqual(GRACE_MS);
		expect(after).toEqual({ db: 0, redis: 0 });
		expect(readyMs).toBeLessThanOrEqual(30_000);
	}, 180_000);
});
