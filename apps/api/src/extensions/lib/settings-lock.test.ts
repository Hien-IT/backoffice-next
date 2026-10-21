// Backoffice (spec 020, R-58): two instances creating the rows of new extensions take turns; a stale lock is cleared
// after the timeout.
import { beforeEach, expect, test, vi } from 'vitest';
import { useLock } from '../../lock/index.js';
import { SETTINGS_LOCK_KEY, withSettingsLock } from './settings-lock.js';

vi.mock('../../logger/index.js', () => ({ useLogger: () => ({ warn: vi.fn() }) }));

const counters = new Map<string, number>();

vi.mock('../../lock/index.js', () => {
	const lock = {
		increment: vi.fn(async (key: string, by = 1) => {
			counters.set(key, (counters.get(key) ?? 0) + by);
			return counters.get(key)!;
		}),
		delete: vi.fn(async (key: string) => void counters.delete(key)),
	};

	return { useLock: () => lock };
});

beforeEach(() => {
	counters.clear();
	vi.clearAllMocks();
});

test('two concurrent calls run one after the other and release the lock', async () => {
	const events: string[] = [];

	const run = (name: string) =>
		withSettingsLock(async () => {
			events.push(`${name}:start`);
			await new Promise((resolve) => setTimeout(resolve, 20));
			events.push(`${name}:end`);
			return name;
		});

	await expect(Promise.all([run('a'), run('b')])).resolves.toEqual(['a', 'b']);
	expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
	expect(counters.has(SETTINGS_LOCK_KEY)).toBe(false);
});

test('a stale lock is cleared after the timeout and the call runs anyway', async () => {
	counters.set(SETTINGS_LOCK_KEY, 1);

	await expect(withSettingsLock(async () => 'done', 300)).resolves.toBe('done');
	expect(useLock().delete).toHaveBeenCalledWith(SETTINGS_LOCK_KEY);
});

test('the lock is released when the call throws', async () => {
	await expect(withSettingsLock(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
	expect(counters.has(SETTINGS_LOCK_KEY)).toBe(false);
});
