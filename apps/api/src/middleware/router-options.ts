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
		[/^\/auth\/(refresh|logout|password\/request|password\/reset)\/?$/i, 'POST'],
		[/^\/users\/me\/tfa\/generate\/?$/i, 'POST'],
		// Feature 004 (contracts/permissions-api.md §3): every route of the Directus router that matches the path.
		[/^\/(users|roles|policies|access|permissions)\/?$/i, 'POST,GET,HEAD,SEARCH,PATCH,DELETE'],
		[/^\/users\/(invite|register)\/?$/i, 'GET,HEAD,PATCH,DELETE,POST'],
		[/^\/(users|roles|policies|access|permissions)\/[^/]+\/?$/i, 'GET,HEAD,PATCH,DELETE'],
		[/^\/users\/me\/track\/page\/?$/i, 'PATCH'],
		[/^\/users\/(invite\/accept|me\/tfa\/(enable|disable)|[^/]+\/tfa\/disable)\/?$/i, 'POST'],
		[/^\/users\/register\/verify-email\/?$/i, 'GET,HEAD'],
		[/^\/policies\/me\/globals\/?$/i, 'GET,HEAD'],
		[/^\/permissions\/me\/[^/]+(\/[^/]+)?\/?$/i, 'GET,HEAD'],
		...(env['AUTH_DISABLE_DEFAULT'] ? [] : [[/^\/auth\/login\/?$/i, 'POST'] as [RegExp, string]]),
		[/^\/auth\/?$/i, 'GET,HEAD'],
		...getAuthProviders().flatMap((provider): [RegExp, string][] => {
			const login = `^/auth/login/${escapeRegExp(provider.name)}`;

			// The methods each driver router answers, in route order, HEAD added after GET (research R3).
			switch (provider.driver) {
				case 'local':
				case 'ldap':
					return [[new RegExp(`${login}/?$`, 'i'), 'POST']];
				case 'openid':
				case 'oauth2':
					return [
						[new RegExp(`${login}/?$`, 'i'), 'GET,HEAD'],
						[new RegExp(`${login}/callback/?$`, 'i'), 'POST,GET,HEAD'],
					];
				default:
					return [];
			}
		}),
	];

	return (req, res, next) => {
		const route = req.method === 'OPTIONS' ? routes.find(([path]) => path.test(req.path)) : undefined;
		if (!route) return next();

		const body = route[1];
		res.set('Allow', body);
		res.send(body);
	};
}
