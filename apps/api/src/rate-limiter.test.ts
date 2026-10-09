import { useEnv } from '@backoffice/env';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import { beforeEach, expect, test, vi } from 'vitest';
import { createRateLimiter } from './rate-limiter.js';
import { runShutdownTasks } from './shutdown.js';

vi.mock('@backoffice/env');

// rate-limiter.ts loads ioredis with require() (like Directus), so a real client is created: lazy, never used.

beforeEach(() => vi.clearAllMocks());

test('memory store from RATE_LIMITER_* (enabled/store removed, store-specific keys omitted)', () => {
	vi.mocked(useEnv).mockReturnValue({
		RATE_LIMITER_STORE: 'memory',
		RATE_LIMITER_ENABLED: true,
		RATE_LIMITER_POINTS: 5,
		RATE_LIMITER_DURATION: 1,
	});
	const limiter = createRateLimiter();
	expect(limiter).toBeInstanceOf(RateLimiterMemory);
	expect(limiter.points).toBe(5);
	expect(limiter.duration).toBe(1);
});

test('redis store: Redis client from REDIS, same keyPrefix as Directus, closed on shutdown', async () => {
	vi.mocked(useEnv).mockReturnValue({
		RATE_LIMITER_STORE: 'redis',
		REDIS: 'redis://r:6379',
		RATE_LIMITER_GLOBAL_POINTS: 100,
		RATE_LIMITER_GLOBAL_DURATION: 1,
	});
	const limiter = createRateLimiter('RATE_LIMITER_GLOBAL', { keyPrefix: 'rlflx' });
	expect(limiter).toBeInstanceOf(RateLimiterRedis);
	expect(limiter.keyPrefix).toBe('rlflx');
	const client = (limiter as any).client;
	expect(client.options).toMatchObject({ host: 'r', port: 6379 });
	client.on('error', () => undefined);
	await runShutdownTasks();
	await vi.waitFor(() => expect(client.status).toBe('end'));
});

test('default keyPrefix is rate-limiter-flexible default (rlflx), shared with Directus', () => {
	vi.mocked(useEnv).mockReturnValue({ RATE_LIMITER_STORE: 'memory', RATE_LIMITER_POINTS: 1, RATE_LIMITER_DURATION: 1 });
	expect(createRateLimiter().keyPrefix).toBe('rlflx');
});
