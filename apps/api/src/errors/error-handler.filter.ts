// Ported from directus/api/src/controllers/not-found.ts (404 mapping and the `request.not_found` hook); the response
// itself is written by the ported Express error handler, so Nest routes, Nest's 404 and Express middleware errors share
// one format.
import { type ArgumentsHost, Catch, type ExceptionFilter, NotFoundException } from '@nestjs/common';
import { RouteNotFoundError } from '@backoffice/errors';
import type { NextFunction, Request, Response } from 'express';
import getDatabase from '../database/index.js';
import emitter from '../emitter.js';
import { errorHandler } from './error-handler.js';

@Catch()
export class ErrorHandlerFilter implements ExceptionFilter {
	async catch(exception: unknown, host: ArgumentsHost): Promise<unknown> {
		const http = host.switchToHttp();
		const req = http.getRequest<Request>();
		const res = http.getResponse<Response>();
		const next = http.getNext<NextFunction>();

		// Nest throws NotFoundException when no route matches: the not-found handler of Directus.
		if (!(exception instanceof NotFoundException)) return errorHandler(exception, req, res, next);

		try {
			const hooksResult = await emitter.emitFilter(
				'request.not_found',
				false,
				{ request: req, response: res },
				{
					database: getDatabase(),
					schema: req.schema,
					accountability: req.accountability ?? null,
				},
			);

			// A hook that returns true has handled the response itself.
			if (hooksResult) return next();

			return errorHandler(new RouteNotFoundError({ path: req.path }), req, res, next);
		} catch (err: any) {
			return errorHandler(err, req, res, next);
		}
	}
}
