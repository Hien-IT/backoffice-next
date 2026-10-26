// Backoffice (spec 023, D-186): `<f>_json` GraphQL filter inputs to the REST key json(f, path, type).
import { InvalidQueryError } from '@backoffice/errors';
import { describe, expect, test } from 'vitest';
import { replaceFuncs, replaceJsonPaths } from './replace-funcs.js';

describe('replaceJsonPaths', () => {
	test('top level, each type', () => {
		expect(replaceJsonPaths({ details_json: { path: 'Amount', number: { _eq: 6000 } } })).toEqual({
			'json(details, Amount, number)': { _eq: 6000 },
		});
		expect(replaceJsonPaths({ details_json: { path: 'items[*].sku', text: { _contains: 'A' } } })).toEqual({
			'json(details, items[*].sku, text)': { _contains: 'A' },
		});
		expect(replaceJsonPaths({ details_json: { path: 'flag', boolean: { _eq: true } } })).toEqual({
			'json(details, flag, boolean)': { _eq: true },
		});
	});

	test('nested: m2o, _and/_or, _some, next to other keys', () => {
		const filter = {
			_and: [
				{ category: { meta_json: { path: 'a.b', text: { _eq: 'x' } } } },
				{ _or: [{ status: { _eq: 'paid' } }, { details_json: { path: 'n', number: { _gt: 2 } } }] },
				{ tags: { _some: { data_json: { path: '[0]', text: { _nnull: true } } } } },
			],
		};

		expect(replaceJsonPaths(filter)).toEqual({
			_and: [
				{ category: { 'json(meta, a.b, text)': { _eq: 'x' } } },
				{ _or: [{ status: { _eq: 'paid' } }, { 'json(details, n, number)': { _gt: 2 } }] },
				{ tags: { _some: { 'json(data, [0], text)': { _nnull: true } } } },
			],
		});
	});

	test('graphql-js argument objects (null prototype)', () => {
		const ops = Object.assign(Object.create(null), { _eq: 1 });
		const input = Object.assign(Object.create(null), { path: 'a', number: ops });
		const filter = Object.assign(Object.create(null), { details_json: input });

		expect(replaceJsonPaths(filter)).toEqual({ 'json(details, a, number)': { _eq: 1 } });
	});

	test('none or two of text, number, boolean: InvalidQueryError', () => {
		const message = '"details_json" needs exactly one of text, number, boolean';

		expect(() => replaceJsonPaths({ details_json: { path: 'a' } })).toThrow(InvalidQueryError);
		expect(() => replaceJsonPaths({ details_json: { path: 'a' } })).toThrow(message);
		expect(() =>
			replaceJsonPaths({ _and: [{ details_json: { path: 'a', text: { _eq: 'x' }, number: { _eq: 1 } } }] }),
		).toThrow(message);
	});

	test('a field whose name ends in _json is kept when the value is not a json path input', () => {
		expect(replaceJsonPaths({ x_json: { _eq: 1 } })).toEqual({ x_json: { _eq: 1 } });
		expect(replaceJsonPaths({ foo_json: { path: { _eq: 'x' } } })).toEqual({ foo_json: { path: { _eq: 'x' } } });
	});

	test('non objects are returned as they are', () => {
		expect(replaceJsonPaths(undefined)).toBeUndefined();
		expect(replaceJsonPaths(null)).toBeNull();
		expect(replaceJsonPaths('{"a":1}')).toBe('{"a":1}');
	});
});

describe('replaceFuncs', () => {
	test('keeps the DR _func mapping', () => {
		expect(replaceFuncs({ date_func: { year: { _eq: 2026 } } } as any)).toEqual({ 'year(date)': { _eq: 2026 } });
	});
});
