// Ported from directus/app/src/utils/clear-hidden-fields-by-condition.test.ts
// Backoffice: a real pinia instead of @pinia/testing (no signed-in user, so parseFilter returns the rule as is).
import type { Field } from '@directus/types';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearHiddenFieldsByCondition, shouldClearField } from './clear-hidden-fields-by-condition.ts';

function makeField(fieldName: string, overrides: Partial<Field> = {}): Field {
	return {
		collection: 'test',
		field: fieldName,
		name: fieldName,
		type: 'string',
		schema: null,
		meta: {
			id: 1,
			collection: 'test',
			field: fieldName,
			special: null,
			interface: 'input',
			options: null as any,
			display: null,
			display_options: null as any,
			readonly: false,
			hidden: false,
			sort: 1,
			width: 'full',
			translations: null,
			note: null,
			conditions: null,
			required: false,
			group: null,
			validation: null,
			validation_message: null,
		},
		...overrides,
	} as Field;
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('shouldClearField', () => {
	it('returns false when field has no conditions', () => {
		const field = makeField('title');
		expect(shouldClearField(field, {})).toBe(false);
	});

	it('returns false when no condition matches', () => {
		const field = makeField('title', {
			meta: {
				...makeField('title').meta!,
				conditions: [
					{
						name: 'hide when published',
						rule: { status: { _eq: 'published' } },
						hidden: true,
						readonly: false,
						options: null as any,
						required: false,
						clear_hidden_value_on_save: true,
					},
				],
			},
		});

		expect(shouldClearField(field, { status: 'draft' })).toBe(false);
	});

	it('returns false when condition matches but hidden is false', () => {
		const field = makeField('title', {
			meta: {
				...makeField('title').meta!,
				conditions: [
					{
						name: 'not hidden when published',
						rule: { status: { _eq: 'published' } },
						hidden: false,
						readonly: false,
						options: null as any,
						required: false,
						clear_hidden_value_on_save: true,
					},
				],
			},
		});

		expect(shouldClearField(field, { status: 'published' })).toBe(false);
	});

	it('returns false when condition matches, hidden is true, but clear_hidden_value_on_save is false', () => {
		const field = makeField('title', {
			meta: {
				...makeField('title').meta!,
				conditions: [
					{
						name: 'hide but keep value',
						rule: { status: { _eq: 'published' } },
						hidden: true,
						readonly: false,
						options: null as any,
						required: false,
						clear_hidden_value_on_save: false,
					},
				],
			},
		});

		expect(shouldClearField(field, { status: 'published' })).toBe(false);
	});

	it('returns true when condition matches and both hidden and clear_hidden_value_on_save are true', () => {
		const field = makeField('title', {
			meta: {
				...makeField('title').meta!,
				conditions: [
					{
						name: 'hide and clear when published',
						rule: { status: { _eq: 'published' } },
						hidden: true,
						readonly: false,
						options: null as any,
						required: false,
						clear_hidden_value_on_save: true,
					},
				],
			},
		});

		expect(shouldClearField(field, { status: 'published' })).toBe(true);
	});
});

describe('clearHiddenFieldsByCondition', () => {
	it('returns original edits reference when no fields need clearing', () => {
		const field = makeField('title');
		const edits = { title: 'hello' };
		const result = clearHiddenFieldsByCondition(edits, [field], {}, {});
		expect(result).toBe(edits);
	});

	it('clears a field to null when schema has no default_value', () => {
		const field = makeField('title', {
			meta: {
				...makeField('title').meta!,
				conditions: [
					{
						name: 'clear title',
						rule: { status: { _eq: 'published' } },
						hidden: true,
						readonly: false,
						options: null as any,
						required: false,
						clear_hidden_value_on_save: true,
					},
				],
			},
		});

		const edits = { title: 'some value', status: 'published' };
		const result = clearHiddenFieldsByCondition(edits, [field], {}, {});
		expect(result['title']).toBeNull();
	});

	it('clears a field to its schema default_value', () => {
		const field = makeField('score', {
			schema: {
				name: 'score',
				table: 'test',
				data_type: 'integer',
				default_value: 0,
				max_length: null,
				numeric_precision: null,
				numeric_scale: null,
				is_generated: false,
				generation_expression: null,
				is_nullable: true,
				is_unique: false,
				is_indexed: false,
				is_primary_key: false,
				has_auto_increment: false,
				foreign_key_column: null,
				foreign_key_table: null,
			},
			meta: {
				...makeField('score').meta!,
				conditions: [
					{
						name: 'clear score',
						rule: { status: { _eq: 'published' } },
						hidden: true,
						readonly: false,
						options: null as any,
						required: false,
						clear_hidden_value_on_save: true,
					},
				],
			},
		});

		const edits = { score: 42, status: 'published' };
		const result = clearHiddenFieldsByCondition(edits, [field], {}, {});
		expect(result['score']).toBe(0);
	});

	it('does not mutate the original edits', () => {
		const field = makeField('title', {
			meta: {
				...makeField('title').meta!,
				conditions: [
					{
						name: 'clear title',
						rule: { status: { _eq: 'published' } },
						hidden: true,
						readonly: false,
						options: null as any,
						required: false,
						clear_hidden_value_on_save: true,
					},
				],
			},
		});

		const edits = { title: 'original', status: 'published' };
		const result = clearHiddenFieldsByCondition(edits, [field], {}, {});
		expect(edits.title).toBe('original');
		expect(result['title']).toBeNull();
	});

	it('evaluates conditions against merged values from defaults, item, and edits', () => {
		const field = makeField('title', {
			meta: {
				...makeField('title').meta!,
				conditions: [
					{
						name: 'clear when archived',
						rule: { status: { _eq: 'archived' } },
						hidden: true,
						readonly: false,
						options: undefined as any,
						required: false,
						clear_hidden_value_on_save: true,
					},
				],
			},
		});

		// status comes from existing item, not edits
		const edits = { title: 'some value' };
		const defaults = {};
		const item = { status: 'archived' };
		const result = clearHiddenFieldsByCondition(edits, [field], defaults, item);
		expect(result['title']).toBeNull();
	});

	it('clears all fields within a hidden group', () => {
		const groupField = makeField('my_group', {
			type: 'alias',
			schema: null,
			meta: {
				...makeField('my_group').meta!,
				special: ['alias', 'no-data', 'group'],
				conditions: [
					{
						name: 'hide group',
						rule: { status: { _eq: 'published' } },
						hidden: true,
						readonly: false,
						options: null as any,
						required: false,
						clear_hidden_value_on_save: true,
					},
				],
			},
		});

		const childField1 = makeField('child_one', {
			meta: { ...makeField('child_one').meta!, group: 'my_group' },
		});

		const childField2 = makeField('child_two', {
			meta: { ...makeField('child_two').meta!, group: 'my_group' },
		});

		const edits = { child_one: 'value1', child_two: 'value2', status: 'published' };
		const result = clearHiddenFieldsByCondition(edits, [groupField, childField1, childField2], {}, {});
		expect(result['child_one']).toBeNull();
		expect(result['child_two']).toBeNull();
	});

	it('does not clear fields in a group when its condition does not match', () => {
		const groupField = makeField('my_group', {
			type: 'alias',
			schema: null,
			meta: {
				...makeField('my_group').meta!,
				special: ['alias', 'no-data', 'group'],
				conditions: [
					{
						name: 'hide group',
						rule: { status: { _eq: 'published' } },
						hidden: true,
						readonly: false,
						options: null as any,
						required: false,
						clear_hidden_value_on_save: true,
					},
				],
			},
		});

		const childField = makeField('child_one', {
			meta: { ...makeField('child_one').meta!, group: 'my_group' },
		});

		const edits = { child_one: 'value1', status: 'draft' };
		const result = clearHiddenFieldsByCondition(edits, [groupField, childField], {}, {});
		expect(result).toBe(edits);
	});

	// Backoffice: FR-013, a hidden group clears its nested groups (default value kept), and a child field inside a
	// visible group is cleared by its own condition.
	it('clears nested group children to their default and a child hidden by its own condition', () => {
		const hideWhen = (value: string) => [
			{
				name: 'hide',
				rule: { status: { _eq: value } },
				hidden: true,
				readonly: false,
				options: null as any,
				required: false,
				clear_hidden_value_on_save: true,
			},
		];

		const outer = makeField('outer', {
			type: 'alias',
			meta: { ...makeField('outer').meta!, special: ['alias', 'no-data', 'group'], conditions: hideWhen('archived') },
		});

		const inner = makeField('inner', {
			type: 'alias',
			meta: { ...makeField('inner').meta!, special: ['alias', 'no-data', 'group'], group: 'outer' },
		});

		const deep = makeField('deep', {
			schema: { default_value: 'fallback' } as Field['schema'],
			meta: { ...makeField('deep').meta!, group: 'inner' },
		});

		const own = makeField('own', {
			meta: { ...makeField('own').meta!, group: 'inner', conditions: hideWhen('draft') },
		});

		const fields = [outer, inner, deep, own];

		expect(clearHiddenFieldsByCondition({ deep: 'x', own: 'y', status: 'archived' }, fields, {}, {})).toMatchObject({
			deep: 'fallback',
			own: null,
		});

		expect(clearHiddenFieldsByCondition({ deep: 'x', own: 'y' }, fields, {}, { status: 'draft' })).toEqual({
			deep: 'x',
			own: null,
		});
	});
});
