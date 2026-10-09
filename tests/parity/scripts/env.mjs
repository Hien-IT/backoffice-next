// pnpm nx run parity-tests:env-up --vendor=postgres [--profiles=ratelimit,cors-hsts]
// pnpm nx run parity-tests:env-down --vendor=postgres
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { parseArgs } from 'node:util';

const [action] = process.argv.slice(2);

const { values } = parseArgs({
	args: process.argv.slice(3),
	options: {
		vendor: { type: 'string', default: process.env.TEST_DB ?? 'postgres' },
		profiles: { type: 'string', default: '' },
	},
	allowPositionals: true,
});

const profiles = [values.vendor, ...values.profiles.split(',').filter(Boolean)];
const args = [
	'compose',
	'-p',
	`parity-${values.vendor}`,
	'-f',
	'docker-compose.yml',
	...profiles.flatMap((p) => ['--profile', p]),
];

const command =
	action === 'up' ? [...args, 'up', '-d', '--build', '--wait'] : [...args, 'down', '-v', '--remove-orphans'];

// SQLite database shared by both apps (bind mount); recreated on every env-up.
if (action === 'up') {
	rmSync('.data/sqlite', { recursive: true, force: true });
	mkdirSync('.data/sqlite', { recursive: true });
}

const result = spawnSync('docker', command, { stdio: 'inherit', env: { ...process.env, TEST_DB: values.vendor } });
process.exit(result.status ?? 1);
