import { useEnv } from '@backoffice/env';
import { useLogger } from '../logger/index.js';
import { redisConfigAvailable } from '../redis/index.js';

export const SINGLE_INSTANCE_SUFFIX = ': this configuration is only safe when running a single instance.';

/** FR-023 reasons, in the order of contracts/startup.md row 5. */
export function getSingleInstanceReasons(): string[] {
	const env = useEnv();
	const reasons: string[] = [];

	if (!redisConfigAvailable()) reasons.push('No Redis configured');

	// DR always builds its system and lock caches on CACHE_STORE, whatever CACHE_ENABLED says.
	if (env['CACHE_STORE'] === 'memory') reasons.push('CACHE_STORE is "memory"');

	// The failed-login counter always runs on RATE_LIMITER_STORE (FR-041 of spec 003), whatever the limiters say.
	if (env['RATE_LIMITER_STORE'] === 'memory') reasons.push('RATE_LIMITER_STORE is "memory"');

	return reasons;
}

export function warnSingleInstance(): void {
	const reasons = getSingleInstanceReasons();
	if (reasons.length > 0) useLogger().warn(reasons.join('; ') + SINGLE_INSTANCE_SUFFIX);
}
