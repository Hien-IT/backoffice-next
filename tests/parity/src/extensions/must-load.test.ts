// Spec 020 US1 (FR-014, T036): a hook extension whose code throws when it is imported, in the storage prefix of the
// extensions pair. EXTENSIONS_MUST_LOAD=false: both apps start, answer /server/health and warn that the hook could not
// be registered; true: both log the must-load error and exit the process (the new app's container exits non-zero;
// pm2-runtime in the Directus image starts the process again, so its container keeps running). The broken folder is
// removed and the pair restarted afterwards. (An invalid manifest is skipped silently by both apps, so it is not used.)
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { profilePorts } from '../config.js';
import { compose } from '../docker.js';
import { containerLog, mc } from './helpers.js';

const full = process.env['PARITY_SUITE'] !== 'reduced';
const BROKEN = 'local/directus/extensions-ext/parity-broken';
const MANIFEST =
	'{"name":"parity-broken","version":"1.0.0","type":"module","directus:extension":{"type":"hook","path":"dist/index.js","source":"src/index.js","host":"^11.0.0"}}';

const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const restartPair = () =>
	compose('up', '-d', '--wait', '--force-recreate', '--no-deps', 'directus-extensions', 'backoffice-api-extensions');

describe.runIf(full)('EXTENSIONS_MUST_LOAD with an extension that throws', () => {
	let since: Date;

	beforeAll(() => {
		mc(
			`echo '${MANIFEST}' | mc pipe ${BROKEN}/package.json && ` +
				`echo 'throw new Error("parity-broken");' | mc pipe ${BROKEN}/dist/index.js`,
		);
		since = new Date();
		restartPair();
	}, 300_000);

	afterAll(() => {
		mc(`mc rm --recursive --force ${BROKEN}`);
		restartPair();
	}, 300_000);

	it('false (default): both apps are healthy and warn about the hook', async () => {
		for (const [service, port] of [
			['directus-extensions', profilePorts.extensions.directus],
			['backoffice-api-extensions', profilePorts.extensions.backoffice],
		] as const) {
			const health = await fetch(`http://127.0.0.1:${port}/server/health`);
			expect(health.status, service).toBe(200);
			expect(containerLog(service, since), service).toContain('Couldn\'t register hook "parity-broken"');
		}
	});

	it('true: both log the must-load error; the new app exits with a non-zero code', async () => {
		for (const service of ['directus-extensions', 'backoffice-api-extensions']) {
			const id = compose('run', '-d', '--no-deps', '-e', 'EXTENSIONS_MUST_LOAD=true', service)
				.trim()
				.split('\n')
				.at(-1)!;

			try {
				let logs = '';

				for (let i = 0; i < 120 && !logs.includes('EXTENSION_MUST_LOAD is enabled'); i++) {
					await sleep(1000);
					logs = docker('logs', id);
				}

				expect(logs, service).toContain('EXTENSION_MUST_LOAD is enabled and an extension failed to load.');

				if (service === 'backoffice-api-extensions') {
					expect(Number(docker('wait', id)), service).not.toBe(0);
				}
			} finally {
				docker('rm', '-f', id);
			}
		}
	}, 300_000);
});
