// Feature 019, US9 (FR-070..FR-075): Backoffice on its own domain (8091) next to Directus on its domain (8090), on the
// same DB, Redis and storage; only PUBLIC_URL differs for the Backoffice services. Runs with DEPLOY_MODE=separate-domain.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { metadata, tus } from '../tus-request.js';
import {
	adminToken,
	api,
	boLbUrl,
	compose,
	containerIp,
	containerName,
	lbLog,
	lbUrl,
	REPLICAS,
	SEPARATE,
	sharedEnv,
} from './instances.js';

const BO_PUBLIC_URL = 'http://localhost:8091';
const cleanup: (() => Promise<unknown>)[] = [];
let directusAdmin: string;
let boAdmin: string;

beforeAll(async () => {
	directusAdmin = await adminToken(lbUrl);
	boAdmin = await adminToken(boLbUrl);
});

afterAll(async () => {
	for (const step of cleanup.reverse()) await step();
});

/**
 * Upstream addresses of the lb access log lines (format: ... $upstream_addr $upstream_status $server_port). Every
 * `ip:port` of the line counts: a retried request lists several, `A, B` or `A : B` after the @retry location (the third
 * field from the end was then `:`, read as '' in CI 39660476604); the client address has no port.
 */
function upstreams(since: string, port: string, path: string): Set<string> {
	return new Set(
		lbLog(since)
			.filter((l) => l.endsWith(` ${port}`) && l.includes(path))
			.flatMap((l) => [...l.matchAll(/(\d+\.\d+\.\d+\.\d+):\d+/g)].map((m) => m[1]!)),
	);
}

describe.skipIf(!SEPARATE)('Backoffice on its own domain', () => {
	it('serves each app on its domain; the Backoffice app calls its own domain (FR-072)', async () => {
		expect((await (await fetch(`${lbUrl}/admin/`)).text()).toLowerCase()).toContain('directus');
		expect(await (await fetch(`${boLbUrl}/admin/config.json`)).json()).toEqual({ apiUrl: BO_PUBLIC_URL });
	});

	it('routes the Backoffice domain to the BE replicas only, the Directus domain to Directus only', async () => {
		const since = new Date().toISOString();
		for (let i = 0; i < 50; i++) await fetch(`${boLbUrl}/server/info`);
		for (let i = 0; i < 20; i++) await fetch(`${lbUrl}/server/info`);
		const replicas = Array.from({ length: REPLICAS }, (_, i) => containerIp(containerName('backoffice-api', i + 1)));
		const directus = containerIp(containerName('directus'));
		const bo = upstreams(since, '8081', '/server/info');
		expect(bo.size).toBeGreaterThan(1);
		for (const ip of bo) expect(replicas, ip).toContain(ip);
		expect([...upstreams(since, '8080', '/server/info')]).toEqual([directus]);
	});

	it('builds TUS locations on the Backoffice domain (PUBLIC_URL)', async () => {
		const create = await tus(boLbUrl, 'POST', '/files/tus', {
			authorization: `Bearer ${boAdmin}`,
			'upload-length': '10',
			'upload-metadata': metadata({ filename_download: `separate-${randomUUID().slice(0, 8)}.txt` }),
		});
		expect(create.status).toBe(201);
		expect(create.headers['location']).toMatch(new RegExp(`^${BO_PUBLIC_URL}/files/tus/[0-9a-f]+$`));
		await tus(boLbUrl, 'DELETE', new URL(create.headers['location']!).pathname, { authorization: `Bearer ${boAdmin}` });
	});

	it('shows a change made on one domain at the other at once, both ways (FR-073)', async () => {
		const collection = `bo_separate_${randomUUID().slice(0, 8)}`;
		const created = await api(lbUrl, 'POST', '/collections', {
			token: directusAdmin,
			body: {
				collection,
				schema: {},
				meta: {},
				fields: [{ field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } }],
			},
		});
		expect(created.status).toBe(200);
		cleanup.push(() => api(lbUrl, 'DELETE', `/collections/${collection}`, { token: directusAdmin }));
		expect((await api(boLbUrl, 'GET', `/collections/${collection}`, { token: boAdmin })).status).toBe(200);

		const before = (await api(lbUrl, 'GET', '/settings?fields=project_descriptor', { token: directusAdmin })).body.data
			.project_descriptor;
		cleanup.push(() =>
			api(lbUrl, 'PATCH', '/settings', { token: directusAdmin, body: { project_descriptor: before } }),
		);
		const value = `separate ${randomUUID().slice(0, 8)}`;
		await api(boLbUrl, 'PATCH', '/settings', { token: boAdmin, body: { project_descriptor: value } });
		const read = await api(lbUrl, 'GET', '/settings?fields=project_descriptor', { token: directusAdmin });
		expect(read.body.data.project_descriptor).toBe(value);
	});

	it('sets the session cookie for the Backoffice host only (no Domain attribute)', async () => {
		const env = sharedEnv();
		const res = await api(boLbUrl, 'POST', '/auth/login', {
			body: { email: env['ADMIN_EMAIL'], password: env['ADMIN_PASSWORD'], mode: 'session' },
		});
		expect(res.status).toBe(200);
		const cookie = res.headers.get('set-cookie')!;
		expect(cookie).toContain('directus_session_token=');
		expect(cookie.toLowerCase()).not.toContain('domain=');
	});

	it('gives the Backoffice services the Directus env with only PUBLIC_URL changed (FR-071)', () => {
		const services = JSON.parse(compose('config', '--format', 'json')).services;
		const directus: Record<string, string> = services.directus.environment;
		for (const name of ['backoffice-api', 'backoffice-web']) {
			const env: Record<string, string> = services[name].environment;
			const changed = Object.keys({ ...directus, ...env }).filter((k) => directus[k] !== env[k]);
			expect(changed, name).toEqual(['PUBLIC_URL']);
			expect(env['PUBLIC_URL'], name).toBe(BO_PUBLIC_URL);
		}
	});
});
