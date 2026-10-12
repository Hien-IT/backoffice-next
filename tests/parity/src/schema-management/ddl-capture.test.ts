// Feature 006 (T018, research R5 risk): captureModel reads what the DDL comparison relies on, on every vendor: unique
// and plain indexes with their columns, foreign keys with their names and actions, column details, metadata rows.
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { knexConfig } from '../config.js';
import { directusRequest } from '../directus-api.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { captureModel, schemaShape } from './ddl-capture.js';
import { cleanupTables } from './ddl-scenario.js';

const TABLES = ['parity_sm_capture_ref', 'parity_sm_capture'];

describe('captureModel (feature 006)', () => {
	const [vendor] = getDbsToTest();
	let db: Knex;

	beforeAll(async () => {
		db = knex(knexConfig[vendor!]);
		await cleanupTables('directus', TABLES);

		await directusRequest('POST', '/collections', { collection: 'parity_sm_capture_ref', schema: {}, meta: {} });

		await directusRequest('POST', '/collections', {
			collection: 'parity_sm_capture',
			schema: {},
			meta: { note: 'capture' },
			fields: [
				{ field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } },
				{ field: 'name', type: 'string', schema: { is_unique: true, max_length: 120 } },
				{ field: 'code', type: 'string', schema: { is_indexed: true } },
				{ field: 'ref', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
			],
		});

		await directusRequest('POST', '/relations', {
			collection: 'parity_sm_capture',
			field: 'ref',
			related_collection: 'parity_sm_capture_ref',
			schema: { on_delete: 'SET NULL' },
		});
	}, 120_000);

	afterAll(async () => {
		await cleanupTables('directus', TABLES);
		await db.destroy();
	});

	it('reads unique and plain indexes, the foreign key, column details and metadata rows', async () => {
		const model = await captureModel(db, TABLES);

		expect(Object.keys(model.columns)).toEqual(['parity_sm_capture', 'parity_sm_capture_ref']);

		const name = model.columns['parity_sm_capture']!.find((c: any) => c.name === 'name') as any;
		expect(name).toMatchObject({ is_unique: true, max_length: 120, is_nullable: true });

		const indexes = model.indexes.filter((i) => i.table === 'parity_sm_capture');
		expect(indexes).toContainEqual(expect.objectContaining({ columns: ['name'], unique: true }));
		expect(indexes).toContainEqual(expect.objectContaining({ columns: ['code'], unique: false }));

		expect(model.foreignKeys).toEqual([
			expect.objectContaining({
				table: 'parity_sm_capture',
				column: 'ref',
				foreign_key_table: 'parity_sm_capture_ref',
				foreign_key_column: 'id',
				constraint_name: 'parity_sm_capture_ref_foreign',
				on_delete: 'SET NULL',
			}),
		]);

		expect(model.collections.map((c) => c['collection'])).toEqual(['parity_sm_capture', 'parity_sm_capture_ref']);
		// Only fields sent with `meta` get a directus_fields row (CollectionsService.createOne); the injected id has meta.
		expect(model.fields.map((f) => `${f['collection']}.${f['field']}`).sort()).toEqual([
			'parity_sm_capture.ref',
			'parity_sm_capture_ref.id',
		]);
		expect(model.fields.every((f) => !('id' in f))).toBe(true);
		expect(model.relations).toEqual([
			expect.objectContaining({ many_field: 'ref', one_collection: 'parity_sm_capture_ref' }),
		]);

		// eslint-disable-next-line no-console -- T018: what the catalog query returns per vendor, read from the CI log
		console.info(`[T018] ${vendor} indexes`, JSON.stringify(indexes));
	});

	it('schemaShape lists every table with columns, indexes and foreign keys', async () => {
		const shape = await schemaShape(db);
		expect(shape.tables).toEqual(expect.arrayContaining(['directus_users', ...TABLES]));
		expect(shape.columns['parity_sm_capture']).toHaveLength(4);
	});
});
