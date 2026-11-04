// Backoffice (spec 031, D-212.2): while this node has loaded a package of source `upload`, its row has a schema here and
// `schema: null` at DR, but the response cache shared with DR keys GET /extensions the same way at both apps. Those
// reads (the list, one row, GraphQL system documents asking for `extensions`) then neither read nor write the shared
// cache. Without an uploaded package every request keeps the DR caching.
import url from 'url';
import type { RequestHandler } from 'express';
import { getExtensionManager } from '../extensions/index.js';
import { getGraphqlQueryAndVariables } from '../utils/get-graphql-query-and-variables.js';

function readsExtensions(req: Parameters<RequestHandler>[0]): boolean {
	const path = url.parse(req.originalUrl).pathname ?? '';
	if (req.method === 'GET' && (path === '/extensions' || /^\/extensions\/[0-9a-f-]{36}$/i.test(path))) return true;
	if (path !== '/graphql/system') return false;
	const document = getGraphqlQueryAndVariables(req).query;
	return typeof document === 'string' && document.includes('extensions');
}

const uploadedExtensionsCacheGuard: RequestHandler = (req, res, next) => {
	if (readsExtensions(req) && getExtensionManager().hasUploadedExtensions()) {
		res.locals['skipCacheRead'] = true;
		res.locals['cache'] = false;
	}

	next();
};

export default uploadedExtensionsCacheGuard;
