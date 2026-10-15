// Ported from directus/app/src/utils/extract-error-code.test.ts (behaviour; sdk errors instead of axios)
import { expect, test } from 'vitest';
import { extractErrorCode } from './extract-error-code.ts';

test('reads the code of an sdk error, an axios-like error and an API error, else UNKNOWN', () => {
	expect(extractErrorCode({ errors: [{ extensions: { code: 'FORBIDDEN' } }] })).toBe('FORBIDDEN');
	expect(extractErrorCode({ response: { data: { errors: [{ extensions: { code: 'INVALID_QUERY' } }] } } })).toBe(
		'INVALID_QUERY',
	);
	expect(extractErrorCode({ extensions: { code: 'RECORD_NOT_UNIQUE' } })).toBe('RECORD_NOT_UNIQUE');
	expect(extractErrorCode(new Error('x'))).toBe('UNKNOWN');
	expect(extractErrorCode(null)).toBe('UNKNOWN');
});
