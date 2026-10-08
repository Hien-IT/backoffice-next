// Ported from directus/packages/errors/src/errors/invalid-otp.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export const InvalidOtpError: BackofficeErrorConstructor<void> = createError(
	ErrorCode.InvalidOtp,
	'Invalid user OTP.',
	401,
);
