// Spec 021 FR-100, FR-014, FR-010, FR-016, SC-001, SC-010: Directus 11.17.4 and Backoffice each bootstrapped an empty
// database of profile bootstrap with the same env; the baseline captured by global-setup (before any other test writes)
// must hold the same schema and the same rows after the FR-107 rules.
import { describe, expect, test } from 'vitest';
import { readBaseline } from './baseline.js';
import { profileEnv } from './cli.js';
import { normalizeRows, pinoLines } from './normalize.js';

const baseline = readBaseline();

describe.skipIf(!baseline)('profile bootstrap: two empty databases, one per app (FR-100)', () => {
	const { dumps, logs, ownerReports, bootstrapMs, vendor } = baseline!;

	test('same directus_* tables, columns, primary keys, foreign keys and indexes', () => {
		expect(dumps.backoffice.tables).toEqual(dumps.directus.tables);
		expect(dumps.backoffice.foreignKeys).toEqual(dumps.directus.foreignKeys);
		expect(dumps.backoffice.indexes).toEqual(dumps.directus.indexes);
	});

	test('same rows in every directus_* table after the FR-107 rules', () => {
		expect(normalizeRows(dumps.backoffice.rows)).toEqual(normalizeRows(dumps.directus.rows));
	});

	test('directus_migrations: the 101 versions and names of Directus 11.17.4, in the same order', () => {
		const versions = (app: 'directus' | 'backoffice') =>
			[...dumps[app].rows['directus_migrations']!]
				.sort((a, b) => String(a['version']).localeCompare(String(b['version'])))
				.map((row) => [row['version'], row['name']]);

		expect(versions('directus')).toHaveLength(101);
		expect(versions('backoffice')).toEqual(versions('directus'));
	});

	test('owner reports: Directus sends two (migration 20251014A and bootstrap), Backoffice none and logs D-38 twice', () => {
		expect(ownerReports).toBe(2);

		const warnings = pinoLines(logs.backoffice).filter((l) => l.msg.includes('owner report is out of scope'));
		expect(warnings).toHaveLength(2);
	});

	test('the startup output holds no secret value (FR-016)', () => {
		const env = profileEnv(vendor);

		for (const name of ['ADMIN_PASSWORD', 'ADMIN_TOKEN', 'DB_PASSWORD', 'SECRET', 'KEY']) {
			const value = env[name];
			expect(value, name).toBeTruthy();
			expect(logs.backoffice.includes(value!), name).toBe(false);
		}
	});

	test('bootstrap time (SC-010: under 2 minutes)', () => {
		// eslint-disable-next-line no-console
		console.log(`bootstrap ms on ${vendor}: directus=${bootstrapMs.directus} backoffice=${bootstrapMs.backoffice}`);

		expect(bootstrapMs.backoffice).not.toBeNull();
		expect(bootstrapMs.backoffice!).toBeLessThan(120_000);
	});
});
