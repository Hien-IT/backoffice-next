import { afterEach, expect, test, vi } from 'vitest';
import { logUnhandledRejections } from './unhandled-rejection.js';

afterEach(() => vi.restoreAllMocks());

test("logs an unhandled rejection like pm2's process container and keeps the process running", () => {
	const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
	const before = process.listeners('unhandledRejection');
	logUnhandledRejections();
	const listener = process.listeners('unhandledRejection').find((l) => !before.includes(l))!;

	const error = new Error('Reached the max retries per request limit');
	listener(error, Promise.resolve());
	listener('plain reason', Promise.resolve());

	expect(write).toHaveBeenCalledWith(
		`You have triggered an unhandledRejection, you may have forgotten to catch a Promise rejection:\n${error.stack}\n`,
	);
	expect(write).toHaveBeenCalledWith(
		'You have triggered an unhandledRejection, you may have forgotten to catch a Promise rejection:\nplain reason\n',
	);

	process.off('unhandledRejection', listener);
});
