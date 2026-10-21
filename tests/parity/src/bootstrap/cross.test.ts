// Spec 021 US2 and US4 on profile bootstrap (FR-020, FR-024, FR-035, FR-036, FR-101, SC-002, SC-004): restarting on an
// installed database only runs the pending migrations; the custom migrations of fixtures/migrations run the same way in
// both apps; Directus 11.17.4 runs and migrates the database Backoffice bootstrapped, and the two apps take turns on
// migrate up/down of that database with the response cache flushed after each step. The file leaves both databases as
// it found them (custom migrations rolled back, test collection removed, services back on the default MIGRATIONS_PATH).
import { createInspector } from '@backoffice/schema';
import type { Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { bootstrapCrossPort } from '../config.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { profileUrls } from '../profiles.js';
import { type CliResult, cli, cliRun, composeOk, profileEnv, serviceLogs } from './cli.js';
import { type BootstrapApp, bootstrapDb } from './dump.js';
import { normalizeLogs } from './normalize.js';

const pair = profileUrls('bootstrap');
const vendor = getDbsToTest()[0]!;
const CROSS = `http://127.0.0.1:${bootstrapCrossPort}`;
const SERVICES: Record<BootstrapApp, string> = {
	directus: 'directus-bootstrap',
	backoffice: 'backoffice-api-bootstrap',
};
const OK = '/directus/migrations/ok';
const OK_VERSIONS = ['20990101A', '20990102A', '20990103A'];
const CACHE_COLLECTION = 'bo_bootstrap_cache';

const dbs = {} as Record<BootstrapApp, Knex>;

const versions = async (db: Knex) =>
	(await db.select('version', 'name').from('directus_migrations').orderBy('version')).map(
		(r) => `${r.version} ${r.name}`,
	);

/** What the custom migrations of fixtures/migrations/ok change: their rows, the sample table columns and rows. */
async function migrationState(db: Knex) {
	const inspector = createInspector(db);
	const hasSample = await inspector.hasTable('bo_migration_sample');

	return {
		migrations: await versions(db),
		columns: hasSample ? (await inspector.columnInfo('bo_migration_sample')).map((c) => c.name).sort() : null,
		rows: hasSample ? (await db.select('name').from('bo_migration_sample').orderBy('name')).map((r) => r.name) : null,
	};
}

async function rowCounts(db: Knex) {
	const tables = (await createInspector(db).tables()).filter((t) => t.startsWith('directus_')).sort();
	const counts: Record<string, number> = {};
	for (const table of tables) counts[table] = Number((await db(table).count('* as n'))[0]!['n']);
	return counts;
}

/** Recreates services of the profile so they read the current BOOTSTRAP_MIGRATIONS_DIR, and waits until healthy. */
const recreate = (...services: string[]) =>
	composeOk('up', '-d', '--force-recreate', '--no-deps', '--wait', ...services);

const output = (result: CliResult) => result.stdout + result.stderr;
const token = () => profileEnv(vendor)['ADMIN_TOKEN']!;

async function api(url: string, path: string, init: RequestInit = {}) {
	const res = await fetch(`${url}${path}`, {
		...init,
		headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json', ...init.headers },
	});

	return { status: res.status, cache: res.headers.get('x-cache-status'), body: await res.text() };
}

/** First read of the test collection is a MISS at `first`, the same read is a HIT at the other app (shared cache). */
async function expectFlushedThenShared(first: string, second: string) {
	expect((await api(first, `/items/${CACHE_COLLECTION}`)).cache).toBe('MISS');
	expect((await api(second, `/items/${CACHE_COLLECTION}`)).cache).toBe('HIT');
}

describe.skipIf(!pair)('profile bootstrap: installed database and shared migrations (US2, US4)', () => {
	beforeAll(() => {
		dbs.directus = bootstrapDb(vendor, 'directus');
		dbs.backoffice = bootstrapDb(vendor, 'backoffice');
	});

	afterAll(async () => {
		// Undo what this file applied, newest first, then put the services back on the default MIGRATIONS_PATH.
		for (const app of ['directus', 'backoffice'] as const) {
			const applied = (await versions(dbs[app])).filter((v) => OK_VERSIONS.includes(v.split(' ')[0]!));

			for (let i = 0; i < applied.length; i++) {
				cli(SERVICES[app], ['database', 'migrate:down'], { MIGRATIONS_PATH: OK });
			}
		}

		await api(CROSS, `/collections/${CACHE_COLLECTION}`, { method: 'DELETE' });
		delete process.env['BOOTSTRAP_MIGRATIONS_DIR'];
		recreate(SERVICES.directus, SERVICES.backoffice);

		await dbs.directus.destroy();
		await dbs.backoffice.destroy();
	});

	test('a restart with no new migration only logs the Directus lines and writes no row (US2)', async () => {
		const before = await rowCounts(dbs.backoffice);

		recreate(SERVICES.backoffice);

		const messages = normalizeLogs(serviceLogs(SERVICES.backoffice)).map((l) => l.msg);
		const from = messages.indexOf('Initializing bootstrap...');

		expect(messages.slice(from, from + 4)).toEqual([
			'Initializing bootstrap...',
			'Database already initialized, skipping install',
			'Running migrations...',
			'Done',
		]);
		expect(await rowCounts(dbs.backoffice)).toEqual(before);
	});

	test('Directus 11.17.4 starts, signs in, writes and migrates on the database Backoffice bootstrapped (FR-035)', async () => {
		const health = await api(CROSS, '/server/health');
		expect(health.body).not.toContain('"error"');
		expect(serviceLogs('directus-on-backoffice-db')).not.toContain('Database migrations have not all been run');

		const env = profileEnv(vendor);
		const login = await fetch(`${CROSS}/auth/login`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: env['ADMIN_EMAIL'], password: env['ADMIN_PASSWORD'] }),
		});
		expect(login.status).toBe(200);

		const collection = await api(CROSS, '/collections', {
			method: 'POST',
			body: JSON.stringify({ collection: CACHE_COLLECTION, schema: {}, meta: {} }),
		});
		expect(collection.status).toBe(200);
		expect((await api(CROSS, `/items/${CACHE_COLLECTION}`, { method: 'POST', body: '{}' })).status).toBe(200);

		const migrate = cli('directus-on-backoffice-db', ['database', 'migrate:latest']);
		expect(migrate.code).toBe(0);
		expect(output(migrate)).toContain('Database up to date');
		expect(output(migrate)).not.toContain('Applying');
	});

	test('custom migrations in MIGRATIONS_PATH run at start in both apps (US2, FR-020)', async () => {
		const before = { directus: await versions(dbs.directus), backoffice: await versions(dbs.backoffice) };

		process.env['BOOTSTRAP_MIGRATIONS_DIR'] = OK;
		recreate(SERVICES.directus, SERVICES.backoffice);

		const added = {
			directus: (await versions(dbs.directus)).filter((v) => !before.directus.includes(v)),
			backoffice: (await versions(dbs.backoffice)).filter((v) => !before.backoffice.includes(v)),
		};

		expect(added.directus).toEqual([
			'20990101A Create Sample',
			'20990102A Add Column Default',
			'20990103A In Transaction',
		]);
		expect(added.backoffice).toEqual(added.directus);
		expect(await migrationState(dbs.backoffice)).toEqual(await migrationState(dbs.directus));
	});

	test('the two apps take turns on migrate down/up of one database, the cache flushed after each step (US4)', async () => {
		const backofficeUrl = pair?.backofficeUrl ?? '';
		const latest = await migrationState(dbs.backoffice);

		await expectFlushedThenShared(backofficeUrl, CROSS);

		const step = async (service: string, direction: 'up' | 'down') => {
			const result = cli(service, ['database', `migrate:${direction}`], { MIGRATIONS_PATH: OK });
			expect(result.code, output(result)).toBe(0);
			return migrationState(dbs.backoffice);
		};

		const downByDirectus = await step('directus-on-backoffice-db', 'down');
		expect(downByDirectus.migrations).toEqual(latest.migrations.slice(0, -1));
		await expectFlushedThenShared(CROSS, backofficeUrl);

		expect(await step(SERVICES.backoffice, 'up')).toEqual(latest);
		await expectFlushedThenShared(backofficeUrl, CROSS);

		expect(await step(SERVICES.backoffice, 'down')).toEqual(downByDirectus);
		await expectFlushedThenShared(CROSS, backofficeUrl);

		expect(await step('directus-on-backoffice-db', 'up')).toEqual(latest);
		await expectFlushedThenShared(backofficeUrl, CROSS);
	});

	describe('custom migrations both apps refuse (FR-020, FR-024)', () => {
		const run = async (directory: string) => {
			const result = {} as Record<BootstrapApp, { code: number; logs: string[]; added: string[]; text: string }>;

			for (const app of ['directus', 'backoffice'] as const) {
				const before = await versions(dbs[app]);
				const res = cli(SERVICES[app], ['database', 'migrate:latest'], { MIGRATIONS_PATH: directory });
				const after = await versions(dbs[app]);

				result[app] = {
					code: res.code,
					logs: normalizeLogs(output(res))
						.filter((l) => l.level >= 40)
						.map((l) => `${l.level} ${l.msg}`),
					added: after.filter((v) => !before.includes(v)),
					text: output(res),
				};
			}

			expect(result.backoffice.code).toBe(result.directus.code);
			expect(result.backoffice.logs).toEqual(result.directus.logs);
			expect(result.backoffice.added).toEqual([]);
			expect(result.directus.added).toEqual([]);
			return result;
		};

		test('a version that collides with a system migration', async () => {
			const result = await run('/directus/migrations/collide');
			expect(result.directus.code).toBe(1);
			expect(result.backoffice.text).toContain('Migration keys collide!');
		});

		test('.ts files and names without "-" are ignored', async () => {
			const result = await run('/directus/migrations/nodash');
			expect(result.directus.code).toBe(0);
			expect(result.backoffice.text).toContain('Database up to date');
		});

		test('a migration without `up`', async () => {
			const result = await run('/directus/migrations/noup');
			expect(result.directus.code).toBe(1);
			expect(result.backoffice.logs[0]).toContain(`Couldn't find the "up" function from migration`);
		});
	});

	test('an unknown version: bootstrap exits 0, start exits 1 and lists it (FR-036, 001 D-05)', async () => {
		await dbs.backoffice('directus_migrations').insert({ version: '20990199A', name: 'Unknown' });

		try {
			const bootstrap = cliRun(SERVICES.backoffice, ['bootstrap'], { MIGRATIONS_PATH: OK });
			expect(bootstrap.code, output(bootstrap)).toBe(0);

			const start = cliRun(SERVICES.backoffice, ['start'], { MIGRATIONS_PATH: OK });
			expect(start.code).toBe(1);
			expect(output(start)).toContain('Unknown migrations (not part of Directus 11.17.4): 20990199A');
		} finally {
			await dbs.backoffice('directus_migrations').where({ version: '20990199A' }).delete();
		}
	});
});
