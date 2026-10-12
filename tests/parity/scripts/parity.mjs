// pnpm nx run parity-tests:parity --vendor=postgres  (PARITY_SUITE=full|reduced|matrix|blackbox|cache)
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
	options: { vendor: { type: 'string' } },
	allowPositionals: true,
	strict: false,
});

// --vendor wins over an existing TEST_DB.
const env = { ...process.env, TEST_DB: values.vendor ?? process.env.TEST_DB ?? 'postgres' };

const vitest = (config, extraEnv = {}, extraArgs = []) =>
	spawnSync('pnpm', ['exec', 'vitest', 'run', '-c', config, ...extraArgs, ...positionals], {
		stdio: 'inherit',
		env: { ...env, ...extraEnv },
	}).status ?? 1;

// Feature 005 (research R6): the blackbox port runs unchanged once against each app; the Directus run proves the port.
if (env.PARITY_SUITE === 'blackbox') {
	for (const app of ['backoffice', 'directus']) {
		process.stdout.write(`\n=== blackbox items, query and relational at ${app} ===\n\n`);
		const status = vitest('src/items/blackbox/vitest.blackbox.config.ts', { PARITY_BLACKBOX_APP: app });
		if (status !== 0) process.exit(status);
	}

	process.exit(0);
}

// CI splits `full` on Postgres into jobs with PARITY_SHARD=<i>/<n> (vitest --shard); unset runs every file.
process.exit(vitest('vitest.parity.config.ts', {}, env.PARITY_SHARD ? [`--shard=${env.PARITY_SHARD}`] : []));
