// Redis of the benchmark environment, shared by permissions.ts and items.ts.
import { Redis } from 'ioredis';

export const redis = new Redis(process.env['BENCH_REDIS_URL'] ?? 'redis://127.0.0.1:6108');

/**
 * Empties the permissions cache of Redis and of the memory of every process (CacheMulti `clear` message). A process
 * keeps an entry in memory only when it computed it; one that finds it in Redis reads Redis again on every lookup
 * (@directus/memory, same in both apps). Flushing before each round lets the measured app compute its own entries.
 */
export async function flushPermissions(): Promise<void> {
	await redis.publish('permissions:multi-cache', JSON.stringify({ type: 'clear', origin: 'benchmark' }));

	for await (const keys of redis.scanStream({ match: 'permissions:*', count: 500 })) {
		if ((keys as string[]).length > 0) await redis.unlink(...(keys as string[]));
	}
}
