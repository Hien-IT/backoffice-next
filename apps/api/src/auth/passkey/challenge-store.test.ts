// Backoffice (spec 029, FR-025, research R4): one-use, five-minute challenges shared by the replicas.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { redisConfigAvailable, useRedis } from '../../redis/index.js';
import { _local, CHALLENGE_TTL, MAX_LOCAL, putChallenge, takeChallenge } from './challenge-store.js';

vi.mock('../../redis/index.js');

beforeEach(() => {
	_local.clear();
	vi.mocked(redisConfigAvailable).mockReturnValue(false);
});

afterEach(() => {
	vi.clearAllMocks();
	vi.useRealTimers();
});

test('local: a challenge is taken once and keeps purpose and user', async () => {
	await putChallenge('c1', { purpose: 'register', user: 'u1' });

	expect(await takeChallenge('c1')).toMatchObject({ purpose: 'register', user: 'u1' });
	expect(await takeChallenge('c1')).toBeUndefined();
	expect(await takeChallenge('unknown')).toBeUndefined();
});

test('local: two takes at once give the challenge to one of them only', async () => {
	await putChallenge('c2', { purpose: 'login' });

	const results = await Promise.all([takeChallenge('c2'), takeChallenge('c2')]);

	expect(results.filter(Boolean)).toHaveLength(1);
});

test('local: a challenge older than five minutes is expired', async () => {
	vi.useFakeTimers();
	await putChallenge('c3', { purpose: 'login' });

	vi.advanceTimersByTime(CHALLENGE_TTL + 1);

	expect(await takeChallenge('c3')).toBeUndefined();
});

test('local: at most MAX_LOCAL keys, the oldest goes first', async () => {
	for (let i = 0; i <= MAX_LOCAL; i++) await putChallenge(`k${i}`, { purpose: 'login' });

	expect(_local.size).toBe(MAX_LOCAL);
	expect(await takeChallenge('k0')).toBeUndefined();
	expect(await takeChallenge(`k${MAX_LOCAL}`)).toBeDefined();
});

test('redis: SET with a TTL in ms under backoffice:passkey:, taken with GETDEL', async () => {
	const store = new Map<string, string>();

	const redis = {
		set: vi.fn(async (key: string, value: string) => void store.set(key, value)),
		getdel: vi.fn(async (key: string) => {
			const value = store.get(key) ?? null;
			store.delete(key);
			return value;
		}),
	};

	vi.mocked(redisConfigAvailable).mockReturnValue(true);
	vi.mocked(useRedis).mockReturnValue(redis as any);

	await putChallenge('c4', { purpose: 'login' });

	expect(redis.set).toHaveBeenCalledWith('backoffice:passkey:c4', expect.any(String), 'PX', CHALLENGE_TTL);
	expect(await takeChallenge('c4')).toMatchObject({ purpose: 'login' });
	expect(redis.getdel).toHaveBeenCalledWith('backoffice:passkey:c4');
	expect(await takeChallenge('c4')).toBeUndefined();
});

test('redis: an unreachable store is a 503, never a pass', async () => {
	vi.mocked(redisConfigAvailable).mockReturnValue(true);

	vi.mocked(useRedis).mockReturnValue({
		set: vi.fn().mockRejectedValue(new Error('down')),
		getdel: vi.fn().mockRejectedValue(new Error('down')),
	} as any);

	await expect(putChallenge('c5', { purpose: 'login' })).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
	await expect(takeChallenge('c5')).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
});
