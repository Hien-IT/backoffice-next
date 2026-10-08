// Ported from directus/packages/errors/src/errors/user-suspended.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export const UserSuspendedError: BackofficeErrorConstructor<void> = createError(
	ErrorCode.UserSuspended,
	'User suspended.',
	401,
);
