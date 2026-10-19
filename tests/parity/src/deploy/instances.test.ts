import { describe, expect, it } from 'vitest';
import { composeArgs, containerName, parseEnv } from './instances.js';

describe('deploy instances', () => {
	it('builds the compose command of each mode', () => {
		expect(composeArgs(['ps'], false, '/tmp/e')).toEqual([
			'compose',
			'-p',
			'bo-deploy',
			'--env-file',
			'/tmp/e',
			'-f',
			'docker-compose.yml',
			'ps',
		]);
		expect(composeArgs(['up'], true, '/tmp/e')).toContain('docker-compose.separate-domain.yml');
	});

	it('names replicas like docker compose', () => {
		expect(containerName('backoffice-api', 2)).toBe('bo-deploy-backoffice-api-2');
	});

	it('reads KEY=VALUE lines and skips comments', () => {
		expect(parseEnv('# c\nA=1\nB=x=y\n\nlower=no\n')).toEqual({ A: '1', B: 'x=y' });
	});
});
