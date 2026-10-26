// Spec 022 (US3 scenario 4, FR-015, SC-006): the BE replicas of deploy/compose start together on one database; the
// Backoffice migrations run once under the shared Redis lock. Shared mode: every replica runs bootstrap (image CMD);
// standalone mode (spec 021): the one-shot bootstrap service runs them and the replicas only start.
import { describe, expect, it } from 'vitest';
import { compose, REPLICAS, SEPARATE, STANDALONE } from './instances.js';

const APPLYING = 'Applying Add Collection UI Toggles...';
const UP_TO_DATE = 'Backoffice migrations are up to date';

/** `msg` of the pino lines of a service (all its containers). */
function messages(service: string): string[] {
	const out = compose('logs', '--no-color', '--no-log-prefix', service);
	const lines: string[] = [];

	for (const line of out.split('\n')) {
		const start = line.indexOf('{');
		if (start === -1) continue;

		try {
			const { msg } = JSON.parse(line.slice(start)) as { msg?: unknown };
			if (typeof msg === 'string') lines.push(msg);
		} catch {
			// not a pino line
		}
	}

	return lines;
}

/** Rows of a query run with psql in the compose Postgres (the env file's DB_* values). */
function psql(sql: string): string[] {
	return compose('exec', '-T', 'postgres', 'sh', '-c', `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "${sql}"`)
		.trim()
		.split('\n')
		.filter(Boolean);
}

describe.skipIf(SEPARATE)('Backoffice migrations on several replicas (spec 022)', () => {
	it('backoffice_migrations holds one row per migration and directus_collections the three columns', () => {
		expect(psql('select version from backoffice_migrations order by version')).toEqual(['20261026A']);
		expect(
			psql(
				"select column_name from information_schema.columns where table_name = 'directus_collections' and column_name like 'bo_%' order by column_name",
			),
		).toEqual(['bo_show_export', 'bo_show_import', 'bo_show_search']);
		expect(psql("select count(*) from directus_migrations where version like '20261026%'")).toEqual(['0']);
	});

	it.skipIf(STANDALONE)('shared mode: at most one replica applied it, the others waited and found it done', () => {
		const lines = messages('backoffice-api');
		const applied = lines.filter((m) => m === APPLYING).length;

		// At most one: another file of the suite may recreate replicas, whose new containers only log "up to date".
		expect(applied).toBeLessThanOrEqual(1);
		expect(applied + lines.filter((m) => m === UP_TO_DATE).length).toBeGreaterThanOrEqual(REPLICAS);
	});

	it.runIf(STANDALONE)('standalone mode: the bootstrap service applied it, the replicas did not', () => {
		expect(messages('bootstrap')).toContain(APPLYING);
		expect(messages('backoffice-api')).not.toContain(APPLYING);
	});
});
