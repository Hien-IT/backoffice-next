// Ported from directus/api/src/permissions/utils/with-cache.ts
import { getSimpleHash } from '@backoffice/utils';
import { useCache } from '../cache.js';

/**
 * Wraps a function with caching capabilities.
 *
 * @param namespace - A unique namespace for the cache key.
 * @param handler - The function to be wrapped.
 * @param prepareArg - Optional function to prepare arguments for hashing.
 * @returns A new function that caches the results of the original function.
 *
 * @NOTE Ensure that the `namespace` is unique to avoid cache key collisions.
 * @NOTE Ensure that the `prepareArg` function returns a JSON stringifiable representation of the arguments.
 */
export function withCache<F extends (...args: any) => any>(
	namespace: string,
	handler: F,
	prepareArg?: (...args: Parameters<F>) => Record<string, unknown>,
): (...args: Parameters<F>) => Promise<Awaited<ReturnType<F>>> {
	return async (...args) => {
		// Backoffice: resolve the cache on call, not when the module loads (env is read lazily, as in feature 001)
		const cache = useCache();
		const hashArgs = prepareArg ? prepareArg(...args) : args;
		const key = namespace + '-' + getSimpleHash(JSON.stringify(hashArgs));
		const cached = await cache.get(key);

		if (cached !== undefined) {
			return cached as Awaited<ReturnType<F>>;
		}

		const res = await handler(...args);

		cache.set(key, res);

		return res;
	};
}
