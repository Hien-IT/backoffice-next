// Spec 021, US5 (FR-071, scenarios 2 and 3): custom migrations reach the database through the bootstrap service of the
// standalone compose. A file copied into the `migrations` volume runs once at the next `up` (the replicas keep running
// and see the flushed cache); a migration that throws stops `up --wait` while the running replicas keep serving.
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
	adminToken,
	api,
	compose,
	containerName,
	docker,
	lbUrl,
	psql,
	REPLICAS,
	replicaUrl,
	STANDALONE,
} from './instances.js';

const fixture = (path: string) => fileURLToPath(new URL(`../../fixtures/migrations/${path}`, import.meta.url));
const started = (name: string) => docker('inspect', '-f', '{{.State.StartedAt}}', name);
const replicaStarts = () => Array.from({ length: REPLICAS }, (_, i) => started(containerName('backoffice-api', i + 1)));
const custom = () => psql("select version from directus_migrations where version like '2099%' order by version");

describe.skipIf(!STANDALONE)('standalone compose: migrations through the bootstrap service', () => {
	afterAll(() => {
		compose('exec', '-T', 'backoffice-api', 'rm', '-f', '/directus/migrations/20990106A-throws.js');
		compose('up', '-d', '--wait', '--wait-timeout', '300');
	});

	it('a migration copied into the volume runs once at the next up; the cache is flushed (scenario 2)', async () => {
		const url = replicaUrl(1);
		const token = await adminToken(url);
		const read = async () => (await api(url, 'GET', '/collections', { token })).headers.get('x-cache-status');

		await read();
		expect(await read()).toBe('HIT');

		const bootstrapStart = started(containerName('bootstrap'));
		const replicas = replicaStarts();
		const before = custom();

		compose('cp', fixture('ok/20990101A-create-sample.js'), 'bootstrap:/directus/migrations/');
		compose('up', '-d', '--wait', '--wait-timeout', '300');

		expect(custom()).toEqual([...before, '20990101A'].sort());
		expect(started(containerName('bootstrap'))).not.toBe(bootstrapStart);
		// Compose leaves running replicas as they are (checked with Compose v5.5.0, also with `restart: true`).
		expect(replicaStarts()).toEqual(replicas);
		expect(await read()).toBe('MISS');

		// A second `up` runs bootstrap again and applies nothing more.
		compose('up', '-d', '--wait', '--wait-timeout', '300');
		expect(custom()).toEqual([...before, '20990101A'].sort());
	});

	it('a migration that throws stops up --wait; the running replicas keep serving (scenario 3)', async () => {
		const replicas = replicaStarts();

		compose('cp', fixture('fail/20990106A-throws.js'), 'bootstrap:/directus/migrations/');
		expect(() => compose('up', '-d', '--wait', '--wait-timeout', '300')).toThrow(/bootstrap/);

		expect(docker('inspect', '-f', '{{.State.ExitCode}}', containerName('bootstrap'))).not.toBe('0');
		expect(custom()).not.toContain('20990106A');
		expect(replicaStarts()).toEqual(replicas);
		expect((await fetch(`${lbUrl}/server/health`)).status).toBe(200);
	});
});
