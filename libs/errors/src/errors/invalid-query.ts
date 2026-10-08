// Ported from directus/packages/errors/src/errors/invalid-query.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export interface InvalidQueryErrorExtensions {
	reason: string;
}

export const messageConstructor = ({ reason }: InvalidQueryErrorExtensions) => `Invalid query. ${reason}.`;

export const InvalidQueryError: BackofficeErrorConstructor<InvalidQueryErrorExtensions> =
	createError<InvalidQueryErrorExtensions>(ErrorCode.InvalidQuery, messageConstructor, 400);
