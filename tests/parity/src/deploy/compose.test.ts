// Feature 019, US2 (FR-023, FR-025, FR-030, FR-040..FR-044, FR-051): the dev compose, its start order, the load
// balancer pool with Directus, forwarded headers, the image platform, scaling and non-root processes.
import { describe, expect, it } from 'vitest';
import {
	adminToken,
	API_IMAGE,
	api,
	compose,
	containerIp,
	containerName,
	directusUrl,
	docker,
	instanceUrls,
	lbLog,
	lbUrl,
	REPLICAS,
	SEPARATE,
	sharedEnv,
	STANDALONE,
	WEB_IMAGE,
} from './instances.js';

const started = (name: string) => Date.parse(docker('inspect', '-f', '{{.State.StartedAt}}', name));

describe.skipIf(SEPARATE)('deploy compose', () => {
	it.skipIf(STANDALONE)('gives Directus and the BE the same env file (FR-041)', () => {
		const config = JSON.parse(compose('config', '--format', 'json'));
		expect(config.services['backoffice-api'].environment).toEqual(config.services.directus.environment);
	});

	it.skipIf(STANDALONE)('runs every service healthy, in the start order of FR-042', () => {
		const ps = compose('ps', '-a', '--format', 'json')
			.trim()
			.split('\n')
			.map((l) => JSON.parse(l));
		for (const c of ps) {
			if (c.Service === 'minio-init') expect(c.ExitCode, c.Name).toBe(0);
			else expect(c.Health, c.Name).toBe('healthy');
		}
		expect(ps.filter((c) => c.Service === 'backoffice-api')).toHaveLength(REPLICAS);

		const directus = started(containerName('directus'));
		for (const dep of ['postgres', 'redis']) expect(started(containerName(dep))).toBeLessThan(directus);
		for (let i = 1; i <= REPLICAS; i++) expect(started(containerName('backoffice-api', i))).toBeGreaterThan(directus);
	});

	it.skipIf(STANDALONE)('spreads API requests over the BE replicas and Directus (FR-050)', async () => {
		const since = new Date().toISOString();
		for (let i = 0; i < 100; i++) await fetch(`${lbUrl}/server/info`);
		const upstreams = new Set(
			lbLog(since)
				.filter((l) => l.includes('/server/info'))
				.map((l) => l.split(' ').at(-2)),
		);
		expect(upstreams.size).toBeGreaterThanOrEqual(REPLICAS + 1);
		expect([...upstreams].some((u) => u?.startsWith(`${containerIp(containerName('directus'))}:`))).toBe(true);
	});

	it('serves the app at /admin and keeps the Directus root redirect', async () => {
		for (const path of ['/admin/content', '/admin/files/abc']) {
			const res = await fetch(`${lbUrl}${path}`);
			expect(await res.text(), path).toContain('<div id="app"');
		}
		const root = await api(lbUrl, 'GET', '/');
		expect(root.status).toBe(302);
		expect(root.headers.get('location')).toBe('./admin');
	});

	it.skipIf(STANDALONE)('passes X-Forwarded-For so the BE and Directus record the client IP (FR-051)', async () => {
		const directusIp = containerIp(containerName('directus'));
		const env = sharedEnv();
		const token = await adminToken(directusUrl);
		const seen: Record<string, string> = {};
		for (let i = 0; i < 40 && Object.keys(seen).length < 2; i++) {
			const since = new Date().toISOString();
			const login = await api(lbUrl, 'POST', '/auth/login', {
				body: { email: env['ADMIN_EMAIL'], password: env['ADMIN_PASSWORD'] },
				headers: { 'x-forwarded-for': '203.0.113.9' },
			});
			expect(login.status).toBe(200);
			const upstream =
				lbLog(since)
					.find((l) => l.includes('/auth/login'))
					?.split(' ')
					.at(-2) ?? '';
			const last = await api(directusUrl, 'GET', '/activity?filter[action][_eq]=login&sort=-id&limit=1&fields=ip', {
				token,
			});
			seen[upstream.startsWith(`${directusIp}:`) ? 'directus' : 'backoffice'] = last.body.data[0].ip;
		}
		expect(seen).toEqual({ directus: '203.0.113.9', backoffice: '203.0.113.9' });
	});

	it('builds linux/amd64 images (FR-023)', () => {
		for (const image of [API_IMAGE, WEB_IMAGE])
			expect(docker('image', 'inspect', '-f', '{{.Architecture}}', image)).toBe('amd64');
	});

	it('scales to 6 BE replicas sharing the sessions, then back (FR-030)', async () => {
		// --no-deps: in the standalone mode, `up` of a service also runs its finished `bootstrap` dependency again.
		compose('up', '-d', '--wait', '--no-recreate', '--no-deps', '--scale', 'backoffice-api=6', 'backoffice-api');
		try {
			const urls = instanceUrls(6);
			const token = await adminToken(urls[0]!);
			for (const url of urls) {
				expect(await (await fetch(`${url}/server/ping`)).text()).toBe('pong');
				expect((await api(url, 'GET', '/users/me', { token })).status, url).toBe(200);
			}
		} finally {
			compose(
				'up',
				'-d',
				'--wait',
				'--no-recreate',
				'--no-deps',
				'--scale',
				`backoffice-api=${REPLICAS}`,
				'backoffice-api',
			);
		}
	});

	it('runs no main process as root (FR-025)', () => {
		for (const name of compose('ps', '--format', '{{.Name}}').trim().split('\n')) {
			// `docker top` prints PID, USER (a uid when the user has no name on the host), TIME, COMMAND.
			const users = docker('top', name)
				.split('\n')
				.slice(1)
				.map((line) => line.trim().split(/\s+/)[1]);
			expect(users.length, name).toBeGreaterThan(0);
			for (const user of users) expect(['root', '0'], `${name}: ${user}`).not.toContain(user);
		}
	});
});

// Spec 021, US5 (FR-070, FR-071): no Directus; the one-shot bootstrap service runs before the BE replicas, with the
// same env file, and the load balancer pool holds the BE replicas only.
describe.skipIf(!STANDALONE)('deploy compose, standalone mode', () => {
	const ps = () =>
		compose('ps', '-a', '--format', 'json')
			.trim()
			.split('\n')
			.map((l) => JSON.parse(l));
	/** When the first bootstrap run logged "Done" (standalone.test.ts may run bootstrap again later). */
	const firstDone = (name: string) =>
		Date.parse(
			docker('logs', '--timestamps', name)
				.split('\n')
				.find((line) => /\bDone\b/.test(line))!
				.split(' ')[0]!,
		);

	it('has no Directus; bootstrap exits 0 after Postgres and Redis, before every replica (FR-070)', () => {
		const containers = ps();
		expect(containers.map((c) => c.Service)).not.toContain('directus');

		for (const c of containers) {
			if (['minio-init', 'bootstrap'].includes(c.Service)) expect(c.ExitCode, c.Name).toBe(0);
			else expect(c.Health, c.Name).toBe('healthy');
		}

		const bootstrap = containerName('bootstrap');
		for (const dep of ['postgres', 'redis']) expect(started(containerName(dep))).toBeLessThan(started(bootstrap));
		for (let i = 1; i <= REPLICAS; i++) {
			expect(started(containerName('backoffice-api', i))).toBeGreaterThan(firstDone(bootstrap));
		}
	});

	it('gives bootstrap and the replicas the same env file (Principle VIII)', () => {
		const config = JSON.parse(compose('config', '--format', 'json'));
		expect(config.services.directus).toBeUndefined();
		expect(config.services['backoffice-api'].environment).toEqual(config.services.bootstrap.environment);
		expect(config.services['backoffice-api'].command).toEqual(['node', 'cli.js', 'start']);
	});

	it('spreads API requests over the BE replicas only', async () => {
		const since = new Date().toISOString();
		for (let i = 0; i < 60; i++) await fetch(`${lbUrl}/server/info`);
		const upstreams = new Set(
			lbLog(since)
				.filter((l) => l.includes('/server/info'))
				.map((l) => l.split(' ').at(-2)?.split(':')[0]),
		);
		// Every replica gets requests (IPs of replicas removed by a scale-down may linger in the pool for `valid` 5 s).
		for (let i = 1; i <= REPLICAS; i++) {
			expect(upstreams.has(containerIp(containerName('backoffice-api', i))), `replica ${i}`).toBe(true);
		}
		const conf = compose('exec', '-T', 'lb', 'cat', '/etc/nginx/conf.d/default.conf');
		expect(conf).toContain('server backoffice-api:8055 resolve');
		expect(conf).not.toContain('directus:8055');
	});

	it('scaling the replicas with --no-deps does not run bootstrap again', () => {
		const before = started(containerName('bootstrap'));
		compose('up', '-d', '--wait', '--no-recreate', '--no-deps', '--scale', 'backoffice-api=4', 'backoffice-api');
		compose(
			'up',
			'-d',
			'--wait',
			'--no-recreate',
			'--no-deps',
			'--scale',
			`backoffice-api=${REPLICAS}`,
			'backoffice-api',
		);
		expect(started(containerName('bootstrap'))).toBe(before);
	});
});
