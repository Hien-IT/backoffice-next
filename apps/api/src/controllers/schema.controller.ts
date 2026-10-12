// Ported from directus/api/src/controllers/schema.ts
// Backoffice: one Nest handler per Directus route (research R2 of spec 006). schemaMultipartHandler is the Directus
// middleware unchanged, run through runMiddleware: the Nest app has no body parser of its own and jsonBody only reads
// application/json, so busboy still gets the raw multipart stream. `next()` to `respond` is respond().
import { InvalidPayloadError, UnsupportedMediaTypeError } from '@backoffice/errors';
import type { Snapshot, SnapshotDiffWithHash } from '@backoffice/types';
import { parseJSON, toBoolean } from '@backoffice/utils';
import { Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import Busboy from 'busboy';
import type { Request, RequestHandler, Response } from 'express';
import { load as loadYaml } from 'js-yaml';
import { useLogger } from '../logger/index.js';
import { respond } from '../middleware/respond.js';
import type { ServiceFactory } from '../providers.js';
import { SchemaService } from '../services/schema.service.js';
import { getVersionedHash } from '../utils/get-versioned-hash.js';
import { runMiddleware } from '../utils/run-middleware.js';

export const schemaMultipartHandler: RequestHandler = (req, res, next) => {
	if (req.is('application/json')) {
		if (Object.keys(req.body).length === 0) {
			throw new InvalidPayloadError({ reason: `No data was included in the body` });
		}

		res.locals['upload'] = req.body;
		return next();
	}

	if (!req.is('multipart/form-data')) {
		throw new UnsupportedMediaTypeError({ mediaType: req.headers['content-type']!, where: 'Content-Type header' });
	}

	const headers = req.headers['content-type']
		? req.headers
		: {
				...req.headers,
				'content-type': 'application/octet-stream',
			};

	const busboy = Busboy({ headers });

	let isFileIncluded = false;
	let upload: any | null = null;

	busboy.on('file', async (_, fileStream, { mimeType }) => {
		const logger = useLogger();

		if (isFileIncluded) return next(new InvalidPayloadError({ reason: `More than one file was included in the body` }));

		isFileIncluded = true;

		const { readableStreamToString } = await import('@backoffice/utils/node');

		try {
			const uploadedString = await readableStreamToString(fileStream);

			if (mimeType === 'application/json') {
				try {
					upload = parseJSON(uploadedString);
				} catch (err: any) {
					logger.warn(err);
					throw new InvalidPayloadError({ reason: 'The provided JSON is invalid' });
				}
			} else {
				try {
					upload = await loadYaml(uploadedString);
				} catch (err: any) {
					logger.warn(err);
					throw new InvalidPayloadError({ reason: 'The provided YAML is invalid' });
				}
			}

			if (!upload) {
				throw new InvalidPayloadError({ reason: `No file was included in the body` });
			}

			res.locals['upload'] = upload;

			return next();
		} catch (error: any) {
			busboy.emit('error', error);
		}
	});

	busboy.on('error', (error: Error) => next(error));

	busboy.on('close', () => {
		if (!isFileIncluded) return next(new InvalidPayloadError({ reason: `No file was included in the body` }));
	});

	req.pipe(busboy);
};

@Controller('schema')
export class SchemaController {
	constructor(@Inject(SchemaService) private readonly schemaService: ServiceFactory<SchemaService>) {}

	@Get('snapshot')
	async snapshot(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.schemaService({ accountability: req.accountability });
		const currentSnapshot = await service.snapshot();
		res.locals['payload'] = { data: currentSnapshot };
		return respond(req, res);
	}

	@Post('diff')
	@HttpCode(200)
	async diff(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(schemaMultipartHandler, req, res);

		const service = this.schemaService({ accountability: req.accountability });
		const snapshot: Snapshot = res.locals['upload'];
		const currentSnapshot = await service.snapshot();
		const snapshotDiff = await service.diff(snapshot, { currentSnapshot, force: 'force' in req.query });
		if (!snapshotDiff) return respond(req, res);

		const currentSnapshotHash = getVersionedHash(currentSnapshot);
		res.locals['payload'] = { data: { hash: currentSnapshotHash, diff: snapshotDiff } };
		return respond(req, res);
	}

	@Post('apply')
	@HttpCode(200)
	async apply(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(schemaMultipartHandler, req, res);

		const service = this.schemaService({ accountability: req.accountability });
		const diff: SnapshotDiffWithHash = res.locals['upload'];
		await service.apply(diff, { force: toBoolean(req.query['force']) });
		return respond(req, res);
	}
}
