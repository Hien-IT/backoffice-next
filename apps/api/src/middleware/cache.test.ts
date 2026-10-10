import { expect, test, vi } from 'vitest';
import { getCache } from '../cache.js';
import checkCacheMiddleware from './cache.js';

vi.mock('../cache.js');

test('creates the caches with getCache() and continues', () => {
	const next = vi.fn();
	checkCacheMiddleware({} as any, {} as any, next);
	expect(getCache).toHaveBeenCalledOnce();
	expect(next).toHaveBeenCalledWith();
});
