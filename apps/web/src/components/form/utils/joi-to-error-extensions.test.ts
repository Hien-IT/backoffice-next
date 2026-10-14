// Directus has no test for joi-to-error-extensions.ts; the Joi items come from validatePayload (as in validate-item).
import { validatePayload } from '@directus/utils';
import { describe, expect, test } from 'vitest';
import { joiValidationErrorItemToErrorExtensions } from './joi-to-error-extensions.ts';

function extensions(rule: Record<string, any>, item: Record<string, any>) {
	return validatePayload({ _and: [{ field: rule }] }, item).flatMap((error) =>
		error.details.map((details) => joiValidationErrorItemToErrorExtensions(details)),
	);
}

describe('joiValidationErrorItemToErrorExtensions', () => {
	test.each([
		[{ _eq: 'a' }, 'b', { type: 'eq', valid: 'a' }],
		[{ _neq: 'a' }, 'a', { type: 'neq', invalid: 'a' }],
		[{ _in: ['a', 'b'] }, 'c', { type: 'in', valid: ['a', 'b'] }],
		[{ _nnull: true }, null, { type: 'nnull' }],
		[{ _gt: 5 }, 1, { type: 'gt', valid: 5 }],
		[{ _gte: 5 }, 1, { type: 'gte', valid: 5 }],
		[{ _lt: 5 }, 9, { type: 'lt', valid: 5 }],
		[{ _lte: 5 }, 9, { type: 'lte', valid: 5 }],
		[{ _contains: 'x' }, 'abc', { type: 'contains', substring: 'x' }],
		[{ _starts_with: 'abc' }, 'x', { type: 'starts_with', substring: 'abc' }],
		[{ _submitted: true }, undefined, { type: 'required' }],
	])('maps %j', (rule, value, expected) => {
		const item = value === undefined ? {} : { field: value };
		expect(extensions(rule, item)).toEqual([expect.objectContaining({ field: 'field', path: [], ...expected })]);
	});

	test('throws for an unknown Joi type', () => {
		expect(() => joiValidationErrorItemToErrorExtensions({ path: ['a'], type: 'any.unknown' })).toThrow();
	});
});
