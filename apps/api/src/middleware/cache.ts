// Ported from directus/api/src/middleware/cache.ts (only its first step: getCache() runs on every request after the
// schema step, which creates the system, deployment, schema and lock caches when Directus does, D-20). Serving
// responses from the cache comes with feature 005 (D-11).
import type { RequestHandler } from 'express';
import { getCache } from '../cache.js';

const checkCacheMiddleware: RequestHandler = (_req, _res, next) => {
	getCache();
	return next();
};

export default checkCacheMiddleware;
