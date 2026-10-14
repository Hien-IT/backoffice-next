import { expect, test, vi } from 'vitest';
import { unexpectedError } from './unexpected-error.ts';

test('warns in the console and returns the error', () => {
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	const error = new Error('x');

	expect(unexpectedError(error)).toBe(error);
	expect(warn).toHaveBeenCalledWith(error);
	warn.mockRestore();
});
