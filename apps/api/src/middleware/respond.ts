// Ported from directus/api/src/middleware/respond.ts (header part only). Response caching (CACHE_ENABLED,
// CACHE_AUTO_PURGE, CACHE_STATUS_HEADER) and exports (?export=) come with feature 005 (D-11, D-12).
import type { Response } from 'express';

export function respond(res: Response): void {
	// Don't cache anything by default
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Vary', 'Origin, Cache-Control');

	if (Buffer.isBuffer(res.locals['payload'])) {
		res.end(res.locals['payload']);
	} else if (res.locals['payload']) {
		res.json(res.locals['payload']);
	} else {
		res.status(204).end();
	}
}
