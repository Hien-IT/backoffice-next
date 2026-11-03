// Spec 030 (US3, FR-023, SC-004): deploy/compose with BACKOFFICE_REPLICAS BE replicas. An index built at one replica
// is seen creating then ready at another; writes through the load balancer keep answering while it builds without
// locking the table; SIGTERM on the building replica marks the row failed before its pool closes (research R4).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminToken, api, boLbUrl, compose, containerName, docker, psql, replicaUrl, sleep, waitFor } from './instances.js';

const COLLECTION = 'bo_deploy_indexes';
const BASE = `/backoffice/collections/${COLLECTION}/indexes`;

let admin: string;

const row = async (url: string, name: string) =>
	(await api(url, 'GET', BASE, { token: admin })).body?.data?.find((r: any) => r.name === name);

async function settled(url: string, name: string, timeoutMs = 180_000) {
	const started = Date.now();

	for (;;) {
		const r = await row(url, name);
		if (r && r.status !== 'creating') return r;
		if (Date.now() - started > timeoutMs) throw new Error(`${name} still ${r?.status} after ${timeoutMs} ms`);
		await sleep(500);
	}
}

beforeAll(async () => {
	admin = await adminToken(replicaUrl(1));
	const res = await api(replicaUrl(1), 'POST', '/collections', {
		token: admin,
		body: {
			collection: COLLECTION,
			schema: {},
			meta: {},
			fields: [
				{ field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } },
				{ field: 'title', type: 'string' },
				{ field: 'code', type: 'string' },
			],
		},
	});
	expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
	// Enough rows for CREATE INDEX to take a few seconds.
	psql(`insert into ${COLLECTION} (title, code) select md5(i::text), 'c' || i from generate_series(1, 300000) i`);
}, 300_000);

afterAll(async () => {
	await api(replicaUrl(1), 'DELETE', `/collections/${COLLECTION}`, { token: admin });
});

describe('an index built at one replica', () => {
	it('is seen at another, and writes through the lb keep answering while it builds (SC-004)', async () => {
		const created = await api(replicaUrl(1), 'POST', BASE, { token: admin, body: { fields: ['title', 'code'], unique: true } });
		expect(created.status, JSON.stringify(created.body)).toBe(202);
		const name = created.body.data.name;

		let writes = 0;
		let slowest = 0;

		while ((await row(replicaUrl(2), name))?.status === 'creating') {
			const started = Date.now();
			const res = await api(boLbUrl, 'POST', `/items/${COLLECTION}`, {
				token: admin,
				body: { title: `w${writes}`, code: `w${writes}` },
			});
			expect(res.status, JSON.stringify(res.body)).toBe(200);
			slowest = Math.max(slowest, Date.now() - started);
			writes++;
		}

		expect(await settled(replicaUrl(2), name)).toMatchObject({ status: 'ready', missing: false });
		expect(slowest, `${writes} writes during the build`).toBeLessThan(2000);
		expect(psql(`select indisvalid from pg_index where indexrelid = '${name}'::regclass`)).toEqual(['t']);
	});

	it('concurrentIndexCreation=false builds the plain way', async () => {
		const created = await api(replicaUrl(1), 'POST', `${BASE}?concurrentIndexCreation=false`, {
			token: admin,
			body: { fields: ['code'] },
		});
		expect(created.status, JSON.stringify(created.body)).toBe(202);
		expect((await settled(replicaUrl(3), created.body.data.name)).status).toBe('ready');
	});

	it('two replicas posting the same index: one 202, one 400', async () => {
		const [a, b] = await Promise.all([
			api(replicaUrl(1), 'POST', BASE, { token: admin, body: { fields: ['title'] } }),
			api(replicaUrl(2), 'POST', BASE, { token: admin, body: { fields: ['title'] } }),
		]);
		expect([a.status, b.status].sort()).toEqual([202, 400]);
		await settled(replicaUrl(1), `${COLLECTION}_title_index`);
	});

	it('SIGTERM on the building replica marks the row failed; DELETE cleans the leftover index', async () => {
		// A transaction holding the table keeps CREATE INDEX CONCURRENTLY waiting (it needs every older one to end).
		compose(
			'exec',
			'-d',
			'-T',
			'postgres',
			'psql',
			'-U',
			'directus',
			'-c',
			`BEGIN; LOCK TABLE ${COLLECTION} IN SHARE ROW EXCLUSIVE MODE; SELECT pg_sleep(40); COMMIT;`,
		);
		await sleep(1000);

		const created = await api(replicaUrl(1), 'POST', BASE, { token: admin, body: { fields: ['code', 'title'] } });
		expect(created.status, JSON.stringify(created.body)).toBe(202);
		const name = created.body.data.name;
		await sleep(2000);
		expect((await row(replicaUrl(2), name))?.status).toBe('creating');

		const victim = containerName('backoffice-api', 1);
		docker('kill', '-s', 'TERM', victim);
		expect(docker('wait', victim)).toBe('143');

		expect(await row(replicaUrl(2), name)).toMatchObject({ status: 'failed', error: 'Server shutdown' });

		compose('up', '-d', 'backoffice-api');
		await waitFor(`${replicaUrl(1)}/server/health`, 120_000);

		expect((await api(replicaUrl(2), 'DELETE', `${BASE}/${name}`, { token: admin })).status).toBe(204);
		await sleep(45_000); // the lock transaction ends, the cancelled build is gone
		expect(psql(`select count(*) from pg_class where relname = '${name}'`)).toEqual(['0']);
	}, 300_000);
});
