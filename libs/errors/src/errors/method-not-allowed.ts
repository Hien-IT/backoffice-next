// Ported from directus/packages/errors/src/errors/method-not-allowed.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export interface MethodNotAllowedErrorExtensions {
	allowed: string[];
	current: string;
}

export const messageConstructor = (extensions: MethodNotAllowedErrorExtensions) =>
	`Invalid method "${extensions.current}" used. Should be one of ${extensions.allowed
		.map((method) => `"${method}"`)
		.join(', ')}.`;

export const MethodNotAllowedError: BackofficeErrorConstructor<MethodNotAllowedErrorExtensions> =
	createError<MethodNotAllowedErrorExtensions>(ErrorCode.MethodNotAllowed, messageConstructor, 405);
