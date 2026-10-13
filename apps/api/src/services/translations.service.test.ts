// Feature 010 (T043): TranslationsService (port of directus/api/src/services/translations.ts, which Directus does not
// unit test): the duplicate key and language checks before createOne and updateMany.
import { SchemaBuilder } from '@backoffice/schema-builder';
import knex, { type Knex } from 'knex';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ItemsService } from './items.service.js';
import { TranslationsService } from './translations.service.js';

vi.mock('../cache.js', () => ({ getCache: () => ({ cache: undefined }) }));

const schema = new SchemaBuilder()
	.collection('directus_translations', (c) => {
		c.field('id').uuid().primary();
		c.field('key').string();
		c.field('language').string();
		c.field('value').text();
	})
	.build();

let db: Knex;

beforeEach(async () => {
	db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
	await db.schema.createTable('directus_translations', (t) => {
		t.uuid('id').primary();
		t.string('key');
		t.string('language');
		t.text('value');
	});
	await db('directus_translations').insert([
		{ id: 't1', key: 'hello', language: 'en-US', value: 'Hello' },
		{ id: 't2', key: 'hello', language: 'vi-VN', value: 'Xin chào' },
	]);
});

afterEach(async () => {
	vi.restoreAllMocks();
	await db.destroy();
});

const service = () => new TranslationsService({ knex: db, schema });
const duplicate = { code: 'INVALID_PAYLOAD', extensions: { reason: 'Duplicate key and language combination' } };

test('createOne: an existing key and language is refused before any write', async () => {
	const create = vi.spyOn(ItemsService.prototype, 'createOne').mockResolvedValue('new');

	await expect(service().createOne({ key: 'hello', language: 'en-US', value: 'x' })).rejects.toMatchObject(duplicate);
	expect(create).not.toHaveBeenCalled();

	await expect(service().createOne({ key: 'hello', language: 'fr-FR', value: 'Bonjour' })).resolves.toBe('new');
});

test('updateMany: key and language together on any keys is refused, even without a duplicate', async () => {
	const update = vi.spyOn(ItemsService.prototype, 'updateMany').mockResolvedValue(['t1']);

	await expect(service().updateMany(['t1'], { key: 'other', language: 'de-DE' })).rejects.toMatchObject(duplicate);
	expect(update).not.toHaveBeenCalled();
});

test('updateMany: one of key or language is checked against each merged row', async () => {
	const update = vi.spyOn(ItemsService.prototype, 'updateMany').mockResolvedValue(['t1']);
	vi.spyOn(ItemsService.prototype, 'readMany').mockImplementation(async (keys) =>
		db('directus_translations').whereIn('id', keys as string[]),
	);

	await expect(service().updateMany(['t1'], { language: 'vi-VN' })).rejects.toMatchObject(duplicate);
	await expect(service().updateMany(['t1'], { language: 'fr-FR' })).resolves.toEqual(['t1']);
	await expect(service().updateMany(['t1'], { value: 'Hi' })).resolves.toEqual(['t1']);
	expect(update).toHaveBeenCalledTimes(2);
});
