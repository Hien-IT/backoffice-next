import { expect, test } from 'vitest';
import { translateAPIError } from './index.ts';

test('translates a code', () => {
	expect(translateAPIError('INVALID_CREDENTIALS')).toBe('Wrong username or password');
});

test('reads the code of an SDK error', () => {
	expect(
		translateAPIError({
			errors: [{ message: 'Invalid user credentials.', extensions: { code: 'INVALID_CREDENTIALS' } }],
		}),
	).toBe('Wrong username or password');
});

test('reads the code of an axios-like error', () => {
	expect(translateAPIError({ response: { data: { errors: [{ extensions: { code: 'FORBIDDEN' } }] } } })).toBe(
		'Forbidden',
	);
});

test('unknown code, no code or no error gives unexpected_error', () => {
	expect(translateAPIError('NOT_A_CODE')).toBe('Unexpected Error');
	expect(translateAPIError({ errors: [{}] })).toBe('Unexpected Error');
	expect(translateAPIError({ errors: 'Network down' })).toBe('Unexpected Error');
	expect(translateAPIError('')).toBe('Unexpected Error');
	expect(translateAPIError(null)).toBe('Unexpected Error');
});
