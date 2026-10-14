// Feature 013 (contracts/tests.md §7, spec US7-3, SC-009): the fixture set of apps/web/fixtures/interfaces seeded and
// exported through Directus, then through the new API, gives the same normalized snapshot. Both apps of the main pair
// share one database, so the runs are sequential: each seed deletes and recreates the bo_* set (idempotent), and the
// shared caches are flushed before each export so neither app reads what the other computed. `seed.mjs --clean` removes
// the set at the end (also after a failure), so the shared database is left as the other files expect it.
import { execFile } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, expect, it } from 'vitest';
import { type AppName, appUrl } from '../directus-api.js';
import { type Difference, diffJson } from '../parity.js';
import { closeRedis, flushSharedCaches } from '../redis.js';

const run = promisify(execFile);
const FIXTURES = fileURLToPath(new URL('../../../../apps/web/fixtures/interfaces/', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'bo-fixtures-'));

// Test values of tests/parity/env/<vendor>.env.
const login = (app: AppName) => ['--api', appUrl(app), '--email', 'admin@example.com', '--password', 'password'];

afterAll(async () => {
	rmSync(out, { recursive: true, force: true });
	await closeRedis();
	// One app is enough: the database is shared.
	await run(process.execPath, [join(FIXTURES, 'seed.mjs'), ...login('directus'), '--clean']);
});

/** Seeds then exports the fixture set through `app`; returns the snapshot files by name. */
async function seedAndExport(app: AppName): Promise<Record<string, unknown>> {
	const dir = join(out, app);

	await run(process.execPath, [join(FIXTURES, 'seed.mjs'), ...login(app)], { maxBuffer: 1 << 24 });
	await flushSharedCaches();
	await run(process.execPath, [join(FIXTURES, 'export.mjs'), ...login(app), '--out', dir, '--kind', app]);

	return Object.fromEntries(
		readdirSync(dir)
			.sort()
			.map((file) => [file, JSON.parse(readFileSync(join(dir, file), 'utf8'))]),
	);
}

it('exports the same fixture set from Directus and from the new API (SC-009)', async () => {
	const directus = await seedAndExport('directus');
	const backoffice = await seedAndExport('backoffice');

	// meta.json names the API that wrote the export and the day it ran.
	for (const snapshot of [directus, backoffice]) {
		const { api: _api, date: _date, ...meta } = snapshot['meta.json'] as Record<string, unknown>;
		snapshot['meta.json'] = meta;
	}

	// An empty export on both sides would also be equal.
	expect((directus['items.bo_std.json'] as unknown[]).length).toBeGreaterThan(0);
	expect(Object.keys(backoffice)).toEqual(Object.keys(directus));

	const differences: Difference[] = [];
	diffJson(directus, backoffice, '', differences);
	expect(differences).toEqual([]);
}, 600_000);
