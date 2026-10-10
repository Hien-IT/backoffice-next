// Ported from directus/packages/memory/src/bus/lib/create.test.ts
import { expect, test, vi } from 'vitest';
import type { BusConfigLocal, BusConfigRedis } from '../index.js';
import { createBus } from './create.js';
import { BusLocal } from './local.js';
import { BusRedis } from './redis.js';

vi.mock('./local.js');
vi.mock('./redis.js');

test('Creates local cache for type local', () => {
	// Backoffice: typed per overload so the test file typechecks under the workspace's strict flags
	const config = { type: 'local' } as unknown as BusConfigLocal;

	const cache = createBus(config);
	expect(BusLocal).toHaveBeenCalledWith(config);
	expect(cache).toBeInstanceOf(BusLocal);
});

test('Creates redis cache for type redis', () => {
	const config = { type: 'redis' } as unknown as BusConfigRedis;

	const cache = createBus(config);
	expect(BusRedis).toHaveBeenCalledWith(config);
	expect(cache).toBeInstanceOf(BusRedis);
});

test('Throws an error for unknown types', () => {
	// Backoffice: typed per overload so the test file typechecks under the workspace's strict flags
	const config = { type: 'WRONG' } as unknown as BusConfigLocal;

	expect(() => createBus(config)).toThrowError();
});
