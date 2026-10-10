// Feature 002, US2 (FR-008, FR-012, FR-040): the SchemaOverview of Backoffice equals the one of Directus on the same
// database, and each app can use the schema the other one built (contracts/schema-overview.md).
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { knexConfig } from '../config.js';
import { logs } from '../docker.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { closeRedis } from '../redis.js';
import { captureSchema, oasBody, replaySchema } from './capture.js';
import { createFixture, dropFixture } from './fixture.js';

const DIRECTUS = process.env['DIRECTUS_URL']!;
const BACKOFFICE = process.env['BACKOFFICE_URL']!;
// Tables the schema skips (FR-005): no primary key, a space in the name, listed in DB_EXCLUDE_TABLES (default).
const SKIPPED = ['parity_no_pk', 'parity with space', 'sysdiagrams'];

describe('SchemaOverview (US2)', () => {
	const [vendor] = getDbsToTest();
	let db: Knex;

	beforeAll(async () => {
		db = knex(knexConfig[vendor!]);
		for (const table of SKIPPED) await db.schema.dropTableIfExists(table);
		await createFixture(vendor!);
		await db.schema.createTable('parity_no_pk', (t) => t.string('a'));
		await db.schema.createTable('parity with space', (t) => t.increments('id'));
		await db.schema.createTable('sysdiagrams', (t) => t.increments('id'));
	}, 180_000);

	afterAll(async () => {
		for (const table of SKIPPED) await db.schema.dropTableIfExists(table);
		await dropFixture();
		await db.destroy();
		await closeRedis();
	}, 180_000);

	it('equals the SchemaOverview of Directus, value by value and in relation order', async () => {
		const directus = await captureSchema(DIRECTUS);
		const backoffice = await captureSchema(BACKOFFICE);

		expect(Object.keys(directus.schema.collections)).toContain('parity_overview_types');
		for (const table of SKIPPED) expect(directus.schema.collections).not.toHaveProperty(table);
		expect(backoffice.schema).toStrictEqual(directus.schema);
	});

	it('Backoffice answers with the schema Directus built, and Directus with the one Backoffice built', async () => {
		const directus = await captureSchema(DIRECTUS);
		const backoffice = await captureSchema(BACKOFFICE);

		const backofficeOwn = await oasBody(BACKOFFICE);
		expect(await replaySchema(BACKOFFICE, directus.raw)).toStrictEqual(backofficeOwn);

		await captureSchema(DIRECTUS);
		const directusOwn = await oasBody(DIRECTUS);
		expect(await replaySchema(DIRECTUS, backoffice.raw)).toStrictEqual(directusOwn);
	});

	it('logs the same warnings for the skipped tables', () => {
		for (const message of [
			'Collection "parity_no_pk" doesn\'t have a primary key column and will be ignored',
			'Collection "parity with space" has a space in the name and will be ignored',
		]) {
			expect(logs('directus')).toContain(message);
			expect(logs('backoffice-api')).toContain(message);
		}
	});
});
