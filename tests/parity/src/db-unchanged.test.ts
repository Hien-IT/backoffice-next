// US1.9, SC-003: the API never writes the database. Directus is stopped while measuring, so only the new API
// acts on the database between the two snapshots: start → every request of request-set → SIGTERM.
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { awaitDirectusConnection } from './await-connection.js';
import { knexConfig } from './config.js';
import { snapshot } from './db-snapshot.js';
import { compose } from './docker.js';
import { getDbsToTest } from './get-dbs-to-test.js';
import { capture } from './parity.js';
import { requestSet } from './request-set.js';

const [vendor] = getDbsToTest();
let db: Knex;
let stopped: string[] = [];

beforeAll(() => {
	db = knex(knexConfig[vendor!]);
});

afterAll(async () => {
	await db.destroy();
	// Restart every container this test stopped (profile pairs included), main Directus first.
	compose('start', ...stopped);
	await awaitDirectusConnection(process.env['DIRECTUS_URL']!, 60, 2000);
	await awaitDirectusConnection(process.env['BACKOFFICE_URL']!, 60, 2000);

	// Profile pairs: any HTTP answer counts (the pressure pair always answers 503).
	for (const key of Object.keys(process.env).filter((k) => /^(DIRECTUS|BACKOFFICE)_URL_/.test(k))) {
		for (let i = 0; i < 60; i++) {
			const status = await fetch(new URL('/server/ping', process.env[key])).then(
				(r) => r.status,
				() => 0,
			);
			if (status === 200 || status === 503) break;
			await new Promise((r) => setTimeout(r, 2000));
		}
	}
}, 300_000);

test('schema and data of every table are identical before and after the API runs', { timeout: 300_000 }, async () => {
	// Stop every Directus container (profile pairs included) and the API.
	const services = compose('ps', '--services')
		.split('\n')
		.filter((s) => s.startsWith('directus') || s.startsWith('backoffice-api'));
	stopped = services;
	compose('stop', ...services);

	const before = await snapshot(db);

	compose('start', 'backoffice-api');
	await awaitDirectusConnection(process.env['BACKOFFICE_URL']!, 60, 1000);

	for (const req of requestSet({ metrics: services.includes('backoffice-api-metrics') })) {
		await capture(process.env['BACKOFFICE_URL']!, req);
	}

	compose('kill', '-s', 'SIGTERM', 'backoffice-api');
	compose('wait', 'backoffice-api');

	const after = await snapshot(db);

	expect(after).toEqual(before);
});
