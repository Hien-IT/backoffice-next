// Spec 020 US2 (FR-040 to FR-052, SC-003, T062): deploy/compose with BACKOFFICE_REPLICAS BE replicas and Directus, all
// with EXTENSIONS_LOCATION=s3 (.env.example). The parity-endpoint-demo fixture is copied to the bucket and the API
// services recreated; then a change at one node reaches every node within 10 s, the app chunks go to the BE pool only,
// and replicas added by a scale-up serve the extension as soon as they are healthy (FR-048: healthy within 60 s).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
	adminToken,
	api,
	compose,
	directusUrl,
	instanceUrls,
	lbLog,
	lbUrl,
	REPLICAS,
	replicaUrl,
	SEPARATE,
	sharedEnv,
	sleep,
} from './instances.js';

const FIXTURE = fileURLToPath(new URL('../../../fixtures/extensions/parity-endpoint-demo/', import.meta.url));
let admin: string;

/** Every URL answers `path` with `status` within 10 s, polled every 500 ms. */
async function everywhere(urls: string[], path: string, status: number) {
	const end = Date.now() + 10_000;

	for (;;) {
		const got = await Promise.all(urls.map(async (url) => (await api(url, 'GET', path)).status));
		if (got.every((s) => s === status)) return;
		if (Date.now() > end) throw new Error(`${path}: ${got.join(', ')}, expected ${status} everywhere`);
		await sleep(500);
	}
}

beforeAll(async () => {
	// `compose exec` reads stdin from the input of the test process: pipe the file content in through `sh -c`.
	for (const [key, file] of [
		['extensions/parity-endpoint-demo/package.json', 'package.json'],
		['extensions/parity-endpoint-demo/dist/index.js', 'dist/index.js'],
	] as const) {
		const text = readFileSync(`${FIXTURE}${file}`, 'utf8');
		const env = sharedEnv();
		compose(
			'exec',
			'-T',
			'-e',
			`K=${env['STORAGE_S3_KEY']}`,
			'-e',
			`S=${env['STORAGE_S3_SECRET']}`,
			'-e',
			`BODY=${text}`,
			'minio',
			'sh',
			'-c',
			`mc alias set local http://127.0.0.1:9000 "$K" "$S" >/dev/null && printf '%s' "$BODY" | mc pipe local/directus/${key}`,
		);
	}

	compose('up', '-d', '--wait', '--wait-timeout', '300', '--force-recreate', '--no-deps', 'directus', 'backoffice-api');
	admin = await adminToken(directusUrl);
}, 600_000);

describe('extensions on every node', () => {
	it('every BE replica and Directus serve the endpoint extension', async () => {
		await everywhere(instanceUrls(), '/parity-endpoint-demo', 200);
	});

	it('disabled through one replica: 404 on every node within 10 s; enabled again: 200 (SC-003)', async () => {
		const list = await api(replicaUrl(1), 'GET', '/extensions', { token: admin });
		const row = list.body.data.find((e: any) => e.meta.folder === 'parity-endpoint-demo');

		const off = await api(replicaUrl(1), 'PATCH', `/extensions/${row.id}`, {
			token: admin,
			body: { meta: { enabled: false } },
		});
		expect(off.status).toBe(200);
		await everywhere(instanceUrls(), '/parity-endpoint-demo', 404);

		await api(directusUrl, 'PATCH', `/extensions/${row.id}`, { token: admin, body: { meta: { enabled: true } } });
		await everywhere(instanceUrls(), '/parity-endpoint-demo', 200);
	});

	it.skipIf(SEPARATE)('the app chunks go to the BE replicas only (D-137)', async () => {
		const since = new Date().toISOString();

		for (let i = 0; i < 8; i++) {
			const res = await api(lbUrl, 'GET', '/extensions/sources/index.js');
			expect(res.status).toBe(200);
		}

		const directusIp = compose('exec', '-T', 'directus', 'hostname', '-i').trim().split(/\s+/)[0];
		const lines = lbLog(since).filter((line) => line.includes('/extensions/sources/index.js'));
		expect(lines.length).toBeGreaterThanOrEqual(8);
		expect(lines.filter((line) => line.includes(`${directusIp}:8055`))).toEqual([]);
	});

	it('a scale-up: the new replicas are healthy within 60 s and serve the extension at once (US2-5, FR-048)', async () => {
		const target = REPLICAS + 2;
		const start = Date.now();

		try {
			compose('up', '-d', '--wait', '--no-recreate', '--scale', `backoffice-api=${target}`, 'backoffice-api');
			expect(Date.now() - start).toBeLessThan(60_000);

			for (let i = REPLICAS + 1; i <= target; i++) {
				expect((await api(replicaUrl(i), 'GET', '/parity-endpoint-demo')).status).toBe(200);
			}
		} finally {
			compose('up', '-d', '--wait', '--no-recreate', '--scale', `backoffice-api=${REPLICAS}`, 'backoffice-api');
		}
	}, 300_000);
});
