// Ported from directus/packages/errors/src/errors/invalid-path-parameter.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export interface InvalidPathParameterErrorExtensions {
	reason: string;
}

export const messageConstructor = ({ reason }: InvalidPathParameterErrorExtensions) =>
	`Invalid path parameter. ${reason}.`;

export const InvalidPathParameterError: BackofficeErrorConstructor<InvalidPathParameterErrorExtensions> =
	createError<InvalidPathParameterErrorExtensions>(ErrorCode.InvalidPathParameter, messageConstructor, 400);
