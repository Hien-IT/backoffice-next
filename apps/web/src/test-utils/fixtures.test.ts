import { describe, expect, test } from 'vitest';
import { expected, fieldsOf, itemOf, loadSnapshot, relationsOf } from './fixtures.ts';

describe('loadSnapshot', () => {
	test('reads every snapshot file', () => {
		const snapshot = loadSnapshot();

		expect(snapshot.meta.version).toBe('11.17.4');
		expect(snapshot.collections.every((c) => c['collection'].startsWith('bo_'))).toBe(true);
		expect(snapshot.fields.every((f) => f.collection.startsWith('bo_'))).toBe(true);
		expect(snapshot.systemFields.some((f) => f.collection === 'directus_files')).toBe(true);
		expect(Object.keys(snapshot.items)).toEqual(expect.arrayContaining(['bo_std', 'bo_rel', 'bo_groups', 'bo_tree']));
		expect(Object.keys(snapshot.permissions).sort()).toEqual(['admin', 'bo-editor', 'bo-viewer']);
		expect(snapshot.users['bo-editor'].globals.admin_access).toBe(false);
		expect(snapshot.flows[0]!.name).toBe('bo-flow');
		expect(snapshot.files.map((f) => f['type']).sort()).toEqual(['application/pdf', 'image/png', 'image/svg+xml']);
	});

	test('returns a copy each time', () => {
		loadSnapshot().items['bo_std']![0]!['input_string'] = 'changed';
		expect(loadSnapshot().items['bo_std']![0]!['input_string']).toBe('alpha');
	});
});

test('fieldsOf keeps the form order and covers system collections', () => {
	const fields = fieldsOf('bo_std');

	expect(fields[0]!.field).toBe('id');
	expect(fields.map((f) => f.meta?.sort)).toEqual([...fields.map((f) => f.meta?.sort)].sort((a, b) => a! - b!));
	expect(fieldsOf('directus_files').some((f) => f.field === 'title')).toBe(true);
	expect(() => fieldsOf('nope')).toThrow('No fixture fields for nope');
});

test('relationsOf returns both sides', () => {
	const relations = relationsOf('bo_rel');

	expect(relations).toContainEqual(expect.objectContaining({ collection: 'bo_rel', field: 'm2o' }));
	expect(relations).toContainEqual(
		expect.objectContaining({ collection: 'bo_rel_target', field: 'o2m_list_parent', related_collection: 'bo_rel' }),
	);
});

test('itemOf finds rows by primary key, string keys too', () => {
	expect(itemOf('bo_std', 1)['input_string']).toBe('alpha');
	expect(itemOf('bo_rel', 1)['m2o']).toMatchObject({ id: 1, name: 'Target one' });
	expect(itemOf('bo_languages', 'ar-SA')['direction']).toBe('rtl');
	expect(() => itemOf('bo_std', 99)).toThrow('No fixture item bo_std/99');
});

test('expected fails loudly on a missing scenario', () => {
	expect(() => expected('input', 'nope')).toThrow('No expected value input/nope');
});
