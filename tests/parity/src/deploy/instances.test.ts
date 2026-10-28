import { describe, expect, it, vi } from 'vitest';
import { composeArgs, containerName, parseEnv } from './instances.js';

describe('deploy instances', () => {
	it('builds the compose command of each mode', () => {
		expect(composeArgs(['ps'], '/tmp/e', false)).toEqual([
			'compose',
			'-p',
			'bo-deploy',
			'--env-file',
			'/tmp/e',
			'-f',
			'docker-compose.yml',
			'ps',
		]);
		// Spec 026: next to Directus is the base file itself, no override.
		expect(composeArgs(['up'], '/tmp/e', false).join(' ')).not.toContain('separate');
		// Spec 021: the standalone override on top of the base file.
		expect(composeArgs(['up'], '/tmp/e', true).slice(5, 9)).toEqual([
			'-f',
			'docker-compose.yml',
			'-f',
			'docker-compose.standalone.yml',
		]);
		expect(composeArgs(['up'], '/tmp/e', false)).not.toContain('docker-compose.standalone.yml');
	});

	// Spec 026 (FR-005, FR-011): the Backoffice domain is 8091 next to Directus and 8090 alone.
	it('serves the Backoffice domain at 8091 next to Directus and at 8090 alone', async () => {
		vi.stubEnv('DEPLOY_MODE', '');
		vi.resetModules();
		const next = await import('./instances.js');
		expect([next.boLbUrl, next.BO_PUBLIC_URL]).toEqual(['http://127.0.0.1:8091', 'http://localhost:8091']);
		vi.stubEnv('DEPLOY_MODE', 'standalone');
		vi.resetModules();
		const alone = await import('./instances.js');
		expect([alone.boLbUrl, alone.BO_PUBLIC_URL, alone.directusUrl]).toEqual([
			'http://127.0.0.1:8090',
			'http://localhost:8090',
			'http://127.0.0.1:8090',
		]);
		vi.unstubAllEnvs();
	});

	it('names replicas like docker compose', () => {
		expect(containerName('backoffice-api', 2)).toBe('bo-deploy-backoffice-api-2');
	});

	it('reads KEY=VALUE lines and skips comments', () => {
		expect(parseEnv('# c\nA=1\nB=x=y\n\nlower=no\n')).toEqual({ A: '1', B: 'x=y' });
	});
});
