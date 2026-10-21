// Feature 019 (contracts/tests.md): starts deploy/compose with BACKOFFICE_REPLICAS BE replicas (3 by default) and a fresh
// env file, and removes it with its volumes afterwards; DEPLOY_KEEP=1 leaves it running.
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, rmSync } from 'node:fs';
import { COMPOSE_DIR, compose, ENV_FILE, REPLICAS } from './instances.js';

export default function setup(): () => void {
	process.env['BACKOFFICE_REPLICAS'] ??= String(REPLICAS);
	process.env['BACKOFFICE_TAG'] ??= 'local';
	if (!existsSync(ENV_FILE)) {
		execFileSync('sh', [`${COMPOSE_DIR}init-env.sh`, '--out', ENV_FILE], { stdio: 'inherit' });
		// Spec 020 (T177): every node installs from the fake registry of the `extensions-test` profile.
		appendFileSync(ENV_FILE, '\nMARKETPLACE_REGISTRY=http://registry:9100\n');
		// The load of shutdown.test.ts (20 connections on a CI runner) met the pressure limiter of the restarted replica
		// (16 x 503 "Under pressure", answered before the request log, CI 39641635370): the suite checks graceful stops and
		// readiness, not overload, so it runs without the limiter like profile-blackbox.env.
		appendFileSync(ENV_FILE, 'PRESSURE_LIMITER_ENABLED=false\n');
	}
	compose('--profile', 'extensions-test', 'up', '-d', '--wait', '--wait-timeout', '600');

	return () => {
		if (process.env['DEPLOY_KEEP'] === '1') return;
		compose('--profile', 'extensions-test', 'down', '-v', '--remove-orphans');
		rmSync(ENV_FILE, { force: true });
	};
}
