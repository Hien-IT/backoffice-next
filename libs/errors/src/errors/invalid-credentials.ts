// Ported from directus/packages/errors/src/errors/invalid-credentials.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export const InvalidCredentialsError: BackofficeErrorConstructor<void> = createError(
	ErrorCode.InvalidCredentials,
	'Invalid user credentials.',
	401,
);
