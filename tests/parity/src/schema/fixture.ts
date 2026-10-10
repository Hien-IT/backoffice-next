// Feature 002, US2: sample schema for the SchemaOverview comparison, created through the Directus API so Directus
// handles the differences between vendors (research R10). Every collection starts with `parity_overview_`.
import { directusRequest } from '../directus-api.js';
import type { Vendor } from '../get-dbs-to-test.js';
import { dropCollections } from './helpers.js';

const P = 'parity_overview_';

export const FIXTURE_COLLECTIONS = [
	`${P}blocks`,
	`${P}tags_junction`,
	`${P}files_junction`,
	`${P}translations`,
	`${P}types`,
	`${P}related`,
	`${P}languages`,
	`${P}singleton`,
];

const id = (type = 'integer') => ({
	field: 'id',
	type,
	meta: { hidden: true },
	schema: { is_primary_key: true, ...(type === 'integer' && { has_auto_increment: true }) },
});

// The primary key comes with the collection; other fields are added one by one so a rejected field is named.
async function collection(name: string, fields: Record<string, unknown>[], meta: Record<string, unknown> = {}) {
	const [primary, ...rest] = fields;
	await directusRequest('POST', '/collections', { collection: name, schema: {}, meta, fields: [primary] });

	for (const f of rest) {
		await directusRequest('POST', `/fields/${name}`, f).catch((error: Error) => {
			throw new Error(`${name}.${f['field'] as string}: ${error.message}`);
		});
	}
}

const field = (collectionName: string, body: Record<string, unknown>) =>
	directusRequest('POST', `/fields/${collectionName}`, body);

const relation = (body: Record<string, unknown>) => directusRequest('POST', '/relations', body);

export async function createFixture(vendor: Vendor): Promise<void> {
	await dropFixture();

	await collection(`${P}related`, [id(), { field: 'name', type: 'string' }]);
	await collection(`${P}languages`, [id('string'), { field: 'name', type: 'string' }]);
	await collection(`${P}singleton`, [id(), { field: 'motto', type: 'string' }], {
		singleton: true,
		accountability: null,
	});

	await collection(
		`${P}types`,
		[
			id(),
			{ field: 'sort', type: 'integer' },
			{
				field: 'title',
				type: 'string',
				schema: { is_nullable: false, default_value: 'untitled', max_length: 120 },
				meta: { note: 'The title', validation: { _and: [{ title: { _nnull: true } }] }, searchable: false },
			},
			{ field: 'body', type: 'text' },
			{ field: 'count', type: 'integer', schema: { default_value: 3 } },
			{ field: 'big', type: 'bigInteger' },
			{ field: 'ratio', type: 'float' },
			{ field: 'price', type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2 } },
			{ field: 'flag', type: 'boolean', schema: { default_value: true } },
			{ field: 'day', type: 'date' },
			{ field: 'at', type: 'time' },
			{ field: 'moment', type: 'dateTime' },
			{ field: 'stamp', type: 'timestamp' },
			{ field: 'payload', type: 'json' },
			{ field: 'uid', type: 'uuid' },
			{ field: 'labels', type: 'csv', meta: { special: ['cast-csv'] } },
			{ field: 'secret', type: 'hash', meta: { special: ['hash'] } },
			{ field: 'created', type: 'timestamp', meta: { special: ['date-created'] } },
			...(vendor.startsWith('postgres') ? [{ field: 'place', type: 'geometry.Point' }] : []),
			{ field: 'divider', type: 'alias', meta: { special: ['alias', 'no-data'], interface: 'presentation-divider' } },
			{ field: 'group1', type: 'alias', meta: { special: ['alias', 'no-data', 'group'], interface: 'group-raw' } },
		],
		{ note: 'Every field type', sort_field: 'sort' },
	);

	// m2o + o2m
	await field(`${P}types`, { field: 'related', type: 'integer', meta: { special: ['m2o'] } });
	await field(`${P}related`, { field: 'items', type: 'alias', meta: { special: ['o2m'] } });
	await relation({
		collection: `${P}types`,
		field: 'related',
		related_collection: `${P}related`,
		meta: { one_field: 'items' },
		schema: { on_delete: 'SET NULL' },
	});

	// m2m
	await collection(`${P}tags_junction`, [
		id(),
		{ field: 'types_id', type: 'integer' },
		{ field: 'related_id', type: 'integer' },
	]);
	await field(`${P}types`, { field: 'tags', type: 'alias', meta: { special: ['m2m'] } });
	await relation({
		collection: `${P}tags_junction`,
		field: 'types_id',
		related_collection: `${P}types`,
		meta: { one_field: 'tags', junction_field: 'related_id' },
		schema: { on_delete: 'CASCADE' },
	});
	await relation({
		collection: `${P}tags_junction`,
		field: 'related_id',
		related_collection: `${P}related`,
		meta: { junction_field: 'types_id' },
		schema: { on_delete: 'SET NULL' },
	});

	// m2a
	await collection(`${P}blocks`, [
		id(),
		{ field: 'types_id', type: 'integer' },
		{ field: 'item', type: 'string' },
		{ field: 'collection', type: 'string' },
	]);
	await field(`${P}types`, { field: 'blocks', type: 'alias', meta: { special: ['m2a'] } });
	await relation({
		collection: `${P}blocks`,
		field: 'item',
		related_collection: null,
		meta: {
			one_allowed_collections: [`${P}related`, `${P}languages`],
			one_collection_field: 'collection',
			junction_field: 'types_id',
		},
	});
	await relation({
		collection: `${P}blocks`,
		field: 'types_id',
		related_collection: `${P}types`,
		meta: { one_field: 'blocks', junction_field: 'item' },
		schema: { on_delete: 'SET NULL' },
	});

	// files (m2m to directus_files)
	await collection(`${P}files_junction`, [
		id(),
		{ field: 'types_id', type: 'integer' },
		{ field: 'directus_files_id', type: 'uuid' },
	]);
	await field(`${P}types`, { field: 'gallery', type: 'alias', meta: { special: ['files'] } });
	await relation({
		collection: `${P}files_junction`,
		field: 'types_id',
		related_collection: `${P}types`,
		meta: { one_field: 'gallery', junction_field: 'directus_files_id' },
		schema: { on_delete: 'SET NULL' },
	});
	await relation({
		collection: `${P}files_junction`,
		field: 'directus_files_id',
		related_collection: 'directus_files',
		meta: { junction_field: 'types_id' },
		schema: { on_delete: 'SET NULL' },
	});

	// translations
	await collection(`${P}translations`, [
		id(),
		{ field: 'types_id', type: 'integer' },
		{ field: 'languages_id', type: 'string' },
		{ field: 'label', type: 'string' },
	]);
	await field(`${P}types`, { field: 'translations', type: 'alias', meta: { special: ['translations'] } });
	await relation({
		collection: `${P}translations`,
		field: 'types_id',
		related_collection: `${P}types`,
		meta: { one_field: 'translations', junction_field: 'languages_id' },
		schema: { on_delete: 'SET NULL' },
	});
	await relation({
		collection: `${P}translations`,
		field: 'languages_id',
		related_collection: `${P}languages`,
		meta: { junction_field: 'types_id' },
		schema: { on_delete: 'SET NULL' },
	});
}

export async function dropFixture(): Promise<void> {
	await dropCollections(FIXTURE_COLLECTIONS);
}
