// Ported from directus/packages/errors/src/errors/internal.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export const InternalServerError: BackofficeErrorConstructor<void> = createError(
	ErrorCode.Internal,
	`An unexpected error occurred.`,
);
