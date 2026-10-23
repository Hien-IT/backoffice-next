// SQL of the dialect helpers (tasks T010, T011 of spec 004). The helpers are ported verbatim from DR 11.17.4, which
// has tests for only a few of them; this file records the SQL every dialect produces so a later change cannot alter it
// unnoticed. Knex compiles with the query compiler of each client through knex-mock-client (no database).
import { SchemaBuilder } from '@backoffice/schema-builder';
import type { NumericValue } from '@backoffice/types';
import knex, { type Knex } from 'knex';
import { createTracker, MockClient } from 'knex-mock-client';
import { describe, expect, test } from 'vitest';
import * as capabilitiesHelpers from './capabilities/index.js';
import * as fnHelpers from './fn/index.js';
import type { FnHelperOptions } from './fn/types.js';
import * as geometryHelpers from './geometry/index.js';
import * as numberHelpers from './number/index.js';
import * as schemaHelpers from './schema/index.js';
import * as sequenceHelpers from './sequence/index.js';

const CLIENTS = {
	postgres: 'pg',
	redshift: 'pg',
	cockroachdb: 'pg',
	mysql: 'mysql',
	sqlite: 'sqlite3',
	mssql: 'mssql',
	oracle: 'oracledb',
} as const;

type Client = keyof typeof CLIENTS;
const clients = Object.keys(CLIENTS) as Client[];

function db(client: Client): Knex {
	return knex.default({ client: MockClient, dialect: CLIENTS[client] });
}

const sql = (value: Knex.Raw | Knex.QueryBuilder) => value.toSQL().toNative();

const schema = new SchemaBuilder()
	.collection('articles', (c) => {
		c.field('id').id();
		c.field('date_created').timestamp();
		c.field('tags').json();
		c.field('author').m2o('authors');
	})
	.collection('authors', (c) => {
		c.field('id').id();
	})
	.build();

const options = (type?: string): FnHelperOptions => ({
	type,
	originalCollectionName: undefined,
	relationalCountOptions: undefined,
	jsonPath: undefined,
});

describe.each(clients)('fn helper of %s', (client) => {
	const helper = new fnHelpers[client](db(client), schema);

	test.each(['year', 'month', 'week', 'day', 'weekday', 'hour', 'minute', 'second'] as const)('%s()', (fn) => {
		expect(sql(helper[fn]('articles', 'date_created', options('timestamp')))).toMatchSnapshot();
		expect(sql(helper[fn]('articles', 'date_created', options('dateTime')))).toMatchSnapshot();
	});

	test('count() of a JSON field', () => {
		expect(sql(helper.count('articles', 'tags', options()))).toMatchSnapshot();
	});

	test('json() of a nested path', () => {
		let result: unknown;

		try {
			result = sql(helper.json('articles', 'tags', { ...options('json'), jsonPath: '.color.name' }));
		} catch (error) {
			result = String(error);
		}

		expect(result).toMatchSnapshot();
	});

	test('parseJsonResult()', () => {
		expect(helper.parseJsonResult('{"a":1}')).toMatchSnapshot();
	});
});

describe.each(clients)('geometry helper of %s', (client) => {
	const helper = new geometryHelpers[client](db(client));
	const point = { type: 'Point', coordinates: [1, 2] } as const;
	const polygon = { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] } as const;

	test('column, text and GeoJSON conversions', () => {
		expect(sql(helper.asText('articles', 'location', 'location_alias'))).toMatchSnapshot();
		expect(sql(helper.asText('articles', 'location', false))).toMatchSnapshot();
		expect(sql(helper.fromText('POINT(1 2)'))).toMatchSnapshot();
		expect(sql(helper.fromGeoJSON(point as any))).toMatchSnapshot();
		expect(sql(helper.collect('articles', 'location'))).toMatchSnapshot();
	});

	test.each(['intersects', 'nintersects', 'intersects_bbox', 'nintersects_bbox'] as const)('%s()', (op) => {
		expect(sql(helper[op]('articles.location', polygon as any))).toMatchSnapshot();
	});

	test('isTrue(), isFalse() and createColumn()', () => {
		expect(sql(helper.isTrue(db(client).raw('1')))).toMatchSnapshot();
		expect(sql(helper.isFalse(db(client).raw('1')))).toMatchSnapshot();

		const columns: string[] = [];
		const table = { specificType: (name: string, type: string) => columns.push(`${name} ${type}`) } as any;
		helper.createColumn(table, { field: 'location', type: 'geometry.Point', meta: { special: [] } } as any);
		expect(columns).toMatchSnapshot();
	});
});

describe.each(clients)('number helper of %s', (client) => {
	const helper = new numberHelpers[client](db(client));

	test.each([
		['integer', 5],
		['bigInteger', '9007199254740993'],
		['decimal', 1.5],
		['float', 2.25],
	] as const)('search condition and validity of a %s', (type, value) => {
		const query = db(client)('articles').where('id', 1);
		expect(sql(helper.addSearchCondition(query, 'articles', 'n', value as NumericValue, 'or'))).toMatchSnapshot();
		expect(helper.isNumberValid(value as NumericValue, { type, precision: 10, scale: 2 })).toMatchSnapshot();
	});
});

describe.each(clients)('capabilities of %s', (client) => {
	const helper = new capabilitiesHelpers[client](db(client));

	test('flags', () => {
		expect({
			columnPosition: helper.supportsColumnPositionInGroupBy(),
			deduplication: helper.supportsDeduplicationOfParameters(),
		}).toMatchSnapshot();
	});
});

describe.each(clients)('sequence helper of %s', (client) => {
	test('resetAutoIncrementSequence()', async () => {
		const database = db(client);
		const tracker = createTracker(database);
		tracker.on.any(() => true).response([{ max: 41 }]);
		const helper = new sequenceHelpers[client](database);

		await helper.resetAutoIncrementSequence('articles', 'id');
		expect(tracker.history.all.map((q) => q.sql)).toMatchSnapshot();
	});
});

describe.each(clients)('schema helper of %s', (client) => {
	const helper = new schemaHelpers[client](db(client));

	test('names and limits', () => {
		expect({
			index: helper.generateIndexName('index', 'articles', ['title', 'status']),
			unique: helper.generateIndexName('unique', 'a_very_long_collection_name_for_index_names', 'a_very_long_field_name'),
			column: helper.getColumnNameMaxLength(),
			table: helper.getTableNameMaxLength(),
			constraint: helper.constraintName('articles_author_foreign'),
			uuid: helper.formatUUID('0b0e9ff7-3c1b-4c13-8c13-6c0c8a1c6a9b'),
		}).toMatchSnapshot();
	});

	test('limit, offset, a2o cast and bindings', () => {
		const query = db(client)('articles').select('*');
		helper.applyLimit(query, 25);
		helper.applyOffset(query, 50);
		expect(sql(query)).toMatchSnapshot();
		expect(helper.castA2oPrimaryKey()).toMatchSnapshot();
		expect(helper.prepQueryParams({ sql: 'select ?, ?', bindings: [1, 'a'] })).toMatchSnapshot();
		expect(helper.prepBindings([1, 'a', null])).toMatchSnapshot();
	});

	test.each([true, false])('inner sort fields of a grouped query (relational sort: %s)', (relational) => {
		const groupBy: (string | Knex.Raw)[] = ['articles.id'];
		const sortRecords = [{ alias: 'sort_title', column: db(client).raw('??.??', ['articles', 'title']) }];
		helper.addInnerSortFieldsToGroupBy(groupBy, sortRecords as any, relational);
		expect(groupBy.map((field) => (typeof field === 'string' ? field : field.toSQL().sql))).toMatchSnapshot();
	});

	test('column change hooks', async () => {
		const database = db(client);
		const tracker = createTracker(database);
		tracker.on.any(() => true).response([{ foreign_keys: 1 }]);
		const local = new schemaHelpers[client](database);

		expect(await local.preColumnChange()).toMatchSnapshot();
		await local.postColumnChange();
		local.preRelationChange({ collection: 'articles', field: 'author', related_collection: 'authors' });
		expect(local.processFieldType({ type: 'string', schema: { data_type: 'varchar' } } as any)).toMatchSnapshot();
		expect(tracker.history.all.map((q) => q.sql)).toMatchSnapshot();
	});

	test('database size', async () => {
		const database = db(client);
		const tracker = createTracker(database);
		tracker.on.any(() => true).response([{ size: 1024 }]);
		const local = new schemaHelpers[client](database);

		expect(await local.getDatabaseSize()).toMatchSnapshot();
		expect(tracker.history.all.map((q) => q.sql)).toMatchSnapshot();
	});
});
