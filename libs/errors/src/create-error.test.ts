// Ported from directus/packages/errors/src/create-error.test.ts
import { beforeEach, expect, test, vi } from 'vitest';
import { createError } from './create-error.js';

let sample: {
	code: string;
	status: number;
	message: string;
	extensionKey: string;
	extensionValue: string;
};

beforeEach(() => {
	sample = {
		code: 'test_error',
		status: 400,
		message: 'Test error message',
		extensionKey: 'testKey',
		extensionValue: 'testValue',
	};
});

test('Returns enhanced error object', () => {
	const TestError = createError(sample.code, sample.message, sample.status);
	const error = new TestError();

	expect(error.name).toBe('DirectusError');
	expect(error.code).toBe('TEST_ERROR');
	expect(error.message).toBe(sample.message);
	expect(error.status).toBe(sample.status);
});

test('Allows passing message as callback function', () => {
	const TestError = createError(sample.code, () => sample.message, sample.status);
	const error = new TestError();
	expect(error.message).toBe(sample.message);
});

test('Passes extensions to custom message function', () => {
	const messageGenerator = vi.fn().mockReturnValue(sample.message);
	const extensions = { [sample.extensionKey]: sample.extensionValue };
	const TestError = createError<{ [key: string]: unknown }>(sample.code, messageGenerator, sample.status);

	new TestError(extensions);

	expect(messageGenerator).toHaveBeenCalledWith(extensions);
});

test('Makes extensions available', () => {
	const messageGenerator = vi.fn().mockReturnValue(sample.message);
	const extensions = { [sample.extensionKey]: sample.extensionValue };
	const TestError = createError<{ [key: string]: unknown }>(sample.code, messageGenerator, sample.status);

	const error = new TestError(extensions);

	expect(error.extensions).toBe(extensions);
});

test('Overrides toString', () => {
	const TestError = createError(sample.code, sample.message, sample.status);

	const error = new TestError();

	expect(error.toString()).toBe(`DirectusError [${sample.code.toUpperCase()}]: ${sample.message}`);
});

// Backoffice: feature 009 R7, flows serialize errors with JSON.stringify ($all of a webhook, run revisions)
test('Serializes like Directus: name, extensions, code, status (message is not enumerable)', () => {
	const PlainError = createError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', 500);
	const WithExtensions = createError<{ points: number }>('EMAIL_LIMIT_EXCEEDED', 'Email sending limit exceeded.', 429);

	expect(JSON.stringify(new PlainError())).toBe('{"name":"DirectusError","code":"INTERNAL_SERVER_ERROR","status":500}');

	expect(JSON.stringify(new WithExtensions({ points: 1 }))).toBe(
		'{"name":"DirectusError","extensions":{"points":1},"code":"EMAIL_LIMIT_EXCEEDED","status":429}',
	);
});
