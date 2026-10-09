// US3, FR-030..FR-036, SC-004, contracts/startup.md: the built API on temporary copies of the Directus database.
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import getPort from 'get-port';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { snapshot } from '../db-snapshot.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { type RunningApi, hostDbEnv, runApi, stopApi, waitForPing } from './run-api.js';
import { connect, createTempDb, dropTempDb, tempDbEnv } from './temp-db.js';

const [vendor] = getDbsToTest();
const running: RunningApi[] = [];
const temps: string[] = [];

const MISMATCH_HEADER = 'Database migrations do not match Directus 11.17.4.';
const HINT = 'If Directus is still migrating, restart Backoffice after it finishes.';

async function tempDb(
	name: string,
	edit?: (db: ReturnType<typeof connect>) => Promise<unknown>,
	options: { empty?: boolean } = {},
) {
	const database = `startup_${name}`;
	await createTempDb(database, options);
	temps.push(database);

	if (edit) {
		const db = connect(database);
		await edit(db);
		await db.destroy();
	}

	return database;
}

function start(database: string, env: Record<string, string> = {}, port?: number) {
	const api = runApi({ ...hostDbEnv(vendor!), ...tempDbEnv(database), PORT: String(port ?? 0), ...env });
	running.push(api);
	return api;
}

afterEach(async () => {
	await Promise.all(running.splice(0).map(stopApi));
});

afterAll(async () => {
	for (const name of temps) await dropTempDb(name);
});

describe.runIf(vendor === 'postgres' || vendor === 'sqlite3')('startup checks', () => {
	beforeAll(async () => {
		await createTempDb('startup_warmup');
		temps.push('startup_warmup');
	}, 120_000);

	test('all 101 migrations → runs (US3.1)', async () => {
		const port = await getPort();
		const api = start(await tempDb('ok'), {}, port);
		expect(await waitForPing(api, port), api.output()).toBe(true);
	});

	test('one migration missing → exit 1 within 10 s, version listed, hint (US3.2, US3.9, SC-004)', async () => {
		const database = await tempDb('missing', (db) =>
			db('directus_migrations').where({ version: '20260211A' }).delete(),
		);
		const started = Date.now();
		const api = start(database);
		const { code } = await api.exited;

		expect(Date.now() - started).toBeLessThan(10_000);
		expect(code).toBe(1);
		expect(api.text()).toContain(MISMATCH_HEADER);
		expect(api.text()).toContain('Missing migrations (not run yet): 20260211A');
		expect(api.text()).toContain(HINT);
	});

	test('unknown version → exit 1, version listed (US3.3)', async () => {
		const database = await tempDb('extra', (db) =>
			db('directus_migrations').insert({ version: '20990101A', name: 'Unknown' }),
		);
		const api = start(database);
		expect((await api.exited).code).toBe(1);
		expect(api.text()).toContain('Unknown migrations (not part of Directus 11.17.4): 20990101A');
	});

	test('missing and unknown in the same run (US3.5)', async () => {
		const database = await tempDb('both', async (db) => {
			await db('directus_migrations').where({ version: '20260211A' }).delete();
			await db('directus_migrations').insert({ version: '20990101A', name: 'Unknown' });
		});

		const api = start(database);
		expect((await api.exited).code).toBe(1);
		expect(api.text()).toContain('Missing migrations (not run yet): 20260211A');
		expect(api.text()).toContain('Unknown migrations (not part of Directus 11.17.4): 20990101A');
	});

	test.each([
		['MIGRATIONS_PATH', 'migrations', '20990101A-custom.js'],
		['EXTENSIONS_PATH/migrations', 'extensions/migrations', '20990101A-custom.js'],
	])(
		'custom migration in %s → runs, warning lists it, file never executed (US3.4)',
		async (_label, folder, fileName) => {
			const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'custom-mig-')));
			mkdirSync(join(cwd, folder), { recursive: true });
			writeFileSync(join(cwd, folder, fileName), 'throw new Error("EXECUTED")');

			const database = await tempDb(`custom_${folder.replace(/\W/g, '_')}`, (db) =>
				db('directus_migrations').insert({ version: '20990101A', name: 'Custom' }),
			);

			const port = await getPort();
			const api = runApi({ ...hostDbEnv(vendor!), ...tempDbEnv(database), PORT: String(port) }, cwd);
			running.push(api);

			expect(await waitForPing(api, port), api.output()).toBe(true);
			expect(api.text()).toContain(`Custom migrations are accepted: 20990101A (${join(cwd, folder)})`);
			expect(api.text()).not.toContain('EXECUTED');
		},
	);

	test('Directus not installed → exit 1, "Database doesn\'t have Directus tables installed." (US3.6)', async () => {
		const database = await tempDb('empty', undefined, { empty: true });
		const api = start(database);
		expect((await api.exited).code).toBe(1);
		expect(api.text()).toContain("Database doesn't have Directus tables installed.");
	});

	test('database unreachable → exit 1, "Can\'t connect to the database." (US3.7)', async () => {
		const unreachable =
			vendor === 'sqlite3'
				? { DB_FILENAME: '/nonexistent-dir/data.db' }
				: { DB_DATABASE: 'directus', DB_PORT: String(await getPort()), DB_POOL__ACQUIRE_TIMEOUT_MILLIS: '2000' };

		const api = runApi({ ...hostDbEnv(vendor!), ...unreachable, PORT: '0' });
		running.push(api);
		expect((await api.exited).code).toBe(1);
		expect(api.text()).toContain("Can't connect to the database.");
	});

	test('storage driver gcs → exit 1, location and driver named (FR-034)', async () => {
		const api = start(await tempDb('gcs'), { STORAGE_LOCATIONS: 'files', STORAGE_FILES_DRIVER: 'gcs' });
		expect((await api.exited).code).toBe(1);
		expect(api.text()).toContain(
			'Storage location "files" uses driver "gcs", which is not supported by Backoffice. Supported drivers: local, s3.',
		);
	});

	test('port already in use → exit 1, "Port <port> is already in use"', async () => {
		const blocker = createServer();
		const port = await getPort();
		await new Promise<void>((r) => blocker.listen(port, '0.0.0.0', r));

		const api = start(await tempDb('port'), { HOST: '0.0.0.0' }, port);
		expect((await api.exited).code).toBe(1);
		expect(api.text()).toContain(`Port ${port} is already in use`);
		blocker.close();
	});

	test('three instances at once: same outcome as alone, DB unchanged, no write needed (US3.8)', async () => {
		const mismatched = await tempDb('concurrent_bad', (db) =>
			db('directus_migrations').where({ version: '20260211A' }).delete(),
		);
		const good = await tempDb('concurrent_good');

		const before = { bad: await snapshotOf(mismatched), good: await snapshotOf(good) };

		const bad = [start(mismatched), start(mismatched), start(mismatched)];
		const results = await Promise.all(bad.map((a) => a.exited));
		expect(results.map((r) => r.code)).toEqual([1, 1, 1]);
		for (const api of bad) expect(api.text()).toContain('Missing migrations (not run yet): 20260211A');

		const ports = [await getPort(), await getPort(), await getPort()];
		const ok = ports.map((p) => start(good, {}, p));
		const pinged = await Promise.all(ok.map((a, i) => waitForPing(a, ports[i]!)));
		expect(pinged, ok.map((a) => a.output()).join('\n---\n')).toEqual([true, true, true]);
		await Promise.all(running.splice(0).map(stopApi));

		expect(await snapshotOf(mismatched)).toEqual(before.bad);
		expect(await snapshotOf(good)).toEqual(before.good);
	});
});

async function snapshotOf(database: string) {
	const db = connect(database);

	try {
		return await snapshot(db);
	} finally {
		await db.destroy();
	}
}
