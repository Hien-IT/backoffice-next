// pnpm nx run parity-tests:env-up --vendor=postgres [--profiles=ratelimit,cors-hsts]
// pnpm nx run parity-tests:env-down --vendor=postgres
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, rmSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { writeNginxConf } from './proxy-conf.mjs';

const [action] = process.argv.slice(2);

const { values } = parseArgs({
	args: process.argv.slice(3),
	options: {
		vendor: { type: 'string', default: process.env.TEST_DB ?? 'postgres' },
		profiles: { type: 'string', default: '' },
	},
	allowPositionals: true,
});

// `down` enables every profile, otherwise the containers of the profile pairs would keep running.
const ALL_PROFILES = [
	'ratelimit',
	'cors-hsts',
	'pressure',
	'metrics',
	'multi',
	'cache-config',
	'sso',
	'user-limits',
	'app',
	// Feature 005 (research R5)
	'cache-mem',
	'cache-mem-purge',
	'cache-redis',
	'cache-redis-purge',
	'websocket',
	'blackbox',
	// Feature 006 (research R7)
	'schema-cache',
	'schema-cache-nomsg',
	'tz-asia',
	'tz-america',
	// Feature 007 (research R8)
	'assets-limit',
	'assets-stress',
];
const profiles = [values.vendor, ...(action === 'up' ? values.profiles.split(',').filter(Boolean) : ALL_PROFILES)];
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
	// Profile `app` (feature 004): the reverse proxy reads proxy/nginx.conf, generated from the route list.
	writeNginxConf();
	rmSync('.data/sqlite', { recursive: true, force: true });
	mkdirSync('.data/sqlite', { recursive: true });
	// Both containers run as uid 1000 (node), the CI runner user is another uid: let them create the file.
	chmodSync('.data/sqlite', 0o777);
	// Feature 007: files-fixtures serves this directory; made by the runner before Docker would make it as root.
	mkdirSync('.data/files-runtime', { recursive: true });
}

const env = { ...process.env, TEST_DB: values.vendor };
const result = spawnSync('docker', command, { stdio: 'inherit', env });

// Directus creates data.db as uid 1000 with mode 0644; the blackbox tests of feature 006 write it from the runner.
if (action === 'up' && values.vendor === 'sqlite3' && result.status === 0) {
	const chmod = ['exec', '-T', 'directus', 'chmod', '666', '/directus/database/sqlite/data.db'];
	const fixed = spawnSync('docker', [...args, ...chmod], { stdio: 'inherit', env });
	process.exit(fixed.status ?? 1);
}

process.exit(result.status ?? 1);
