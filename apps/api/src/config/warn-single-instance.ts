import { useEnv } from '@backoffice/env';
import { useLogger } from '../logger/index.js';
import { redisConfigAvailable } from '../redis/index.js';

export const SINGLE_INSTANCE_SUFFIX = ': this configuration is only safe when running a single instance.';

/** FR-023 reasons, in the order of contracts/startup.md row 5. */
export function getSingleInstanceReasons(): string[] {
	const env = useEnv();
	const reasons: string[] = [];

	if (!redisConfigAvailable()) reasons.push('No Redis configured');

	// Directus always builds its system and lock caches on CACHE_STORE, whatever CACHE_ENABLED says.
	if (env['CACHE_STORE'] === 'memory') reasons.push('CACHE_STORE is "memory"');

	if (
		env['RATE_LIMITER_STORE'] === 'memory' &&
		(env['RATE_LIMITER_ENABLED'] === true || env['RATE_LIMITER_GLOBAL_ENABLED'] === true)
	) {
		reasons.push('RATE_LIMITER_STORE is "memory"');
	}

	return reasons;
}

export function warnSingleInstance(): void {
	const reasons = getSingleInstanceReasons();
	if (reasons.length > 0) useLogger().warn(reasons.join('; ') + SINGLE_INSTANCE_SUFFIX);
}
