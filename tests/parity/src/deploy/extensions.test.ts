// Spec 020 US2 (FR-040 to FR-052, SC-003, T062): deploy/compose with BACKOFFICE_REPLICAS BE replicas and Directus, all
// with EXTENSIONS_LOCATION=s3 (.env.example). The parity-endpoint-demo fixture is copied to the bucket and the API
// services recreated; then a change at one node reaches every node within 10 s, the app chunks go to the BE pool only,
// and replicas added by a scale-up serve the extension as soon as they are healthy (FR-048: healthy within 60 s).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

const FIXTURES = fileURLToPath(new URL('../../../fixtures/extensions/', import.meta.url));
// T148: an app extension too, so the bundle has chunks; removed from the bucket after the file, so replicas the later
// files restart start without app extensions (no rollup at startup).
const UPLOADED = ['parity-endpoint-demo', 'parity-display-badge'];
let admin: string;

/** Runs `script` with mc in the minio container, the alias `local` set; `env` is passed as environment variables. */
function minio(script: string, env: Record<string, string> = {}) {
	const shared = sharedEnv();
	const vars = { K: shared['STORAGE_S3_KEY']!, S: shared['STORAGE_S3_SECRET']!, ...env };
	compose(
		'exec',
		'-T',
		...Object.entries(vars).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
		'minio',
		'sh',
		'-c',
		`mc alias set local http://127.0.0.1:9000 "$K" "$S" >/dev/null && ${script}`,
	);
}

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
	for (const name of UPLOADED) {
		for (const file of ['package.json', 'dist/index.js']) {
			const text = readFileSync(`${FIXTURES}${name}/${file}`, 'utf8');
			minio(`printf '%s' "$BODY" | mc pipe local/directus/extensions/${name}/${file}`, { BODY: text });
		}
	}

	compose('up', '-d', '--wait', '--wait-timeout', '300', '--force-recreate', '--no-deps', 'directus', 'backoffice-api');
	admin = await adminToken(directusUrl);
}, 600_000);

afterAll(() => {
	minio('mc rm --recursive --force local/directus/extensions/parity-display-badge >/dev/null');
});

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

	it('the app bundle: the same index.js at every replica, each chunk it imports served by another (T148, FR-047)', async () => {
		const source = async (url: string, chunk: string) => {
			const res = await api(url, 'GET', `/extensions/sources/${chunk}`);
			expect(res.status, `${url} ${chunk}`).toBe(200);
			return String(res.body);
		};

		const index = await source(replicaUrl(1), 'index.js');
		expect(index).toContain('parity-display-badge');
		for (let i = 2; i <= REPLICAS; i++) expect(await source(replicaUrl(i), 'index.js')).toBe(index);

		const chunks = [...index.matchAll(/from\s*['"]\.\/([^'"]+\.js)['"]|import\(\s*['"]\.\/([^'"]+\.js)['"]\s*\)/g)].map(
			(match) => match[1] ?? match[2]!,
		);
		for (const chunk of chunks) expect(await source(replicaUrl(2), chunk)).toBe(await source(replicaUrl(1), chunk));
	});

	it('installed from the registry through Directus: every replica loads it within 10 s; uninstalled through a replica: gone everywhere (T177, US2-1, US2-2)', async () => {
		// parity-interface-color of tests/parity/registry/fixtures: sandboxed (MARKETPLACE_TRUST defaults to sandbox) and
		// not among the files uploaded above.
		const extension = 'e0000000-0000-4000-8000-000000000001';
		const loaded = async (url: string) =>
			(await api(url, 'GET', '/extensions', { token: admin })).body.data.some(
				(e: any) => e.id === extension && e.schema !== null,
			);
		const inBundle = async (url: string) =>
			String((await api(url, 'GET', '/extensions/sources/index.js')).body).includes('parity-interface-color');
		const backoffice = Array.from({ length: REPLICAS }, (_, i) => replicaUrl(i + 1));
		const until = async (check: () => Promise<boolean>, what: string) => {
			const end = Date.now() + 10_000;
			while (!(await check())) {
				if (Date.now() > end) throw new Error(what);
				await sleep(500);
			}
		};

		const installed = await api(directusUrl, 'POST', '/extensions/registry/install', {
			token: admin,
			body: { extension, version: 'f0000000-0000-4000-8000-000000000001' },
		});
		expect(installed.status).toBe(204);

		try {
			await until(async () => (await Promise.all(instanceUrls().map(loaded))).every(Boolean), 'not loaded everywhere');
			await until(async () => (await Promise.all(backoffice.map(inBundle))).every(Boolean), 'not in every bundle');
		} finally {
			const removed = await api(replicaUrl(2), 'DELETE', `/extensions/registry/uninstall/${extension}`, {
				token: admin,
			});
			expect(removed.status).toBe(204);
		}

		await until(async () => (await Promise.all(backoffice.map(inBundle))).every((b) => !b), 'still in a bundle');
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
