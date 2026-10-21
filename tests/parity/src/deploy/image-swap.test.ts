// Feature 019, US1 (FR-020..FR-026): the BE image replaces the Directus image of a running service with no other change,
// runs as a non-root user under tini (PID 1), reaps orphaned children and ends with 143 on SIGTERM. Spec 021: the image
// bootstraps then starts, like the Directus image, so an empty database is installed instead of stopping the app.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	adminToken,
	API_IMAGE,
	compose,
	DIRECTUS_IMAGE,
	directusUrl,
	docker,
	runContainer,
	SEPARATE,
	waitFor,
} from './instances.js';

const NETWORK = 'bo-deploy_default';
const VOLUME = 'bo-deploy-swap-uploads';
const created: string[] = [];

/** The env of the `directus` service as compose resolves it (env file included): what an operator configured. */
function directusServiceEnv(): Record<string, string> {
	const config = JSON.parse(compose('config', '--format', 'json'));
	return config.services.directus.environment as Record<string, string>;
}

const envArgs = (env: Record<string, string>) => Object.entries(env).map(([k, v]) => `${k}=${v}`);

function swap(extraEnv: string[] = []) {
	const c = runContainer(API_IMAGE, [...envArgs(directusServiceEnv()), ...extraEnv], 8055, ['--network', NETWORK]);
	created.push(c.id);
	return c;
}

describe.skipIf(SEPARATE)('BE image in place of the Directus image', () => {
	let swapped: { id: string; url: string };

	beforeAll(async () => {
		swapped = swap();
		await waitFor(`${swapped.url}/server/health`);
	}, 300_000);

	afterAll(() => {
		if (created.length) docker('rm', '-f', ...created);
		docker('volume', 'rm', '-f', VOLUME);
	});

	it('serves the shared data with only the image changed', async () => {
		const token = await adminToken(swapped.url);
		const form = new FormData();
		form.append('file', new Blob(['swap']), 'swap.txt');
		const upload = await fetch(`${swapped.url}/files`, {
			method: 'POST',
			headers: { authorization: `Bearer ${token}` },
			body: form,
		});
		expect(upload.status).toBe(200);
		const { id } = ((await upload.json()) as { data: { id: string } }).data;
		const seen = await fetch(`${directusUrl}/files/${id}`, {
			headers: { authorization: `Bearer ${await adminToken(directusUrl)}` },
		});
		expect(seen.status).toBe(200);
	});

	it('gets the env of the Directus service unchanged', () => {
		const env = docker('inspect', swapped.id, '--format', '{{json .Config.Env}}');
		const values = new Set(JSON.parse(env) as string[]);
		for (const entry of envArgs(directusServiceEnv())) expect(values.has(entry), entry).toBe(true);
	});

	it('runs under the uid of the Directus image, so shared files keep their owner', () => {
		const directusUid = docker('run', '--rm', '--platform', 'linux/amd64', '--entrypoint', 'id', DIRECTUS_IMAGE, '-u');
		expect(docker('exec', swapped.id, 'id', '-u')).toBe(directusUid);
		expect(directusUid).toBe('1000');
		docker('volume', 'create', VOLUME);
		const mount = ['-v', `${VOLUME}:/directus/uploads`, '--platform', 'linux/amd64', '--entrypoint', 'sh'];
		docker('run', '--rm', ...mount, DIRECTUS_IMAGE, '-c', 'echo d > /directus/uploads/f');
		docker('run', '--rm', ...mount, API_IMAGE, '-c', 'echo b >> /directus/uploads/f && rm /directus/uploads/f');
	});

	it('carries the version labels', () => {
		const labels = JSON.parse(docker('image', 'inspect', API_IMAGE, '--format', '{{json .Config.Labels}}'));
		expect(labels['org.opencontainers.image.version']).toBeTruthy();
		expect(labels['org.opencontainers.image.revision']).toMatch(/^[0-9a-f]{40}$/);
	});

	it('runs tini as PID 1 and Node as its child', () => {
		expect(docker('exec', swapped.id, 'cat', '/proc/1/cmdline')).toContain('tini');
		const ps = docker('exec', swapped.id, 'ps', '-o', 'ppid,user,comm');
		expect(ps).toMatch(/^\s*1\s+node\s+node\s*$/m);
	});

	it('reaps orphaned children (no zombie)', async () => {
		docker('exec', swapped.id, 'sh', '-c', 'sh -c "sleep 0.2 &"');
		await new Promise((r) => setTimeout(r, 1500));
		expect(docker('exec', swapped.id, 'ps', '-o', 'stat')).not.toMatch(/^\s*Z/m);
	});

	it('starts with Directus-only variables: SERVE_APP warns, PM2_* are ignored', async () => {
		const c = swap(['SERVE_APP=true', 'PM2_INSTANCES=2']);
		await waitFor(`${c.url}/server/health`);
		const logs = docker('logs', c.id);
		expect(logs).toContain('SERVE_APP');
		expect(logs).not.toContain('PM2');
	});

	it('bootstraps a database Directus never bootstrapped, then serves it (spec 021 FR-063)', async () => {
		const env = directusServiceEnv();
		const psql = (sql: string, database = env['DB_DATABASE']!) =>
			compose('exec', '-T', 'postgres', 'psql', '-U', env['DB_USER']!, '-d', database, '-Atc', sql);
		psql('DROP DATABASE IF EXISTS swap_empty');
		psql('CREATE DATABASE swap_empty');
		let id: string | undefined;
		try {
			// Its own Redis db and namespaces: this instance has another database than the pool (cache keys and the bus
			// would otherwise carry its schema to the replicas).
			const c = swap([
				'DB_DATABASE=swap_empty',
				'REDIS=redis://redis:6379/5',
				'CACHE_NAMESPACE=swap-empty',
				'REDIS_BUS_NAMESPACE=swap-empty:bus',
				'REDIS_LOCK_NAMESPACE=swap-empty:lock',
			]);
			id = c.id;
			await waitFor(`${c.url}/server/health`);
			expect(await adminToken(c.url)).toBeTruthy();
			expect(psql('SELECT count(*) FROM directus_migrations', 'swap_empty').trim()).toBe('101');
			expect(docker('logs', c.id)).toContain('Installing Directus system tables...');
		} finally {
			if (id) docker('rm', '-f', id);
			psql('DROP DATABASE IF EXISTS swap_empty');
		}
	}, 300_000);

	it('has the Backoffice CLI (spec 021 FR-040)', () => {
		// The last line: like Directus, the CLI logs "Extensions loaded" before it prints the version.
		const version = docker('exec', swapped.id, 'node', 'cli.js', '--version').trim().split('\n').at(-1)!.trim();
		expect(version).toMatch(/^\d+\.\d+\.\d+/);
		expect(version).not.toBe('11.17.4');
		expect(docker('exec', swapped.id, 'node', 'cli.js', '--help')).toContain('Usage: backoffice [command] [options]');
	});

	it('ends with 143 after the shutdown sequence on SIGTERM', () => {
		docker('stop', '-t', '30', swapped.id);
		expect(docker('inspect', swapped.id, '--format', '{{.State.ExitCode}}')).toBe('143');
		expect(docker('logs', swapped.id)).toMatch(/Shutting down/);
	});
});
