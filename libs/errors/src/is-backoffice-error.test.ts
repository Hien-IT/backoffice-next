// Ported from directus/packages/errors/src/is-directus-error.test.ts
import { beforeEach, expect, test } from 'vitest';
import { createError } from './create-error.js';
import { isBackofficeError } from './is-backoffice-error.js';

let sample: {
	code: string;
	status: number;
	message: string;
};

beforeEach(() => {
	sample = {
		code: 'test_error',
		status: 400,
		message: 'Test error message',
	};
});

test('Reports false for non Directus-errors', () => {
	const negative = [
		false,
		() => {
			/* empty */
		},
		[],
		new Error(),
		0,
		null,
		undefined,
		new Set(),
	];

	for (const input of negative) {
		expect(isBackofficeError(input)).toBe(false);
	}
});

test('Reports true for Directus error', () => {
	const SampleError = createError(sample.code, sample.message, sample.status);
	const error = new SampleError();
	expect(isBackofficeError(error)).toBe(true);
});

test('Check against optional error code', () => {
	const SampleError = createError(sample.code, sample.message, sample.status);
	const error = new SampleError();
	expect(isBackofficeError(error, sample.code)).toBe(true);
	expect(isBackofficeError(error, 'different_code')).toBe(false);
});
