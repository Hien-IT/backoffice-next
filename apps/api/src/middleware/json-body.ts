// Ported from directus/api/src/app.ts (JSON body middleware). Express 5 ships body-parser 2; DR runs
// Express 4.21.2, whose express.json() is body-parser 1.20.3, so that version is used directly (research R4).
import { useEnv } from '@backoffice/env';
import { InvalidPayloadError } from '@backoffice/errors';
import bodyParser from 'body-parser';
import type { RequestHandler } from 'express';

export function createJsonBody(): RequestHandler {
	const env = useEnv();

	const parser = bodyParser.json({
		limit: env['MAX_PAYLOAD_SIZE'] as string,
		verify: (req, _res, buf) => {
			(req as any).rawBody = buf;
		},
	});

	return (req, res, next) => {
		parser(req, res, (err: any) => {
			if (err) {
				return next(new InvalidPayloadError({ reason: err.message }));
			}

			return next();
		});
	};
}
