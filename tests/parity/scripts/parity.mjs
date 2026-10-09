// pnpm nx run parity-tests:parity --vendor=postgres  (PARITY_SUITE=full|reduced)
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
	options: { vendor: { type: 'string' } },
	allowPositionals: true,
	strict: false,
});

// --vendor wins over an existing TEST_DB.
const env = { ...process.env, TEST_DB: values.vendor ?? process.env.TEST_DB ?? 'postgres' };
const result = spawnSync('pnpm', ['exec', 'vitest', 'run', '-c', 'vitest.parity.config.ts', ...positionals], {
	stdio: 'inherit',
	env,
});
process.exit(result.status ?? 1);
