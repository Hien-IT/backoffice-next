// Backoffice: directus/api/src/synchronization.ts has no unit test; this one covers both stores (feature 007, T015).
import { useEnv } from '@backoffice/env';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@backoffice/env');

const redis = vi.hoisted(() => ({
	store: new Map<string, string>(),
	options: [] as unknown[],
	defineCommand: vi.fn(),
}));

vi.mock('ioredis', () => ({
	Redis: vi.fn().mockImplementation((options: unknown) => {
		redis.options.push(options);

		return {
			defineCommand: redis.defineCommand,
			set: vi.fn(async (key: string, value: string | number) => {
				redis.store.set(key, String(value));
			}),
			get: vi.fn(async (key: string) => redis.store.get(key) ?? null),
			del: vi.fn(async (key: string) => {
				redis.store.delete(key);
			}),
			exists: vi.fn(async (key: string) => (redis.store.has(key) ? 1 : 0)),
			// Same semantics as SET_GREATER_THAN_SCRIPT.
			setGreaterThan: vi.fn(async (key: string, value: number) => {
				if (redis.store.has(key) && value <= Number(redis.store.get(key))) return 0;
				redis.store.set(key, String(value));
				return 1;
			}),
		};
	}),
}));

beforeEach(() => {
	vi.resetModules();
	redis.store.clear();
	redis.options.length = 0;
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('SynchronizedClock', () => {
	test('memory store: only a later timestamp wins, reset clears the clock', async () => {
		vi.mocked(useEnv).mockReturnValue({ SYNCHRONIZATION_STORE: 'memory' });
		const { SynchronizedClock } = await import('./synchronization.js');

		const clock = new SynchronizedClock('tus-cleanup:0 * * * *');
		const other = new SynchronizedClock('tus-cleanup:0 * * * *');

		expect(await clock.set(1000)).toBe(true);
		expect(await other.set(1000)).toBe(false);
		expect(await other.set(999)).toBe(false);
		expect(await other.set(2000)).toBe(true);

		await clock.reset();
		expect(await other.set(1)).toBe(true);
		expect(redis.options).toEqual([]);
	});

	test('redis store: namespaced clock key and the setGreaterThan script, like Directus', async () => {
		vi.mocked(useEnv).mockReturnValue({ SYNCHRONIZATION_STORE: 'redis', REDIS: 'redis://localhost:6379' });
		const { SynchronizedClock } = await import('./synchronization.js');

		const clock = new SynchronizedClock('tus-cleanup:* * * * *');

		expect(await clock.set(1000)).toBe(true);
		expect(await clock.set(1000)).toBe(false);
		expect([...redis.store.keys()]).toEqual(['directus-sync:clock:tus-cleanup:* * * * *']);
		expect(redis.options).toEqual(['redis://localhost:6379']);
		expect(redis.defineCommand).toHaveBeenCalledWith('setGreaterThan', expect.objectContaining({ numberOfKeys: 1 }));

		await clock.reset();
		expect(redis.store.size).toBe(0);
	});

	test('redis store honours SYNCHRONIZATION_NAMESPACE', async () => {
		vi.mocked(useEnv).mockReturnValue({
			SYNCHRONIZATION_STORE: 'redis',
			SYNCHRONIZATION_NAMESPACE: 'parity-sync',
			REDIS: 'redis://localhost:6379',
		});

		const { SynchronizedClock } = await import('./synchronization.js');
		await new SynchronizedClock('job').set(5);

		expect([...redis.store.keys()]).toEqual(['parity-sync:clock:job']);
	});
});
