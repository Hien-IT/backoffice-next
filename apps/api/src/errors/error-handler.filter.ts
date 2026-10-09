// Ported from directus/api/src/controllers/not-found.ts (404 mapping); the response itself is written by the
// ported Express error handler, so Nest routes, Nest's 404 and Express middleware errors share one format.
import { type ArgumentsHost, Catch, type ExceptionFilter, NotFoundException } from '@nestjs/common';
import { RouteNotFoundError } from '@backoffice/errors';
import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from './error-handler.js';

@Catch()
export class ErrorHandlerFilter implements ExceptionFilter {
	catch(exception: unknown, host: ArgumentsHost): Promise<unknown> {
		const http = host.switchToHttp();
		const req = http.getRequest<Request>();
		const res = http.getResponse<Response>();
		const next = http.getNext<NextFunction>();

		// Nest throws NotFoundException when no route matches; the `request.not_found` hook comes with feature 009.
		const error = exception instanceof NotFoundException ? new RouteNotFoundError({ path: req.path }) : exception;

		return errorHandler(error, req, res, next);
	}
}
