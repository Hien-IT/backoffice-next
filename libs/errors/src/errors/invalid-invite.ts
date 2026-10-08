// Ported from directus/packages/errors/src/errors/invalid-invite.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export const InvalidInviteError: BackofficeErrorConstructor = createError(
	ErrorCode.InvalidInvite,
	() => `This invite is no longer valid.`,
	400,
);
