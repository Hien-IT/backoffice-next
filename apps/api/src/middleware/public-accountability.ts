// Ported from directus/api/src/middleware/authenticate.ts (lines 20-26: the default accountability only).
// Feature 003 mounts the real `authenticate` on its own routes (D-10 of spec 003); every other route stays public
// (FR-044) until feature 004 replaces this middleware.
import type { RequestHandler } from 'express';
import { useLogger } from '../logger/index.js';
import { createDefaultAccountability } from '../permissions/utils/create-default-accountability.js';
import { getIPFromReq } from '../utils/get-ip-from-req.js';

export const CREDENTIALS_IGNORED_MESSAGE =
	'Request carried credentials, but authentication is not available in this version; treating the request as public.';

let warned = false;

/** Test helper: forget that the once-per-process warning was logged. */
export function resetCredentialsWarning(): void {
	warned = false;
}

const publicAccountability: RequestHandler = (req, _res, next) => {
	const defaultAccountability = createDefaultAccountability({ ip: getIPFromReq(req) });

	const userAgent = req.get('user-agent')?.substring(0, 1024);
	if (userAgent) defaultAccountability.userAgent = userAgent;

	const origin = req.get('origin');
	if (origin) defaultAccountability.origin = origin;

	req.accountability = defaultAccountability;

	// `req.token` is set by extractToken from the Bearer header, `access_token` or the session cookie.
	if (req.token) {
		const logger = useLogger();

		if (warned) {
			logger.debug(CREDENTIALS_IGNORED_MESSAGE);
		} else {
			warned = true;
			logger.warn(CREDENTIALS_IGNORED_MESSAGE);
		}
	}

	next();
};

export default publicAccountability;
