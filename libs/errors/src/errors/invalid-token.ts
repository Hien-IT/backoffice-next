// Ported from directus/packages/errors/src/errors/invalid-token.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export const InvalidTokenError: BackofficeErrorConstructor<void> = createError(
	ErrorCode.InvalidToken,
	'Invalid token.',
	403,
);
