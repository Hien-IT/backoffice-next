// Spec 022 (US3 scenario 4, FR-015, SC-006): the BE replicas of deploy/compose start together on one database; the
// Backoffice migrations run once under the shared Redis lock. Shared mode: every replica runs bootstrap (image CMD);
// standalone mode (spec 021): the one-shot bootstrap service runs them and the replicas only start.
import { describe, expect, it } from 'vitest';
import { compose, REPLICAS, STANDALONE } from './instances.js';

const APPLYING = 'Applying Add Collection UI Toggles...';
const UP_TO_DATE = 'Backoffice migrations are up to date';

/**
 * How many log lines of a service (all its containers) hold `message`. The deploy env logs pino lines in the pretty
 * style (`[08:52:50.377] INFO: Running Backoffice migrations...`, CI 40294646712), JSON elsewhere: plain substring.
 */
function count(service: string, message: string): number {
	return compose('logs', '--no-color', '--no-log-prefix', service)
		.split('\n')
		.filter((line) => line.includes(message)).length;
}

/** Rows of a query run with psql in the compose Postgres (the env file's DB_* values). */
function psql(sql: string): string[] {
	return compose('exec', '-T', 'postgres', 'sh', '-c', `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "${sql}"`)
		.trim()
		.split('\n')
		.filter(Boolean);
}

describe('Backoffice migrations on several replicas (spec 022)', () => {
	it('backoffice_migrations holds one row per migration and directus_collections the three columns', () => {
		expect(psql('select version from backoffice_migrations order by version')).toEqual(['20261026A', '20261028A']);
		// Spec 025 (D-189.5): the table of migration 20261028A.
		expect(psql("select count(*) from information_schema.tables where table_name = 'backoffice_permissions'")).toEqual([
			'1',
		]);
		expect(
			psql(
				"select column_name from information_schema.columns where table_name = 'directus_collections' and column_name like 'bo_%' order by column_name",
			),
		).toEqual(['bo_show_export', 'bo_show_import', 'bo_show_search']);
		expect(psql("select count(*) from directus_migrations where version like '20261026%'")).toEqual(['0']);
	});

	it.skipIf(STANDALONE)('shared mode: at most one replica applied it, the others waited and found it done', () => {
		const applied = count('backoffice-api', APPLYING);

		// At most one: another file of the suite may recreate replicas, whose new containers only log "up to date" (and
		// the logs of a replaced container are gone, so the one that applied it may not be listed any more).
		expect(applied).toBeLessThanOrEqual(1);
		expect(applied + count('backoffice-api', UP_TO_DATE)).toBeGreaterThanOrEqual(REPLICAS);
	});

	it.runIf(STANDALONE)('standalone mode: the bootstrap service applied it, the replicas did not', () => {
		expect(count('bootstrap', APPLYING)).toBeGreaterThanOrEqual(1);
		expect(count('backoffice-api', APPLYING)).toBe(0);
	});
});
