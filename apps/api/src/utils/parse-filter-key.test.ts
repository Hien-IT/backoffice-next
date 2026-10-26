// Ported from directus/api/src/utils/parse-filter-key.test.ts
import { expect, test } from 'vitest';
import { parseFilterKey } from './parse-filter-key.js';

const testCases = [
	{ key: 'test', expected: { fieldName: 'test' } },
	{ key: ' ', expected: { fieldName: '' } },
	// should only treat as function when field available
	{ key: 'fn( )', expected: { fieldName: 'fn( )' } },
	{ key: 'year(date_created)', expected: { fieldName: 'date_created', functionName: 'year' } },
	{ key: ' example ( field )', expected: { fieldName: 'field', functionName: 'example' } },
	// Backoffice (spec 023, R1): json(field, path[, type]) names the base json field
	{ key: 'json(transaction_data, Amount, number)', expected: { fieldName: 'transaction_data', functionName: 'json' } },
	{ key: 'json(meta, a.b)', expected: { fieldName: 'meta', functionName: 'json' } },
	{ key: 'json( meta , items[*].sku, text)', expected: { fieldName: 'meta', functionName: 'json' } },
	{ key: 'count(links)', expected: { fieldName: 'links', functionName: 'count' } },
];

test.each(testCases)('should return "$expected" for "$key"', ({ key, expected }) => {
	const { fieldName, functionName } = parseFilterKey(key);

	expect(fieldName).toBe(expected.fieldName);
	expect(functionName).toBe(expected.functionName);
});

test('jsonBaseField: false keeps the DR field name of a json() key (convert-wildcards)', () => {
	expect(parseFilterKey('json(meta, color)', { jsonBaseField: false })).toEqual({
		fieldName: 'meta, color',
		functionName: 'json',
	});
});
