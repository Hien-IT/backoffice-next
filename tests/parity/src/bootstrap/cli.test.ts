// Spec 021 US3 (FR-102, FR-040..FR-059, FR-016): every CLI command runs in directus-bootstrap and in
// backoffice-api-bootstrap with the same arguments, each on its own database bootstrapped the same way; exit code,
// stdout and the (level, msg) log lines must be equal after the FR-107 rules. Commands that write (users, roles,
// schema apply) run on both databases and their rows are compared; the file removes what it wrote.
import yaml from 'js-yaml';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { profileUrls } from '../profiles.js';
import { newConnection } from '../redis.js';
import { type CliResult, cli, cliRun, composeOk, profileEnv } from './cli.js';
import { type BootstrapApp, bootstrapDb } from './dump.js';
import { UuidMap, normalizeLogs, normalizeText } from './normalize.js';

const vendor = getDbsToTest()[0]!;
const pair = profileUrls('bootstrap');
const SERVICES: Record<BootstrapApp, string> = {
	directus: 'directus-bootstrap',
	backoffice: 'backoffice-api-bootstrap',
};
const SHARED_DIR = '/directus/database/bootstrap';
/** Per-app folders of the snapshot files (same file names, so the logged paths compare equal as `<dir>`). */
const FILE_DIRS: Record<BootstrapApp, string> = {
	directus: `${SHARED_DIR}/cli-directus`,
	backoffice: `${SHARED_DIR}/cli-backoffice`,
};
const APPS = ['directus', 'backoffice'] as const;

const outputs: string[] = [];
const versions: string[] = [];
const dbs = {} as Record<BootstrapApp, ReturnType<typeof bootstrapDb>>;

/** The comparable form of a run: exit code, stdout and pino lines (both apps share one uuid numbering per call). */
function comparable(result: CliResult, uuids: UuidMap) {
	const options = { versions, uuids, dirs: Object.values(FILE_DIRS) };
	const text = (result.stdout + result.stderr).split('\n');
	const plain = text.filter((line) => !line.trimStart().startsWith('{')).join('\n');

	return {
		code: result.code,
		output: normalizeText(plain, options).trim(),
		logs: normalizeLogs(result.stdout + result.stderr, options).map((l) => `${l.level} ${l.msg}`),
	};
}

/** Lets Vitest's worker RPC replies in between the synchronous docker commands (CI: "Timeout calling onTaskUpdate"). */
const yieldToVitest = () => new Promise((resolve) => setImmediate(resolve));

/** Runs `node cli.js <args>` in both apps (per-app arguments when `args` is a function) and returns both results. */
async function both(args: string[] | ((app: BootstrapApp) => string[]), env: Record<string, string> = {}) {
	const results = {} as Record<BootstrapApp, CliResult>;

	for (const app of APPS) {
		await yieldToVitest();
		results[app] = cli(SERVICES[app], typeof args === 'function' ? args(app) : args, env);
		outputs.push(results[app].stdout + results[app].stderr);
	}

	return results;
}

/** Both apps give the same exit code, output and log lines; uuids are numbered per app so equal rows compare equal. */
function expectSame(results: Record<BootstrapApp, CliResult>, code?: number) {
	const directus = comparable(results.directus, new UuidMap());
	const backoffice = comparable(results.backoffice, new UuidMap());

	expect(backoffice).toEqual(directus);
	if (code !== undefined) expect(directus.code).toBe(code);
	return directus;
}

type SnapshotDocument = { fields: { collection: string; field: string }[] } & Record<string, unknown>;

/** The snapshot a `schema snapshot` printed to stdout (pino lines left out), versions normalized, parsed. */
function snapshotOf(result: CliResult, format: 'yaml' | 'json'): SnapshotDocument {
	const text = result.stdout
		.split('\n')
		.filter((line) => !/^\s*\{"level":/.test(line))
		.join('\n');
	const normalized = normalizeText(text, { versions });

	return (format === 'json' ? JSON.parse(normalized) : yaml.load(normalized)) as SnapshotDocument;
}

/** Spec 022 FR-019 (D-180): the bo_* fields the Backoffice migrations add to directus_* tables. */
const isBackofficeField = (f: { collection: string; field: string }) =>
	f.collection.startsWith('directus_') && f.field.startsWith('bo_');

const withoutBackofficeFields = (snapshot: SnapshotDocument): SnapshotDocument => ({
	...snapshot,
	fields: snapshot.fields.filter((f) => !isBackofficeField(f)),
});

/** The last line of stdout: what the command prints after the "Extensions loaded" log line. */
const lastLine = (result: CliResult) => result.stdout.trim().split('\n').at(-1)!.trim();

const adminRole = async (app: BootstrapApp) =>
	(await dbs[app]('directus_roles').where({ name: 'Administrator' }).first()).id as string;

// Each command starts a Node process per app (about 2.5 s with the extensions), so the cases get several minutes.
describe.skipIf(!pair)('profile bootstrap: the CLI of both apps (US3)', { timeout: 300_000 }, () => {
	beforeAll(() => {
		for (const app of APPS) dbs[app] = bootstrapDb(vendor, app);
		versions.push(lastLine(cli(SERVICES.directus, ['--version'])), lastLine(cli(SERVICES.backoffice, ['--version'])));
	});

	afterAll(async () => {
		composeOk('exec', '-T', SERVICES.backoffice, 'sh', '-c', `rm -rf ${Object.values(FILE_DIRS).join(' ')}`);

		for (const app of APPS) {
			const users = dbs[app]('directus_users').select('id').where('email', 'like', 'cli-user%');
			await dbs[app]('directus_access').whereIn('user', users).delete();
			await dbs[app]('directus_users').where('email', 'like', 'cli-user%').delete();

			const roles = dbs[app]('directus_roles').select('id').where({ name: 'CliRole' });
			await dbs[app]('directus_access').whereIn('role', roles).delete();
			await dbs[app]('directus_roles').where({ name: 'CliRole' }).delete();
			await dbs[app]('directus_policies').where({ name: 'Policy for CliRole' }).delete();
			await dbs[app].destroy();
		}
	});

	describe('help, version and commander errors (FR-040, FR-044)', () => {
		const COMMANDS = [
			[],
			['start'],
			['init'],
			['security'],
			['security', 'key:generate'],
			['security', 'secret:generate'],
			['database'],
			['database', 'install'],
			['database', 'migrate:latest'],
			['database', 'migrate:up'],
			['database', 'migrate:down'],
			['users'],
			['users', 'create'],
			['users', 'passwd'],
			['roles'],
			['roles', 'create'],
			['cache'],
			['cache', 'clear'],
			['count'],
			['bootstrap'],
			['schema'],
			['schema', 'snapshot'],
			['schema', 'apply'],
		];

		test.each(COMMANDS)('%s --help', async (...command) => {
			expectSame(await both([...command, '--help']), 0);
		});

		test('--version prints each program version', async () => {
			const results = await both(['--version']);
			expect(lastLine(results.directus)).toBe('11.17.4');
			expectSame(results, 0);
		});

		test.each([[['nope']], [['bootstrap', '--nope']], [['count']], [['schema', 'snapshot', '--format', 'xml']]])(
			'%j fails like Directus',
			async (args) => {
				expectSame(await both(args), 1);
			},
		);
	});

	describe('commands that only read (FR-054, FR-055)', () => {
		test('security key:generate and secret:generate', async () => {
			const key = await both(['security', 'key:generate']);
			expect(lastLine(key.backoffice)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
			expectSame(key, 0);

			const secret = await both(['security', 'secret:generate']);
			expect(lastLine(secret.directus)).toMatch(/^[A-Za-z0-9_-]{32}$/);
			expect(lastLine(secret.backoffice)).toMatch(/^[A-Za-z0-9_-]{32}$/);
			expect(secret.backoffice.code).toBe(secret.directus.code);
		});

		test('count of a system collection and of a missing table', async () => {
			expectSame(await both(['count', 'directus_roles']), 0);
			expectSame(await both(['count', 'bo_missing_table']), 1);
		});

		test('database install on an installed database, migrate:latest with nothing pending', async () => {
			expectSame(await both(['database', 'install']), 1);
			expectSame(await both(['database', 'migrate:latest']), 0);
		});

		test('schema snapshot to stdout, in YAML and JSON', async () => {
			for (const format of ['yaml', 'json'] as const) {
				const results = await both(['schema', 'snapshot', ...(format === 'json' ? ['--format', 'json'] : [])]);
				const backoffice = snapshotOf(results.backoffice, format);

				expect(results.directus.code).toBe(0);
				expect(results.backoffice.code).toBe(0);
				// D-180: the Backoffice database also has the three bo_* fields of migration 20261026A.
				expect(backoffice.fields.filter(isBackofficeField).map((f) => f.field).sort()).toEqual([
					'bo_show_export',
					'bo_show_import',
					'bo_show_search',
				]);
				expect(withoutBackofficeFields(backoffice)).toEqual(snapshotOf(results.directus, format));
				expect(comparable(results.backoffice, new UuidMap()).logs).toEqual(
					comparable(results.directus, new UuidMap()).logs,
				);
			}
		});
	});

	describe('commands that write (FR-050..FR-053, FR-056, FR-057)', () => {
		test('users create, then passwd with another case of the e-mail', async () => {
			expectSame(await both(['users', 'create', '--email', 'cli-user@example.com']), 1);

			const roles = { directus: await adminRole('directus'), backoffice: await adminRole('backoffice') };
			const create = (app: BootstrapApp) => [
				...['users', 'create', '--email', 'cli-user@example.com', '--password', 'cli-user-pass'],
				...['--role', roles[app]],
			];
			const results = await both(create);

			expectSame(results, 0);
			// The same e-mail again: the unique constraint error of each app.
			expectSame(await both(create), 1);

			for (const app of APPS) {
				const user = await dbs[app]('directus_users').where({ email: 'cli-user@example.com' }).first();
				expect(lastLine(results[app])).toBe(user.id);
				expect(user).toMatchObject({ status: 'active', role: roles[app] });
			}

			expectSame(
				await both(['users', 'passwd', '--email', 'CLI-USER@example.com', '--password', 'cli-user-pass-2']),
				0,
			);
			expectSame(await both(['users', 'passwd', '--email', 'nobody@example.com', '--password', 'x']), 1);
			expectSame(await both(['users', 'passwd', '--email', 'cli-user@example.com']), 1);
		});

		test('roles create with admin and app access', async () => {
			expectSame(await both(['roles', 'create']), 1);
			expectSame(await both(['roles', 'create', '--role', 'CliRole', '--admin', '--app']), 0);

			for (const app of APPS) {
				const role = await dbs[app]('directus_roles').where({ name: 'CliRole' }).first();
				const access = await dbs[app]('directus_access').where({ role: role.id }).first();
				const policy = await dbs[app]('directus_policies').where({ id: access.policy }).first();
				expect(policy).toMatchObject({ name: 'Policy for CliRole', icon: 'supervised_user_circle' });
				expect(Boolean(policy.admin_access) && Boolean(policy.app_access)).toBe(true);
			}
		});

		test('cache clear empties the namespace of the app (FR-053)', async () => {
			const redis = newConnection();
			await redis.select(11);

			try {
				await fetch(`${pair!.backofficeUrl}/collections`, {
					headers: { authorization: `Bearer ${profileEnv(vendor)['ADMIN_TOKEN']}` },
				});

				for (const flags of [['--system'], ['--data'], []]) {
					expectSame(await both(['cache', 'clear', ...flags]), 0);
				}

				const keys = (await redis.keys('parity-bootstrap-b*')).filter((k) => !k.includes(':lock'));
				expect(keys).toEqual([]);
			} finally {
				await redis.quit();
			}
		});

		test('schema apply: dry-run plans, apply, ignoreRules, nothing to apply', async () => {
			const file = (name: string) => (app: BootstrapApp) => `${FILE_DIRS[app]}/${name}.json`;
			composeOk('exec', '-T', SERVICES.backoffice, 'sh', '-c', `mkdir -p ${Object.values(FILE_DIRS).join(' ')}`);
			const before = file('before');
			const after = file('after');
			const token = profileEnv(vendor)['ADMIN_TOKEN'];

			expectSame(await both((app) => ['schema', 'snapshot', '-y', '--format', 'json', before(app)]), 0);

			// The same collection made through each app's REST API, then snapshotted.
			for (const [app, url] of [
				['directus', pair!.directusUrl],
				['backoffice', pair!.backofficeUrl],
			] as const) {
				const res = await fetch(`${url}/collections`, {
					method: 'POST',
					headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
					body: JSON.stringify({
						collection: 'bo_cli_schema',
						schema: {},
						meta: {},
						fields: [
							{
								field: 'id',
								type: 'integer',
								meta: { hidden: true },
								schema: { is_primary_key: true, has_auto_increment: true },
							},
							{ field: 'title', type: 'string', meta: {}, schema: {} },
						],
					}),
				});
				expect(res.status, app).toBe(200);
			}

			expectSame(await both((app) => ['schema', 'snapshot', '-y', '--format', 'json', after(app)]), 0);

			expectSame(await both((app) => ['schema', 'apply', '--dry-run', before(app)]), 0);
			expectSame(await both((app) => ['schema', 'apply', '-y', before(app)]), 0);
			expectSame(await both((app) => ['schema', 'apply', '-y', before(app)]), 0);
			expectSame(await both((app) => ['schema', 'apply', '--dry-run', after(app)]), 0);
			expectSame(await both((app) => ['schema', 'apply', '--ignoreRules', 'bo_cli_schema', after(app)]), 0);
			expectSame(await both((app) => ['schema', 'apply', '-y', after(app)]), 0);

			for (const app of APPS) {
				const fields = await dbs[app]('directus_fields').where({ collection: 'bo_cli_schema' }).orderBy('field');
				expect(
					fields.map((f) => f.field),
					app,
				).toEqual(['id', 'title']);
			}

			expectSame(await both((app) => ['schema', 'apply', '-y', before(app)]), 0);
			expectSame(await both((app) => ['schema', 'apply', `${FILE_DIRS[app]}/missing.json`]), 1);
		});
	});

	test('bootstrap with a wrong DB_PASSWORD: same exit code, no secret in the output (FR-016)', async () => {
		const wrong = 'cli-wrong-db-pass-3e9d';
		const results = {} as Record<BootstrapApp, CliResult>;

		for (const app of APPS) {
			await yieldToVitest();
			results[app] = cliRun(SERVICES[app], ['bootstrap'], { DB_PASSWORD: wrong });
			outputs.push(results[app].stdout + results[app].stderr);
		}

		expect(results.backoffice.code).toBe(results.directus.code);
		expect(results.backoffice.stdout + results.backoffice.stderr).not.toContain(wrong);
	}, 120_000);

	test('no output of this file holds a secret of the env (FR-016)', () => {
		const env = profileEnv(vendor);

		for (const name of ['ADMIN_PASSWORD', 'ADMIN_TOKEN', 'DB_PASSWORD', 'SECRET', 'KEY']) {
			const value = env[name];
			if (!value) continue;
			expect(outputs.filter((o) => o.includes(value)).length, name).toBe(0);
		}
	});
});
