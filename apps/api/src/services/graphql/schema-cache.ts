// Ported from directus/api/src/services/graphql/schema-cache.ts
import { useEnv } from '@backoffice/env';
import { GraphQLSchema } from 'graphql';
import { LRUCache } from 'lru-cache';
import { useBus } from '../../bus/index.js';

const env = useEnv();
const bus = useBus();

// Backoffice: lru-cache (already a dependency) instead of mnemonist's LRUMap; same semantics, `max` entries, least
// recently used evicted first (spec, "Lệch có chủ đích").
export const cache = new LRUCache<string, GraphQLSchema | string>({
	max: Number(env['GRAPHQL_SCHEMA_CACHE_CAPACITY'] ?? 100),
});

bus.subscribe('schemaChanged', () => {
	cache.clear();
});
