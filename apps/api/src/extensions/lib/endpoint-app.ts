// Backoffice (spec 020, D-139 revised 2026-10-21): endpoint extensions run on Express 4.21.2, as in DR. The Nest
// app is Express 5; this Express 4 app is mounted in it, so a request that reaches it gets the Express 4 request and
// response (Express 4 path syntax, req.param, res.send(status), writable req.query, req.host without the port, req.body
// `{}`, a rejected async handler left to unhandledRejection) and gets the Express 5 ones back when it leaves.
import { useEnv } from '@backoffice/env';
import type { RequestHandler, Router } from 'express';
import express4 from 'express4';
import qs from 'qs';

export function createEndpointApp(router: Router): RequestHandler {
	const env = useEnv();
	const app = express4();

	// The settings of the DR app (directus/api/src/app.ts:134-144), which an Express 4 sub-app does not inherit.
	app.disable('x-powered-by');
	app.set('trust proxy', env['IP_TRUST_PROXY']);

	app.set('query parser', (str: string) =>
		qs.parse(str, {
			depth: Number(env['QUERYSTRING_MAX_PARSE_DEPTH']),
			arrayLimit: Number(env['QUERYSTRING_ARRAY_LIMIT']),
		}),
	);

	// DR parses bodies with the Express 4 body-parser, which leaves `{}` when the request has none.
	app.use((req, _res, next) => {
		if (req.body === undefined) req.body = {};
		next();
	});

	app.use(router);

	// A plain middleware, not `use(app)`: mounting emits `mount`, on which Express 4 makes its request and response
	// inherit from the Express 5 ones and loses its own methods. The Express 4 prototypes are set before the app runs
	// (its query middleware, ahead of `init`, would otherwise see the Express 5 `query` getter and not parse), and the
	// previous ones are put back, as Express 5 does for a mounted app, when the request leaves for the next handler.
	const handle = (app as unknown as { handle: (req: unknown, res: unknown, done: (error?: unknown) => void) => void })
		.handle;

	return (req, res, next) => {
		const request = Object.getPrototypeOf(req);
		const response = Object.getPrototypeOf(res);
		Object.setPrototypeOf(req, app.request);
		Object.setPrototypeOf(res, app.response);

		handle.call(app, req, res, (error?: unknown) => {
			Object.setPrototypeOf(req, request);
			Object.setPrototypeOf(res, response);
			next(error);
		});
	};
}
