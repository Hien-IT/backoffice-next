// Backoffice (feature 011, T011): the schema cache is an LRU of GRAPHQL_SCHEMA_CACHE_CAPACITY entries (100 by default)
// that the shared bus message `schemaChanged` empties on every instance (spec FR-044).
import { useEnv } from '@backoffice/env';
import { beforeEach, expect, test, vi } from 'vitest';
import { useBus } from '../../bus/index.js';

vi.mock('@backoffice/env', () => ({ useEnv: vi.fn(() => ({ GRAPHQL_SCHEMA_CACHE_CAPACITY: 2 })) }));

const subscribers: Record<string, (payload: unknown) => void> = {};

vi.mock('../../bus/index.js', () => ({
	useBus: vi.fn(() => ({
		subscribe: vi.fn((channel: string, handler: (payload: unknown) => void) => (subscribers[channel] = handler)),
	})),
}));

beforeEach(() => {
	vi.mocked(useEnv).mockReturnValue({ GRAPHQL_SCHEMA_CACHE_CAPACITY: 2 });
});

test('keeps at most GRAPHQL_SCHEMA_CACHE_CAPACITY entries, least recently used out first', async () => {
	const { cache } = await import('./schema-cache.js');

	cache.set('a', 'A');
	cache.set('b', 'B');
	cache.get('a');
	cache.set('c', 'C');

	expect(cache.get('a')).toBe('A');
	expect(cache.get('b')).toBeUndefined();
	expect(cache.get('c')).toBe('C');
});

test('subscribes to schemaChanged on the bus at load and clears every entry on it', async () => {
	const { cache } = await import('./schema-cache.js');

	expect(useBus).toHaveBeenCalled();
	expect(subscribers['schemaChanged']).toBeTypeOf('function');

	cache.set('items_schema_role_user', 'S');
	subscribers['schemaChanged']!({});

	expect(cache.size).toBe(0);
});
