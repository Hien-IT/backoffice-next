// Spec 021 FR-008, FR-026, SC-008 (D-145): on MySQL the main pair runs the image CMD of spec 021. Directus bootstrapped
// the database, so the bootstrap of Backoffice skips the migrations and starts as before; its database commands stop
// with the D-145 message. The main pair is never restarted (the other files use it).
import { describe, expect, test } from 'vitest';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { cli, cliRun, serviceLogs } from './cli.js';

const SKIP = 'Database on mysql is migrated by Directus 11.17.4 (D-145); skipping migrations';
const MIGRATE =
	'Backoffice runs migrations only on Postgres and SQLite databases; on mysql use the Directus 11.17.4 image (D-145)';

describe.skipIf(getDbsToTest()[0] !== 'mysql')('vendor gate on MySQL (D-145)', () => {
	test('the container started by the image CMD skipped the migrations', () => {
		const logs = serviceLogs('backoffice-api');

		expect(logs).toContain(SKIP);
		expect(logs).not.toContain('Applying');
	});

	test('database migrate:latest stops with exit code 1', () => {
		const result = cli('backoffice-api', ['database', 'migrate:latest']);

		expect(result.code).toBe(1);
		expect(result.stdout + result.stderr).toContain(MIGRATE);
		expect(result.stdout).not.toContain('Applying');
	});

	test('bootstrap in a new container on the same database exits 0 without migrating', () => {
		const result = cliRun('backoffice-api', ['bootstrap']);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain(SKIP);
		expect(result.stdout).not.toContain('Applying');
	});
});
