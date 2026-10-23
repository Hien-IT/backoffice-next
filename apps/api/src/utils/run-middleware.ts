// Backoffice: runs an Express middleware of DR (validateBatch, useCollection...) inside a Nest handler, so the
// ported middleware keeps its code and tests (research R3 of spec 004). Resolves when the middleware calls next(),
// rejects with the error it passes to next(err).
import type { Request, RequestHandler, Response } from 'express';

export function runMiddleware(handler: RequestHandler, req: Request, res: Response): Promise<void> {
	return new Promise((resolve, reject) => {
		try {
			const result: unknown = handler(req, res, (error?: unknown) => (error ? reject(error) : resolve()));
			if (result instanceof Promise) result.catch(reject);
		} catch (error) {
			reject(error);
		}
	});
}
