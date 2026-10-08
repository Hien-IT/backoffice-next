// Ported from directus/packages/errors/src/errors/route-not-found.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export interface RouteNotFoundErrorExtensions {
	path: string;
}

export const messageConstructor = ({ path }: RouteNotFoundErrorExtensions) => `Route ${path} doesn't exist.`;

export const RouteNotFoundError: BackofficeErrorConstructor<RouteNotFoundErrorExtensions> = createError(
	ErrorCode.RouteNotFound,
	messageConstructor,
	404,
);
