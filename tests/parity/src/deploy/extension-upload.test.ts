// Spec 031 (US4, FR-025, SC-004): deploy/compose with BACKOFFICE_REPLICAS BE replicas and EXTENSIONS_LOCATION=s3. A
// package uploaded through the load balancer is served by every replica within 10 s; a replica restarted afterwards
// syncs it from the shared storage; uninstalled through the load balancer, every replica answers 404 within 10 s.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
	adminToken,
	boLbUrl,
	compose,
	directusUrl,
	instanceUrls,
	replicaUrl,
	REPLICAS,
	STANDALONE,
	sleep,
	waitFor,
} from './instances.js';

const FIXTURE = fileURLToPath(
	new URL('../../../fixtures/extensions/parity-upload-endpoint/parity-upload-endpoint-1.0.0.tgz', import.meta.url),
);

let admin: string;

beforeAll(async () => {
	admin = await adminToken(replicaUrl(1));
});

/** The BE replicas only: Directus never loads an uploaded package (D-212.1), checked on its own. */
const replicas = () => instanceUrls(REPLICAS, true);

/** Every BE replica answers `path` with `status` within `timeoutMs` (SC-004: 10 s); resolves the time it took. */
async function everyReplica(path: string, status: number, timeoutMs = 10_000): Promise<number> {
	const started = Date.now();

	for (;;) {
		const statuses = await Promise.all(
			replicas().map((url) =>
				fetch(`${url}${path}`)
					.then((res) => res.status)
					.catch(() => 0),
			),
		);

		if (statuses.every((s) => s === status)) return Date.now() - started;
		if (Date.now() - started > timeoutMs) throw new Error(`${path}: ${statuses.join(', ')}, expected ${status}`);
		await sleep(250);
	}
}

describe('an uploaded package on every replica', () => {
	let id: string;

	it(`uploaded through the load balancer, served by the ${REPLICAS} replicas within 10 s`, async () => {
		const form = new FormData();
		form.append('file', new Blob([new Uint8Array(readFileSync(FIXTURE))]), 'parity-upload-endpoint-1.0.0.tgz');

		const res = await fetch(`${boLbUrl}/backoffice/extensions/upload`, {
			method: 'POST',
			headers: { authorization: `Bearer ${admin}` },
			body: form,
		});
		const body = (await res.json()) as { data: { id: string } };

		expect(res.status, JSON.stringify(body)).toBe(200);
		id = body.data.id;

		expect(await everyReplica('/parity-upload-endpoint', 200)).toBeLessThanOrEqual(10_000);
		if (!STANDALONE) expect((await fetch(`${directusUrl}/parity-upload-endpoint`)).status).toBe(404);
	});

	it('a replica restarted afterwards syncs it from the shared storage', async () => {
		compose('restart', 'backoffice-api');
		for (const url of replicas()) await waitFor(`${url}/server/health`, 180_000);

		await everyReplica('/parity-upload-endpoint', 200, 60_000);
	}, 300_000);

	it('uninstalled through the load balancer, every replica answers 404 within 10 s', async () => {
		const res = await fetch(`${boLbUrl}/extensions/registry/uninstall/${id}`, {
			method: 'DELETE',
			headers: { authorization: `Bearer ${admin}` },
		});

		expect(res.status).toBe(204);
		expect(await everyReplica('/parity-upload-endpoint', 404)).toBeLessThanOrEqual(10_000);
	});
});
