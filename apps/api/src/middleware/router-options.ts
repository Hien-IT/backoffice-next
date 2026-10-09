import { useEnv } from '@backoffice/env';
import type { RequestHandler } from 'express';

/**
 * Directus mounts /server/* and /metrics on Express 4 sub-Routers, which answer OPTIONS themselves with
 * `Allow: GET,HEAD` (Router#handle → sendOptionsResponse). Nest mounts routes on the app, where OPTIONS would 404,
 * so this middleware reproduces the Router answer for exactly those paths (research R4, FR-048). /server/setup and
 * /server/specs/graphql are not built yet (D-14, D-15); /server/ping, / and /robots.txt are app routes (404).
 */
export function createRouterOptions(): RequestHandler {
	const env = useEnv();

	const paths = [
		/^\/server\/info\/?$/i,
		/^\/server\/health\/?$/i,
		...(env['OPENAPI_ENABLED'] !== false ? [/^\/server\/specs\/oas\/?$/i] : []),
		...(env['METRICS_ENABLED'] === true ? [/^\/metrics\/?$/i] : []),
	];

	return (req, res, next) => {
		if (req.method !== 'OPTIONS' || !paths.some((path) => path.test(req.path))) return next();

		const body = 'GET,HEAD';
		res.set('Allow', body);
		res.send(body);
	};
}
