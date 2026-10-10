import { useEnv } from '@backoffice/env';
import type { RequestHandler } from 'express';
import { escapeRegExp } from 'lodash-es';
import { getAuthProviders } from '../utils/get-auth-providers.js';

/**
 * Directus mounts /server/* and /metrics on Express 4 sub-Routers, which answer OPTIONS themselves with
 * `Allow: GET,HEAD` (Router#handle → sendOptionsResponse). Nest mounts routes on the app, where OPTIONS would 404,
 * so this middleware reproduces the Router answer for exactly those paths (research R4, FR-048). /server/setup and
 * /server/specs/graphql are not built yet (D-14, D-15); /server/ping, / and /robots.txt are app routes (404).
 * Feature 003 adds the routes of the auth router with the methods its Express 4 router answers.
 */
export function createRouterOptions(): RequestHandler {
	const env = useEnv();

	const routes: [RegExp, string][] = [
		[/^\/server\/info\/?$/i, 'GET,HEAD'],
		[/^\/server\/health\/?$/i, 'GET,HEAD'],
		...(env['OPENAPI_ENABLED'] !== false ? [[/^\/server\/specs\/oas\/?$/i, 'GET,HEAD'] as [RegExp, string]] : []),
		...(env['METRICS_ENABLED'] === true ? [[/^\/metrics\/?$/i, 'GET,HEAD'] as [RegExp, string]] : []),
		// Feature 003: the auth router (research R3 of spec 003, FR-034).
		[/^\/auth\/(refresh|logout)\/?$/i, 'POST'],
		...(env['AUTH_DISABLE_DEFAULT'] ? [] : [[/^\/auth\/login\/?$/i, 'POST'] as [RegExp, string]]),
		...getAuthProviders()
			.filter((provider) => provider.driver === 'local')
			.map((provider): [RegExp, string] => [new RegExp(`^/auth/login/${escapeRegExp(provider.name)}/?$`, 'i'), 'POST']),
	];

	return (req, res, next) => {
		const route = req.method === 'OPTIONS' ? routes.find(([path]) => path.test(req.path)) : undefined;
		if (!route) return next();

		const body = route[1];
		res.set('Allow', body);
		res.send(body);
	};
}
