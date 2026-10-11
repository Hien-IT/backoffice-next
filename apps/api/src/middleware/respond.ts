// Ported from directus/api/src/middleware/respond.ts (header part only). Feature 005 adds the export of files (T027)
// and the response cache (T036); `req` is taken now so every caller already passes it.
import type { Request, Response } from 'express';

export async function respond(_req: Request, res: Response): Promise<void> {
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
