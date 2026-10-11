// Ported from directus/api/src/middleware/rate-limiter-registration.ts
// Backoffice: the limiter is created on the first request, not at import, so the configuration is read after the
// startup checks (research R11 of spec 004, like the login attempts limiter of feature 003).
import { useEnv } from '@backoffice/env';
import { HitRateLimitError } from '@backoffice/errors';
import type { RequestHandler } from 'express';
import type { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import { createRateLimiter } from '../rate-limiter.js';
import asyncHandler from '../utils/async-handler.js';
import { getIPFromReq } from '../utils/get-ip-from-req.js';
import { validateEnv } from '../utils/validate-env.js';

export let rateLimiter: RateLimiterRedis | RateLimiterMemory | undefined;

const checkRateLimit: RequestHandler = asyncHandler(async (req, res, next) => {
	const env = useEnv();

	if (env['RATE_LIMITER_REGISTRATION_ENABLED'] !== true) return next();

	if (!rateLimiter) {
		validateEnv(['RATE_LIMITER_REGISTRATION_DURATION', 'RATE_LIMITER_REGISTRATION_POINTS']);
		rateLimiter = createRateLimiter('RATE_LIMITER_REGISTRATION');
	}

	const ip = getIPFromReq(req);

	if (ip) {
		try {
			await rateLimiter.consume(ip, 1);
		} catch (rateLimiterRes: any) {
			if (rateLimiterRes instanceof Error) throw rateLimiterRes;

			res.set('Retry-After', String(Math.round(rateLimiterRes.msBeforeNext / 1000)));
			throw new HitRateLimitError({
				limit: +(env['RATE_LIMITER_REGISTRATION_POINTS'] as string),
				reset: new Date(Date.now() + rateLimiterRes.msBeforeNext),
			});
		}
	}

	next();
});

export default checkRateLimit;
