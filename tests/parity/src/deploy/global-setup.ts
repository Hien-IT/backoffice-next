// Feature 019 (contracts/tests.md): starts deploy/compose with BACKOFFICE_REPLICAS BE replicas (3 by default) and a fresh
// env file, and removes it with its volumes afterwards; DEPLOY_KEEP=1 leaves it running.
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, rmSync } from 'node:fs';
import { COMPOSE_DIR, compose, ENV_FILE, REPLICAS } from './instances.js';

// Test values (contracts/tests.md): a small lockout threshold and TUS chunk so the cases stay short.
const TEST_ENV = ['AUTH_LOGIN_ATTEMPTS=5', 'TUS_CHUNK_SIZE=1mb'];

export default function setup(): () => void {
	process.env['BACKOFFICE_REPLICAS'] ??= String(REPLICAS);
	process.env['BACKOFFICE_TAG'] ??= 'local';
	if (!existsSync(ENV_FILE)) {
		execFileSync('sh', [`${COMPOSE_DIR}init-env.sh`, '--out', ENV_FILE], { stdio: 'inherit' });
		appendFileSync(ENV_FILE, `\n${TEST_ENV.join('\n')}\n`);
	}
	compose('up', '-d', '--wait', '--wait-timeout', '600');

	return () => {
		if (process.env['DEPLOY_KEEP'] === '1') return;
		compose('down', '-v', '--remove-orphans');
		rmSync(ENV_FILE, { force: true });
	};
}
