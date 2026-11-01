// Backoffice (spec 029, D-207.5): GET /policies/me/globals and GraphQL policies_me_globals answer enforce_tfa false for a
// session a passkey created, but the shared response cache keys by user, not by session. For such a session the cache
// is neither read (a password session of the same user, or DR, may have stored true) nor written (a password session
// would read false). Other requests, password sessions included, keep the DR caching.
import url from 'url';
import type { RequestHandler } from 'express';
import getDatabase from '../database/index.js';
import asyncHandler from '../utils/async-handler.js';
import { getGraphqlQueryAndVariables } from '../utils/get-graphql-query-and-variables.js';

function asksGlobals(req: Parameters<RequestHandler>[0]): boolean {
	const path = url.parse(req.originalUrl).pathname ?? '';
	if (path === '/policies/me/globals') return true;
	if (path !== '/graphql/system') return false;
	const document = getGraphqlQueryAndVariables(req).query;
	return typeof document === 'string' && document.includes('policies_me_globals');
}

const passkeySessionCacheGuard: RequestHandler = asyncHandler(async (req, res, next) => {
	const session = req.accountability?.session;
	if (!session || !asksGlobals(req)) return next();

	const row = await getDatabase().select('bo_passkey').from('directus_sessions').where({ token: session }).first();

	if (row?.bo_passkey) {
		res.locals['skipCacheRead'] = true;
		res.locals['cache'] = false;
	}

	return next();
});

export default passkeySessionCacheGuard;
