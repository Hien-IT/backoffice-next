// Feature 002, US1 and SC-001: a schema or permission change on one side is seen by every instance of the other
// side within 1 second, without restart. Needs the profile `multi` (second Backoffice instance).
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { knexConfig } from '../config.js';
import { directusRequest } from '../directus-api.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { closeRedis } from '../redis.js';
import { clearSystemCacheIn } from './clear-system-cache.js';
import { createPublicCollection, dropCollections, oasComponent, within } from './helpers.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';
const DIRECTUS = process.env['DIRECTUS_URL']!;
const BACKOFFICE = [process.env['BACKOFFICE_URL']!, process.env['BACKOFFICE_URL_2']!];
const SC_001_MS = 1000;

const fieldsOf = async (url: string, collection = 'parity_sync') =>
	Object.keys((await oasComponent(url, collection))?.['properties'] ?? {}).sort();

/** Waits until both Backoffice instances show the same component as Directus; returns the slowest delay. */
async function backofficeFollows(what: string, collection = 'parity_sync'): Promise<number> {
	const expected = await oasComponent(DIRECTUS, collection);
	const delays = await Promise.all(
		BACKOFFICE.map((url) =>
			within(
				SC_001_MS,
				async () => JSON.stringify(await oasComponent(url, collection)) === JSON.stringify(expected),
				`${url} sees "${what}"`,
			),
		),
	);
	const delay = Math.max(...delays);
	// eslint-disable-next-line no-console -- SC-001 delay, read from the CI log
	console.info(`[SC-001] Directus → Backoffice, ${what}: ${delay} ms`);
	return delay;
}

describe.runIf(suite === 'full' && process.env['BACKOFFICE_URL_2'])('schema sync (US1, profile multi)', () => {
	const [vendor] = getDbsToTest();
	let db: Knex;
	let permission: number;

	beforeAll(async () => {
		db = knex(knexConfig[vendor!]);
		await dropCollections(['parity_sync', 'parity_sync_b']);
		permission = await createPublicCollection('parity_sync');

		// Warm every schema cache
		for (const url of [DIRECTUS, ...BACKOFFICE]) expect(await fieldsOf(url)).toEqual(['id', 'title']);
	}, 120_000);

	afterAll(async () => {
		await dropCollections(['parity_sync', 'parity_sync_b']);
		await db.destroy();
		await closeRedis();
	}, 120_000);

	it('US1.1: a field added on Directus is seen by every Backoffice instance', async () => {
		await directusRequest('POST', '/fields/parity_sync', { field: 'rating', type: 'integer' });
		await backofficeFollows('field added');
		expect(await fieldsOf(BACKOFFICE[1]!)).toEqual(['id', 'rating', 'title']);
	});

	it('US1.2: changed type, deleted field, new collection and relation, deleted relation and collection', async () => {
		await directusRequest('PATCH', '/fields/parity_sync/rating', { type: 'float' });
		await backofficeFollows('field type changed');

		await directusRequest('DELETE', '/fields/parity_sync/rating');
		await backofficeFollows('field deleted');
		expect(await fieldsOf(BACKOFFICE[0]!)).toEqual(['id', 'title']);

		await createPublicCollection('parity_sync_b');
		await backofficeFollows('collection created', 'parity_sync_b');

		await directusRequest('POST', '/fields/parity_sync', { field: 'b', type: 'integer', meta: { special: ['m2o'] } });
		await directusRequest('POST', '/relations', {
			collection: 'parity_sync',
			field: 'b',
			related_collection: 'parity_sync_b',
		});
		await backofficeFollows('m2o relation created');
		expect(JSON.stringify(await oasComponent(BACKOFFICE[1]!, 'parity_sync'))).toContain('ItemsParitySyncB');

		await directusRequest('DELETE', '/relations/parity_sync/b');
		await backofficeFollows('relation deleted');

		await dropCollections(['parity_sync_b']);
		await within(SC_001_MS, async () => (await oasComponent(BACKOFFICE[0]!, 'parity_sync_b')) === undefined, 'drop');
	});

	it('US1.3: a schema change cleared by Backoffice is seen by Directus and the other instance', async () => {
		await db.schema.alterTable('parity_sync', (t) => t.integer('sql_col'));

		// Nobody announced the DDL: every cache still has the old schema (edge case of the spec)
		expect(await fieldsOf(DIRECTUS)).not.toContain('sql_col');

		clearSystemCacheIn('backoffice-api');

		const delay = await within(
			SC_001_MS,
			async () =>
				(await fieldsOf(DIRECTUS)).includes('sql_col') && (await fieldsOf(BACKOFFICE[1]!)).includes('sql_col'),
			'Directus and backoffice-api-2 see sql_col',
		);
		// eslint-disable-next-line no-console -- SC-001 delay, read from the CI log
		console.info(`[SC-001] Backoffice → Directus: ${delay} ms`);
	});

	it('US1.4: permission changes on Directus clear the permissions cache of Backoffice', async () => {
		await directusRequest('PATCH', `/permissions/${permission}`, { fields: ['id'] });
		await backofficeFollows('permission narrowed');
		expect(await fieldsOf(BACKOFFICE[0]!)).toEqual(['id']);

		// Changed behind Directus' back, then announced with POST /utils/cache/clear?system
		await db('directus_permissions').where('id', permission).update({ fields: '*' });
		await directusRequest('POST', '/utils/cache/clear?system');
		await backofficeFollows('permissions cache cleared');
		expect(await fieldsOf(BACKOFFICE[1]!)).toContain('title');
	});
});
