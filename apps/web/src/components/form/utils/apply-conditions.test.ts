// DR has no test for apply-conditions.ts: cases of spec FR-013 (last matching rule wins, options arrays replaced,
// $version, rule with one root key only).
import type { Field } from '@directus/types';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';
import { applyConditions } from './apply-conditions.ts';

beforeEach(() => {
	setActivePinia(createPinia());
});

function field(conditions: Record<string, any>[] | null, meta: Record<string, any> = {}): Field {
	return {
		collection: 'test',
		field: 'title',
		type: 'string',
		name: 'Title',
		schema: null,
		meta: { hidden: false, readonly: false, required: false, options: { choices: [1, 2, 3], keep: true }, conditions, ...meta },
	} as unknown as Field;
}

describe('applyConditions', () => {
	test('returns the field unchanged without conditions or without a match', () => {
		const noConditions = field(null);
		expect(applyConditions({}, noConditions)).toBe(noConditions);

		const noMatch = field([{ name: 'a', rule: { status: { _eq: 'draft' } }, hidden: true }]);
		expect(applyConditions({ status: 'published' }, noMatch)).toBe(noMatch);
	});

	test('overrides hidden, readonly, required and clear_hidden_value_on_save of the matching rule', () => {
		const result = applyConditions(
			{ status: 'draft' },
			field([
				{
					name: 'a',
					rule: { status: { _eq: 'draft' } },
					hidden: true,
					readonly: true,
					required: true,
					clear_hidden_value_on_save: true,
				},
			]),
		);

		expect(result.meta).toMatchObject({ hidden: true, readonly: true, required: true, clear_hidden_value_on_save: true });
	});

	test('the last matching rule wins', () => {
		const result = applyConditions(
			{ status: 'draft', count: 5 },
			field([
				{ name: 'first', rule: { status: { _eq: 'draft' } }, hidden: true, readonly: false },
				{ name: 'second', rule: { count: { _gt: 1 } }, hidden: false, readonly: true },
				{ name: 'third', rule: { count: { _gt: 10 } }, required: true },
			]),
		);

		expect(result.meta).toMatchObject({ hidden: false, readonly: true, required: false });
	});

	test('an options array replaces the whole array, other option keys are merged', () => {
		const result = applyConditions(
			{ status: 'draft' },
			field([{ name: 'a', rule: { status: { _eq: 'draft' } }, options: { choices: [9] } }]),
		);

		expect(result.meta?.options).toEqual({ choices: [9], keep: true });
	});

	test('a rule with more than one root key is ignored', () => {
		const result = applyConditions(
			{ status: 'draft', count: 1 },
			field([{ name: 'a', rule: { status: { _eq: 'draft' }, count: { _eq: 1 } }, hidden: true }]),
		);

		expect(result.meta?.hidden).toBe(false);
	});

	test('$version is the version name, null without a version', () => {
		const conditions = [{ name: 'a', rule: { $version: { _null: true } }, hidden: true }];

		expect(applyConditions({}, field(conditions)).meta?.hidden).toBe(true);
		expect(applyConditions({}, field(conditions), { name: 'draft' }).meta?.hidden).toBe(false);
	});
});
