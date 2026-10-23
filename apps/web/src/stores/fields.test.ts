// Ported from directus/app/src/stores/fields.test.ts
// Backoffice: the API is mocked with mockApi (fetch) instead of vi.mock('@/api'); translate-literal is inlined in the
// store, so the tests check the translated values instead of spying on it. Tests after the DR ones cover the
// getters.
import type { Field, FieldRaw, Relation } from '@directus/types';
import { merge } from 'lodash-es';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { i18n } from '../lang/index.ts';
import { calls, mockApi } from '../test-utils/fetch.ts';
import { useFieldsStore } from './fields.ts';
import { useRelationsStore } from './relations.ts';

beforeEach(() => {
	setActivePinia(createPinia());
});

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

const mockField = {
	collection: 'a',
	field: 'name',
	type: 'string',
	schema: {},
	meta: {
		collection: 'a',
		field: 'name',
		options: null,
		display_options: null,
		note: '$t:save',
		validation_message: null,
	},
} as unknown as Field;

describe('hydrate action', () => {
	test('should not skip translations by default', async () => {
		const fetch = mockApi({ 'GET /fields': [mockField] });
		const fieldsStore = useFieldsStore();
		await fieldsStore.hydrate();

		expect(calls(fetch)).toEqual(['GET /fields']);
		expect(fieldsStore.fields[0]!.meta!.note).toBe('Save');
	});

	test('should skip translations when skipTranslation is true', async () => {
		mockApi({ 'GET /fields': [mockField] });
		const fieldsStore = useFieldsStore();
		await fieldsStore.hydrate({ skipTranslation: true });

		expect(fieldsStore.fields[0]!.meta!.note).toBe('$t:save');
	});

	test('adds the directus_files $thumbnail field and dehydrate empties the store', async () => {
		mockApi({ 'GET /fields': [mockField] });
		const fieldsStore = useFieldsStore();
		await fieldsStore.hydrate();

		expect(fieldsStore.fields.map(({ collection, field }) => `${collection}.${field}`)).toEqual([
			'a.name',
			'directus_files.$thumbnail',
		]);
		expect(fieldsStore.fields[0]!.name).toBe('Name');

		await fieldsStore.dehydrate();
		expect(fieldsStore.fields).toEqual([]);
	});
});

describe('parseField action', () => {
	test('should translate field name when translations are added then removed', async () => {
		const fieldsStore = useFieldsStore();

		const mockFieldWithTranslations = merge({}, mockField, {
			meta: {
				translations: [
					{
						language: 'en-US',
						translation: 'Name en-US',
					},
				],
			},
		});

		fieldsStore.fields = [mockFieldWithTranslations].map(fieldsStore.parseField);
		expect(fieldsStore.fields[0]!.name).toEqual('Name en-US');
		expect(i18n.global.te(`fields.${mockField.collection}.${mockField.field}`)).toBe(true);

		const mockFieldWithoutTranslations = merge({}, mockField, {
			meta: {
				translations: [
					{
						language: 'zh-CN',
						translation: 'Name zh-CN',
					},
				],
			},
		});

		fieldsStore.fields = [mockFieldWithoutTranslations].map(fieldsStore.parseField);
		expect(fieldsStore.fields[0]!.name).toEqual('Name');
		expect(i18n.global.te(`fields.${mockField.collection}.${mockField.field}`)).toBe(false);
	});

	test('should translate field name when translations are added and reset when removed', async () => {
		const fieldsStore = useFieldsStore();

		const mockFieldWithTranslations = merge({}, mockField, {
			meta: {
				translations: [
					{
						language: 'en-US',
						translation: 'name en-US',
					},
				],
			},
		});

		fieldsStore.fields = [mockFieldWithTranslations].map(fieldsStore.parseField);
		expect(fieldsStore.fields[0]!.name).toEqual('name en-US');
		expect(i18n.global.te(`fields.${mockField.collection}.${mockField.field}`)).toBe(true);

		const mockFieldWithoutTranslations = merge({}, mockField, {
			meta: {
				translations: null,
			},
		});

		fieldsStore.fields = [mockFieldWithoutTranslations].map(fieldsStore.parseField);
		expect(fieldsStore.fields[0]!.name).toEqual('Name');
		expect(i18n.global.te(`fields.${mockField.collection}.${mockField.field}`)).toBe(false);
	});

	test('keeps the bundled name of a system field and escapes literal characters', () => {
		const fieldsStore = useFieldsStore();

		const system = fieldsStore.parseField({
			collection: 'directus_users',
			field: 'email',
			meta: { system: true },
		} as unknown as FieldRaw);

		expect(system.name).toBe('Email');

		const special = fieldsStore.parseField({
			collection: 'a',
			field: 'price',
			meta: { translations: [{ language: 'en-US', translation: 'Price {USD} @ 1|2' }] },
		} as unknown as FieldRaw);

		expect(special.name).toBe('Price {USD} @ 1|2');
	});
});

describe('translateFields action', () => {
	test('translates $t: strings in note, options, display_options and validation_message', () => {
		const fieldsStore = useFieldsStore();

		fieldsStore.fields = [
			{
				collection: 'b',
				field: 'title',
				name: 'Title',
				meta: {
					note: '$t:save',
					options: { placeholder: '$t:required', nested: { label: '$t:name' } },
					display_options: { label: '$t:save' },
					validation_message: '$t:required',
				},
			},
			{ collection: 'b', field: 'raw', name: 'Raw', meta: null },
		] as unknown as Field[];

		fieldsStore.translateFields();

		expect(fieldsStore.fields[0]!.meta).toMatchObject({
			note: 'Save',
			options: { placeholder: 'Required', nested: { label: 'Name' } },
			display_options: { label: 'Save' },
			validation_message: 'Required',
		});
		expect(fieldsStore.fields[1]!.meta).toBeNull();
	});
});

const field = (collection: string, name: string, meta: Record<string, unknown> = {}, schema: unknown = {}) =>
	({ collection, field: name, name, type: 'string', schema, meta: { sort: null, group: null, ...meta } }) as Field;

describe('getters', () => {
	test('getPrimaryKeyFieldForCollection', () => {
		const fieldsStore = useFieldsStore();
		fieldsStore.fields = [field('a', 'title'), field('a', 'id', {}, { is_primary_key: true })];

		expect(fieldsStore.getPrimaryKeyFieldForCollection('a')?.field).toBe('id');
		expect(fieldsStore.getPrimaryKeyFieldForCollection('b')).toBeNull();
	});

	test('getFieldsForCollection puts system fields first then orders by sort; alphabetical sorts by key', () => {
		const fieldsStore = useFieldsStore();

		fieldsStore.fields = [
			field('a', 'c', { sort: 2 }),
			field('b', 'other'),
			field('a', 'b', { sort: 1 }),
			field('a', 'sys', { system: true, sort: 9 }),
		];

		expect(fieldsStore.getFieldsForCollection('a').map((f) => f.field)).toEqual(['sys', 'b', 'c']);
		expect(fieldsStore.getFieldsForCollectionAlphabetical('a').map((f) => f.field)).toEqual(['b', 'c', 'sys']);
	});

	test('getFieldsForCollectionSorted puts group children after their group', () => {
		const fieldsStore = useFieldsStore();

		fieldsStore.fields = [
			field('a', 'last', { sort: 3 }),
			field('a', 'child2', { sort: 2, group: 'group' }),
			field('a', 'group', { sort: 2 }),
			field('a', 'child1', { sort: 1, group: 'group' }),
			field('a', 'first', { sort: 1 }),
		];

		expect(fieldsStore.getFieldsForCollectionSorted('a').map((f) => f.field)).toEqual([
			'first',
			'group',
			'child1',
			'child2',
			'last',
		]);
	});

	test('getFieldGroupChildren', () => {
		const fieldsStore = useFieldsStore();
		fieldsStore.fields = [field('a', 'group'), field('a', 'child', { group: 'group' }), field('b', 'x', { group: 'group' })];

		expect(fieldsStore.getFieldGroupChildren('a', 'group')?.map((f) => f.field)).toEqual(['child']);
	});

	test('getField reads a field, a related field through m2o/o2m and an m2a collection scope', () => {
		const fieldsStore = useFieldsStore();
		const relationsStore = useRelationsStore();

		fieldsStore.fields = [
			field('articles', 'author'),
			field('articles', 'comments'),
			field('articles', 'items'),
			field('authors', 'name'),
			field('comments', 'body'),
			field('pages', 'slug'),
		];

		relationsStore.relations = [
			{ collection: 'articles', field: 'author', related_collection: 'authors', meta: { one_field: null } },
			{ collection: 'comments', field: 'article', related_collection: 'articles', meta: { one_field: 'comments' } },
		] as unknown as Relation[];

		expect(fieldsStore.getField('articles', 'author')?.field).toBe('author');
		expect(fieldsStore.getField('articles', 'missing')).toBeNull();
		expect(fieldsStore.getField('articles', 'author.name')?.collection).toBe('authors');
		expect(fieldsStore.getField('articles', 'comments.body')?.collection).toBe('comments');
		expect(fieldsStore.getField('articles', 'items.item:pages.slug')).toBeNull();
		expect(fieldsStore.getField('articles', 'item:pages.slug')?.collection).toBe('pages');
		expect(fieldsStore.getField('articles', 'missing.name')).toBeNull();
	});

	test('getField of a relation without related collection is null', () => {
		const fieldsStore = useFieldsStore();
		const relationsStore = useRelationsStore();

		fieldsStore.fields = [field('a', 'm2a')];
		relationsStore.relations = [
			{ collection: 'a', field: 'm2a', related_collection: null, meta: { one_field: null } },
		] as unknown as Relation[];

		expect(fieldsStore.getField('a', 'm2a.id')).toBeNull();
	});
});

// Feature 016 T013: the write actions of DR stores/fields.ts.
describe('write actions (016)', () => {
	const raw = (field: string, extra: Record<string, unknown> = {}) =>
		({ collection: 'a', field, type: 'string', schema: {}, meta: { collection: 'a', field, ...extra } }) as unknown as Field;

	test('upsertField creates a new field (POST) without `name`, and updates an existing one (PATCH)', async () => {
		const fetch = mockApi({
			'POST /fields/a': raw('title'),
			'PATCH /fields/a/title': raw('title', { hidden: true }),
		});
		const store = useFieldsStore();

		await store.upsertField('a', 'title', { field: 'title', type: 'string', name: 'Title' } as never);
		expect(store.getField('a', 'title')).toBeTruthy();
		await store.upsertField('a', 'title', { meta: { hidden: true } } as never);

		expect(calls(fetch)).toEqual(['POST /fields/a', 'PATCH /fields/a/title']);
		expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({ field: 'title', type: 'string' });
		expect(store.getField('a', 'title')!.meta!.hidden).toBe(true);
	});

	test('updateFields sends one PATCH with the array, and rolls back on error', async () => {
		const store = useFieldsStore();
		store.fields = [raw('one', { sort: 1 }), raw('two', { sort: 2 })].map(store.parseField);
		const updates = [
			{ field: 'two', meta: { sort: 1, group: null } },
			{ field: 'one', meta: { sort: 2, group: null } },
		];

		const fetch = mockApi({ 'PATCH /fields/a': [raw('two', { sort: 1 }), raw('one', { sort: 2 })] });
		await store.updateFields('a', updates as never);
		expect(calls(fetch)).toEqual(['PATCH /fields/a']);
		expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual(updates);
		expect(store.getField('a', 'two')!.meta!.sort).toBe(1);

		mockApi({});
		await store.updateFields('a', [{ field: 'one', meta: { sort: 9 } }] as never);
		expect(store.getField('a', 'one')!.meta!.sort).toBe(2);
	});

	test('only the latest updateFields response is applied (one counter for every collection)', async () => {
		const store = useFieldsStore();
		store.fields = [raw('one', { sort: 1 })].map(store.parseField);
		let release!: () => void;
		const first = new Promise<void>((resolve) => (release = resolve));

		mockApi({
			'PATCH /fields/a': async () => {
				await first;
				return new Response(JSON.stringify({ data: [raw('one', { sort: 5 })] }), { status: 200 });
			},
			'PATCH /fields/b': [],
		});

		const slow = store.updateFields('a', [{ field: 'one', meta: { sort: 5 } }] as never);
		await store.updateFields('b', []);
		store.fields = store.fields.map((f) => (f.field === 'one' ? { ...f, meta: { ...f.meta!, sort: 7 } } : f));
		release();
		await slow;

		expect(store.getField('a', 'one')!.meta!.sort).toBe(7);
	});

	test('deleteField removes the field and its relations first, then hydrates collections; rolls back on error', async () => {
		const store = useFieldsStore();
		const relationsStore = useRelationsStore();
		store.fields = [raw('m2o')].map(store.parseField);
		relationsStore.relations = [{ collection: 'a', field: 'm2o', related_collection: 'b', meta: null }] as never;

		const fetch = mockApi({ 'DELETE /fields/a/m2o': () => new Response(null, { status: 204 }), 'GET /collections': [] });
		await store.deleteField('a', 'm2o');
		expect(calls(fetch)).toEqual(['DELETE /fields/a/m2o', 'GET /collections']);
		expect(store.getField('a', 'm2o')).toBeNull();
		expect(relationsStore.relations).toEqual([]);

		store.fields = [raw('m2o')].map(store.parseField);
		relationsStore.relations = [{ collection: 'a', field: 'm2o', related_collection: 'b', meta: null }] as never;
		mockApi({});
		await store.deleteField('a', 'm2o');
		expect(store.getField('a', 'm2o')).toBeTruthy();
		expect(relationsStore.relations).toHaveLength(1);
	});
});
