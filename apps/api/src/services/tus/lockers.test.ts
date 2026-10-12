// Backoffice: directus/api/src/services/tus/lockers.ts has no unit test (feature 007, T016).
import { ERRORS } from '@tus/utils';
import { beforeEach, expect, test, vi } from 'vitest';
import { useLock } from '../../lock/index.js';
import { getTusLocker, KvLock, TusLocker } from './lockers.js';

vi.mock('../../lock/index.js', () => ({ useLock: vi.fn() }));

const store = new Map<string, unknown>();

beforeEach(() => {
	store.clear();

	vi.mocked(useLock).mockReturnValue({
		get: vi.fn(async (key: string) => store.get(key)),
		set: vi.fn(async (key: string, value: unknown) => {
			store.set(key, value);
		}),
		delete: vi.fn(async (key: string) => {
			store.delete(key);
		}),
	} as any);
});

test('the locker is a singleton with the Directus timeouts (30 s acquire, 60 s lock)', () => {
	const locker = getTusLocker() as TusLocker;

	expect(getTusLocker()).toBe(locker);
	expect(locker.acquireTimeout).toBe(30_000);
	expect(locker.lockTimeout).toBe(60_000);
});

test('locks a free upload id in the shared kv and unlocks it', async () => {
	const lock = new KvLock('upload-1');

	await lock.lock(new AbortController().signal, vi.fn());
	expect(store.has('upload-1')).toBe(true);

	await lock.unlock();
	expect(store.has('upload-1')).toBe(false);
});

test('asks the holder to release, then times out like Directus when the lock stays taken', async () => {
	store.set('upload-2', Date.now());
	const cancelReq = vi.fn();

	await expect(new KvLock('upload-2', 60_000, 50).lock(new AbortController().signal, cancelReq)).rejects.toBe(
		ERRORS.ERR_LOCK_TIMEOUT,
	);

	expect(cancelReq).toHaveBeenCalled();
});

test('takes over a lock older than the lock timeout', async () => {
	store.set('upload-3', Date.now() - 120_000);

	await new KvLock('upload-3', 60_000, 1_000).lock(new AbortController().signal, vi.fn());
	expect(Number(store.get('upload-3'))).toBeGreaterThan(Date.now() - 1_000);
});
