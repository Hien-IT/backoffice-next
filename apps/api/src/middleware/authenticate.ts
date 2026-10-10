// Ported from directus/api/src/middleware/authenticate.ts
import { useEnv } from '@backoffice/env';
import { ErrorCode, isBackofficeError } from '@backoffice/errors';
import type { Accountability } from '@backoffice/types';
import type { NextFunction, Request, Response } from 'express';
import { sessionCookieOptions } from '../constants.js';
import { createDefaultAccountability } from '../permissions/utils/create-default-accountability.js';
import asyncHandler from '../utils/async-handler.js';
import { clearCookie } from '../utils/clear-cookie.js';
import { getAccountabilityForToken } from '../utils/get-accountability-for-token.js';
import { getIPFromReq } from '../utils/get-ip-from-req.js';

/**
 * Verify the passed JWT and assign the user ID and role to `req`
 */
export const handler = async (req: Request, res: Response, next: NextFunction) => {
	const env = useEnv();

	const defaultAccountability: Accountability = createDefaultAccountability({ ip: getIPFromReq(req) });

	const userAgent = req.get('user-agent')?.substring(0, 1024);
	if (userAgent) defaultAccountability.userAgent = userAgent;

	const origin = req.get('origin');
	if (origin) defaultAccountability.origin = origin;

	// Backoffice: the `authenticate` filter event for extensions is not emitted (D-26 of spec 003).

	try {
		req.accountability = await getAccountabilityForToken(req.token, defaultAccountability);
	} catch (err) {
		if (isBackofficeError(err, ErrorCode.InvalidCredentials) || isBackofficeError(err, ErrorCode.InvalidToken)) {
			if (req.cookies[env['SESSION_COOKIE_NAME'] as string] === req.token) {
				// clear the session token if ended up in an invalid state
				clearCookie(res, env['SESSION_COOKIE_NAME'] as string, sessionCookieOptions());
			}
		}

		throw err;
	}

	return next();
};

export default asyncHandler(handler);
