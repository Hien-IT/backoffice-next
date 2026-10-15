// Ported from directus/app/src/utils/add-query-to-path.test.ts
import { expect, test } from 'vitest';
import { addQueryToPath } from './add-query-to-path.ts';

test('Adds query parameters to given path', () => {
	const output = addQueryToPath('/path/to/something', {
		test: 'hello',
		another: 'world',
	});

	expect(output).toBe('/path/to/something?test=hello&another=world');
});

test('Keeps existing query parameters intact', () => {
	const output = addQueryToPath('/path/to/something?existing=param', {
		test: 'hello',
		another: 'world',
	});

	expect(output).toBe('/path/to/something?existing=param&test=hello&another=world');
});
