// Spec 021 US8 (FR-030..FR-032, D-146, D-147): `init` of Directus 11.17.4 and of Backoffice, answered prompt by prompt
// (research R15, T058), on the empty Postgres databases directus_partial and backoffice_partial of postgres-bootstrap
// (both apps install the pg driver path; Directus runs `npm install pg`, Backoffice has it in the image). Migration
// 20251014A reads the schema through the database of the env (DB_*), so `init` runs in the bootstrap containers, whose
// env database is installed; in a container whose env database is empty both apps fail at that migration.
import { spawnSync } from 'node:child_process';
import { afterAll, describe, expect, test } from 'vitest';
import { profileUrls } from '../profiles.js';
import { type CliResult, type PromptStep, execArgs, interactive } from './cli.js';
import { type BootstrapApp, bootstrapDb, dump, emptyBootstrapDb } from './dump.js';
import { normalizeRows, normalizeText } from './normalize.js';

const SERVICES: Record<BootstrapApp, string> = {
	directus: 'directus-bootstrap',
	backoffice: 'backoffice-api-bootstrap',
};
const DIRS: Record<BootstrapApp, string> = {
	directus: '/directus/database/bootstrap/init-directus',
	backoffice: '/directus/database/bootstrap/init-backoffice',
};
const ADMIN_PASSWORD = 'init-admin-pass-5c1e';
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;

/** The prompts of a Postgres `init` (PostgreSQL / Redshift is the first choice in both apps). */
const steps = (database: string): PromptStep[] => [
	{ prompt: 'Choose your database client', keys: '\n' },
	{ prompt: 'Database Host', keys: 'postgres-bootstrap\n' },
	{ prompt: 'Port', keys: '\n' },
	{ prompt: 'Database Name', keys: `${database}\n` },
	{ prompt: 'Database User', keys: 'postgres\n' },
	{ prompt: 'Database Password', keys: 'bootstrap-db-pass-91c2\n' },
	{ prompt: 'Enable SSL', keys: '\n' },
	{ prompt: 'Email', keys: '\n' },
	{ prompt: 'Password', keys: `${ADMIN_PASSWORD}\n` },
];

/** The answered prompts (`✔ Question answer`), in order; the database name typed for each app is `<database>`. */
const answered = (result: CliResult, app: BootstrapApp) =>
	[...result.stdout.replace(ANSI, '').matchAll(/✔ ([^?✔\n]+)/g)].map((m) =>
		m[1]!.trim().replace(`${app}_partial`, '<database>'),
	);

/** What `init` prints after the first admin prompts, with the project directory and branding normalized. */
const closing = (result: CliResult) =>
	normalizeText(result.stdout.replace(ANSI, '').split('\n').slice(-7).join('\n'), { dirs: Object.values(DIRS) });

const runs = {} as Record<BootstrapApp, CliResult>;

describe.skipIf(!profileUrls('bootstrap'))('profile bootstrap: init (US8)', () => {
	afterAll(async () => {
		for (const app of ['directus', 'backoffice'] as const) {
			await interactive(execArgs(SERVICES[app], `rm -rf ${DIRS[app]}`), []);
			await emptyBootstrapDb('postgres', app, `${app}_partial`);
		}
	});

	test('both apps ask the same questions and install the same database', async () => {
		for (const app of ['directus', 'backoffice'] as const) {
			const script = `rm -rf ${DIRS[app]} && mkdir -p ${DIRS[app]} && cd ${DIRS[app]} && printf 'OLD=1\\n' > .env && node /directus/cli.js init`;
			runs[app] = await interactive(execArgs(SERVICES[app], script, { PROJECT_OWNER: '' }), steps(`${app}_partial`));
			expect(runs[app].code, runs[app].stdout + runs[app].stderr).toBe(0);
		}

		expect(answered(runs.backoffice, 'backoffice')).toEqual(answered(runs.directus, 'directus'));
		expect(closing(runs.backoffice)).toEqual(closing(runs.directus));
		expect(runs.backoffice.stdout).not.toContain('Installing Database Driver');

		const dumps = {} as Record<BootstrapApp, Awaited<ReturnType<typeof dump>>>;

		for (const app of ['directus', 'backoffice'] as const) {
			const db = bootstrapDb('postgres', app, `${app}_partial`);

			try {
				dumps[app] = await dump(db);
			} finally {
				await db.destroy();
			}
		}

		expect(dumps.backoffice.tables).toEqual(dumps.directus.tables);
		expect(normalizeRows(dumps.backoffice.rows)).toEqual(normalizeRows(dumps.directus.rows));
		expect(dumps.backoffice.rows['directus_migrations']).toHaveLength(101);
	}, 600_000);

	test('.env: the Directus template (D-147), the answers, a new SECRET, mode 0640, the old file replaced', async () => {
		const env = {} as Record<BootstrapApp, string>;

		for (const app of ['directus', 'backoffice'] as const) {
			const read = await interactive(execArgs(SERVICES[app], `cd ${DIRS[app]} && stat -c %a .env && cat .env`), []);
			const [mode, ...lines] = read.stdout.split('\n');
			expect(mode, app).toBe('640');

			env[app] = normalizeText(lines.join('\n'))
				.replace(/^SECRET=".{32}"$/m, 'SECRET="<nanoid32>"')
				.replace(`${app}_partial`, '<database>');
		}

		expect(env.backoffice).not.toContain('OLD=1');
		expect(env.backoffice).toContain('DB_CLIENT="pg"');
		// D-147: the link to the Directus documentation is not in the Backoffice template.
		expect(env.backoffice).toEqual(
			env.directus.replace(
				'# The following options are not all possible options. For more, see\n# https://docs.directus.io/self-hosted/config-options/\n',
				'# The following options are not all possible options.\n',
			),
		);
	});

	test('Backoffice starts with that .env and the first admin signs in', async () => {
		const login = JSON.stringify({ email: 'admin@example.com', password: ADMIN_PASSWORD });
		const script = [
			'(node /directus/cli.js start > /dev/null 2>&1 &)',
			'for i in $(seq 1 60); do wget -qO- http://127.0.0.1:8055/server/ping > /dev/null 2>&1 && break; sleep 1; done',
			`wget -qO- --header 'content-type: application/json' --post-data '${login}' http://127.0.0.1:8055/auth/login`,
		].join('; ');

		// A new container in the project directory, on its own Redis db and namespaces (.env sets no REDIS).
		const result = await interactive(
			[
				'run',
				'--rm',
				'--no-deps',
				'-T',
				'-w',
				DIRS.backoffice,
				'-e',
				'REDIS=redis://redis:6379/14',
				'-e',
				'CACHE_NAMESPACE=parity-init-b',
				'-e',
				'REDIS_BUS_NAMESPACE=parity-init-b:bus',
				'-e',
				'REDIS_LOCK_NAMESPACE=parity-init-b:lock',
				'--entrypoint',
				'sh',
				SERVICES.backoffice,
				'-c',
				script,
			],
			[],
		);

		expect(result.code, result.stdout + result.stderr).toBe(0);
		expect(JSON.parse(result.stdout.slice(result.stdout.indexOf('{'))).data.access_token).toBeTruthy();
	}, 180_000);

	test('with an empty env database, both apps fail at migration 20251014A and ask again', async () => {
		const failures = {} as Record<BootstrapApp, string>;

		for (const app of ['directus', 'backoffice'] as const) {
			await emptyBootstrapDb('postgres', app, `${app}_partial`);

			// A plain container of the image: its DB_* defaults point at an SQLite file that does not exist yet.
			const result = await interactive(
				[
					'run',
					'--rm',
					'--no-deps',
					'-T',
					'--name',
					`bo-init-empty-${app}`,
					'-w',
					'/tmp',
					'-e',
					'DB_CLIENT=sqlite3',
					'-e',
					'DB_FILENAME=/tmp/env.db',
					'-e',
					'PROJECT_OWNER=',
					'--entrypoint',
					'node',
					SERVICES[app],
					'/directus/cli.js',
					'init',
				],
				steps(`${app}_partial`),
				{ stopOn: 'Please try again' },
			);

			// The compose client is killed at the second prompt round; its container is removed here.
			spawnSync('docker', ['rm', '-f', `bo-init-empty-${app}`]);

			const text = result.stdout.replace(ANSI, '');
			// Up to "Please try again": the process is killed there, so the next prompt may or may not be printed yet.
			const end = text.indexOf('Please try again');
			expect(end, text).toBeGreaterThan(-1);
			failures[app] = text.slice(text.indexOf('Something went wrong while seeding the database:'), end);
		}

		expect(failures.directus).toContain('no such table: directus_collections');
		expect(failures.backoffice).toEqual(failures.directus);
	}, 600_000);
});
