// Backoffice (spec 023, D-186): `<f>_json` GraphQL filter inputs to the REST key json(f, path, type).
import { InvalidQueryError } from '@backoffice/errors';
import { describe, expect, test } from 'vitest';
import { replaceFieldCompares, replaceFuncs, replaceJsonPaths, withBackofficeFilters } from './replace-funcs.js';

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

// Backoffice (spec 028, D-205): `<f>_field: { _op: { field } }` to the REST value `$FIELD(b)`.
describe('replaceFieldCompares', () => {
	test('top level, each operator', () => {
		expect(replaceFieldCompares({ total_field: { _gt: { field: 'paid_amount' } } })).toEqual({
			total: { _gt: '$FIELD(paid_amount)' },
		});
		expect(
			replaceFieldCompares({ total_field: { _eq: { field: 'a' }, _neq: { field: 'b' }, _lte: { field: 'c' } } }),
		).toEqual({ total: { _eq: '$FIELD(a)', _neq: '$FIELD(b)', _lte: '$FIELD(c)' } });
	});

	test('merged with the plain operators of the field, the _field operator wins, either order', () => {
		expect(replaceFieldCompares({ total: { _gte: 1 }, total_field: { _gt: { field: 'paid_amount' } } })).toEqual({
			total: { _gte: 1, _gt: '$FIELD(paid_amount)' },
		});
		expect(replaceFieldCompares({ total: { _gt: 1 }, total_field: { _gt: { field: 'paid_amount' } } })).toEqual({
			total: { _gt: '$FIELD(paid_amount)' },
		});
		expect(replaceFieldCompares({ total_field: { _gt: { field: 'paid_amount' } }, total: { _gt: 1 } })).toEqual({
			total: { _gt: '$FIELD(paid_amount)' },
		});
	});

	test('nested: m2o, _and/_or, _some, arrays, next to other keys and json paths', () => {
		const filter = {
			_and: [
				{ customer: { credit_field: { _gt: { field: 'balance' } } } },
				{ _or: [{ status: { _eq: 'paid' } }, { updated_at_field: { _gte: { field: 'published_at' } } }] },
				{ lines: { _some: { qty_field: { _neq: { field: 'shipped' } } } } },
			],
		};

		expect(replaceFieldCompares(filter)).toEqual({
			_and: [
				{ customer: { credit: { _gt: '$FIELD(balance)' } } },
				{ _or: [{ status: { _eq: 'paid' } }, { updated_at: { _gte: '$FIELD(published_at)' } }] },
				{ lines: { _some: { qty: { _neq: '$FIELD(shipped)' } } } },
			],
		});
	});

	test('graphql-js argument objects (null prototype)', () => {
		const ref = Object.assign(Object.create(null), { field: 'paid_amount' });
		const ops = Object.assign(Object.create(null), { _gt: ref });
		const filter = Object.assign(Object.create(null), { total_field: ops });

		expect(replaceFieldCompares(filter)).toEqual({ total: { _gt: '$FIELD(paid_amount)' } });
	});

	test('a real field whose name ends in _field keeps its scalar operators', () => {
		expect(replaceFieldCompares({ x_field: { _eq: 'abc' } })).toEqual({ x_field: { _eq: 'abc' } });
		expect(replaceFieldCompares({ x_field: { _gt: 1, _lt: 5 } })).toEqual({ x_field: { _gt: 1, _lt: 5 } });
		expect(replaceFieldCompares({ x_field: { _in: [{ field: 'a' }] } })).toEqual({
			x_field: { _in: [{ field: 'a' }] },
		});
		expect(replaceFieldCompares({ x_field: { _null: true } })).toEqual({ x_field: { _null: true } });
	});

	test('non objects are returned as they are', () => {
		expect(replaceFieldCompares(undefined)).toBeUndefined();
		expect(replaceFieldCompares(null)).toBeNull();
		expect(replaceFieldCompares('x')).toBe('x');
	});
});

describe('withBackofficeFilters', () => {
	test('json paths and field compares of the filter, other query parts untouched', () => {
		const query: { limit: number; filter?: unknown } = {
			limit: 1,
			filter: { details_json: { path: 'a', number: { _eq: 1 } }, total_field: { _gt: { field: 'paid_amount' } } },
		};

		expect(withBackofficeFilters(query)).toEqual({
			limit: 1,
			filter: { 'json(details, a, number)': { _eq: 1 }, total: { _gt: '$FIELD(paid_amount)' } },
		});
		expect(withBackofficeFilters({ limit: 1 } as { limit: number; filter?: unknown })).toEqual({ limit: 1 });
	});
});

describe('replaceFuncs', () => {
	test('keeps the DR _func mapping', () => {
		expect(replaceFuncs({ date_func: { year: { _eq: 2026 } } } as any)).toEqual({ 'year(date)': { _eq: 2026 } });
	});
});
