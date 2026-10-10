import Joi, { type ValidationErrorItem } from 'joi';
import { describe, expect, test } from 'vitest';
import { joiValidationErrorItemToErrorExtensions } from './joi-to-error-extensions.js';

const firstItem = (schema: Joi.Schema, value: unknown): ValidationErrorItem => {
	const { error } = Joi.object({ field: schema }).validate({ field: value });
	return error!.details[0]!;
};

const item = (type: string, context: Record<string, unknown> = {}): ValidationErrorItem => ({
	message: 'message',
	path: ['field'],
	type,
	context,
});

describe('joiValidationErrorItemToErrorExtensions', () => {
	test.each([
		['eq', Joi.valid('a'), 'b', { type: 'eq', valid: 'a' }],
		['in', Joi.valid('a', 'b'), 'c', { type: 'in', valid: ['a', 'b'] }],
		['null', Joi.valid(null), 'a', { type: 'null' }],
		['empty', Joi.valid(''), 'a', { type: 'empty' }],
		['neq', Joi.invalid('a'), 'a', { type: 'neq', invalid: 'a' }],
		['nin', Joi.invalid('a', 'b'), 'a', { type: 'nin', invalid: ['a', 'b'] }],
		['nnull', Joi.any().invalid(null), null, { type: 'nnull' }],
		['nempty', Joi.string().allow('').invalid(''), '', { type: 'nempty' }],
		['gt', Joi.number().greater(5), 1, { type: 'gt', valid: 5 }],
		['gte', Joi.number().min(5), 1, { type: 'gte', valid: 5 }],
		['lt', Joi.number().less(5), 9, { type: 'lt', valid: 5 }],
		['lte', Joi.number().max(5), 9, { type: 'lte', valid: 5 }],
		['required', Joi.required(), undefined, { type: 'required' }],
		['regex', Joi.string().pattern(/^a/), 'b', { type: 'regex', invalid: 'b' }],
	])('maps %s', (_name, schema, value, expected) => {
		expect(joiValidationErrorItemToErrorExtensions(firstItem(schema, value))).toEqual({
			field: 'field',
			path: [],
			...expected,
		});
	});

	test('maps contains and ncontains', () => {
		expect(joiValidationErrorItemToErrorExtensions(item('string.contains', { substring: 'x' }))).toMatchObject({
			type: 'contains',
			substring: 'x',
		});

		expect(joiValidationErrorItemToErrorExtensions(item('string.ncontains', { substring: 'x' }))).toMatchObject({
			type: 'ncontains',
			substring: 'x',
		});
	});

	test('maps named patterns with a substring', () => {
		expect(
			joiValidationErrorItemToErrorExtensions(item('string.pattern.name', { name: 'starts_with', regex: /^abc.*/ })),
		).toMatchObject({ type: 'starts_with', substring: 'abc' });

		expect(
			joiValidationErrorItemToErrorExtensions(
				item('string.pattern.invert.name', { name: 'ends_with', regex: /.*abc$/ }),
			),
		).toMatchObject({ type: 'ends_with', substring: 'abc' });

		expect(
			joiValidationErrorItemToErrorExtensions(item('string.pattern.name', { name: 'eq', regex: /^a$/ })),
		).toMatchObject({ type: 'eq' });
	});

	test('prefixes the given path and keeps the nested part', () => {
		const nested: ValidationErrorItem = { ...item('any.required'), path: ['field', 'child'] };
		expect(joiValidationErrorItemToErrorExtensions(nested, ['parent'])).toEqual({
			field: 'field',
			path: ['parent', 'child'],
			type: 'required',
		});
	});

	test('throws on an unknown type', () => {
		expect(() => joiValidationErrorItemToErrorExtensions(item('any.custom'))).toThrow(
			"Couldn't extract validation error type from Joi validation error item",
		);
	});
});
