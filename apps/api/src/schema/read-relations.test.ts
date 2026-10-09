import { expect, test } from 'vitest';
import { stitchRelations } from './read-relations.js';

const fk = (table: string, column: string, foreign: string) =>
	({
		table,
		column,
		foreign_key_table: foreign,
		foreign_key_column: 'id',
		constraint_name: null,
		on_update: null,
		on_delete: null,
	}) as any;

test('stitchRelations joins meta rows to foreign keys; leftover meta rows have no schema', () => {
	const meta = [
		{ many_collection: 'a', many_field: 'b', one_collection: 'c' },
		{ many_collection: 'a', many_field: 'x', one_collection: 'other' },
		{ many_collection: 'm', many_field: 'n', one_collection: null },
	] as any[];

	const result = stitchRelations(meta, [fk('a', 'b', 'c'), fk('a', 'x', 'y'), fk('z', 'z', 'q')]);

	expect(result).toEqual([
		{ collection: 'a', field: 'b', related_collection: 'c', schema: fk('a', 'b', 'c'), meta: meta[0] },
		{ collection: 'a', field: 'x', related_collection: 'y', schema: fk('a', 'x', 'y'), meta: null },
		{ collection: 'z', field: 'z', related_collection: 'q', schema: fk('z', 'z', 'q'), meta: null },
		{ collection: 'a', field: 'x', related_collection: 'other', schema: null, meta: meta[1] },
		{ collection: 'm', field: 'n', related_collection: null, schema: null, meta: meta[2] },
	]);
});
