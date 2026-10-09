import { useEnv } from '@backoffice/env';
import { beforeEach, expect, test, vi } from 'vitest';
import { useLogger } from '../logger/index.js';
import { SINGLE_INSTANCE_SUFFIX, getSingleInstanceReasons, warnSingleInstance } from './warn-single-instance.js';

vi.mock('@backoffice/env');
vi.mock('../logger/index.js');

const logger = { warn: vi.fn() };

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(useLogger).mockReturnValue(logger as any);
});

const env = (values: Record<string, unknown>) => vi.mocked(useEnv).mockReturnValue(values);

test('no Redis and memory stores (defaults) → all reasons in one line', () => {
	env({ CACHE_STORE: 'memory', RATE_LIMITER_STORE: 'memory', RATE_LIMITER_ENABLED: true });
	warnSingleInstance();
	expect(logger.warn).toHaveBeenCalledWith(
		`No Redis configured; CACHE_STORE is "memory"; RATE_LIMITER_STORE is "memory"${SINGLE_INSTANCE_SUFFIX}`,
	);
});

test('CACHE_STORE=memory warns even when CACHE_ENABLED=false', () => {
	env({
		REDIS: 'redis://r',
		CACHE_ENABLED: false,
		CACHE_STORE: 'memory',
		RATE_LIMITER_STORE: 'memory',
		RATE_LIMITER_ENABLED: false,
	});
	expect(getSingleInstanceReasons()).toEqual(['CACHE_STORE is "memory"']);
});

test('RATE_LIMITER_STORE=memory counts only when a rate limiter is on', () => {
	env({ REDIS: 'redis://r', CACHE_STORE: 'redis', RATE_LIMITER_STORE: 'memory', RATE_LIMITER_GLOBAL_ENABLED: true });
	expect(getSingleInstanceReasons()).toEqual(['RATE_LIMITER_STORE is "memory"']);
});

test('Redis for everything → no warning', () => {
	env({ REDIS_HOST: 'r', CACHE_STORE: 'redis', RATE_LIMITER_STORE: 'redis', RATE_LIMITER_ENABLED: true });
	warnSingleInstance();
	expect(logger.warn).not.toHaveBeenCalled();
});
