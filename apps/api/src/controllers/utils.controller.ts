// Ported from directus/api/src/controllers/utils.ts
// Backoffice: one Nest handler per Directus route, in the same order (research R7, R16 of spec 010). collectionExists
// runs through runMiddleware; `next()` to `respond` is respond(); the routes that answer with res.json or res.end do
// the same here (no response cache, as in Directus). The import reads the raw multipart stream with busboy like
// files.controller.ts (the JSON body parser leaves multipart requests alone).
import { ForbiddenError, InvalidPayloadError, InvalidQueryError, UnsupportedMediaTypeError } from '@backoffice/errors';
import { toBoolean } from '@backoffice/utils';
import { Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import argon2 from 'argon2';
import Busboy from 'busboy';
import type { Request, Response } from 'express';
import Joi from 'joi';
import { resolveLoginRedirect } from '../auth/utils/resolve-login-redirect.js';
import { clearSystemCache } from '../cache.js';
import { getDatabase } from '../database/index.js';
import { useLogger } from '../logger/index.js';
import collectionExists from '../middleware/collection-exists.js';
import { respond } from '../middleware/respond.js';
import type { ServiceFactory } from '../providers.js';
import { ExportService, ImportService } from '../services/import-export.service.js';
import { RevisionsService } from '../services/revisions.service.js';
import { UtilsService } from '../services/utils.service.js';
import { generateHash } from '../utils/generate-hash.js';
import { generateTranslations } from '../utils/generate-translations.js';
import { runMiddleware } from '../utils/run-middleware.js';
import { sanitizeQuery } from '../utils/sanitize-query.js';

const randomStringSchema = Joi.object<{ length: number }>({
	length: Joi.number().integer().min(1).max(500).default(32),
});

const SortSchema = Joi.object({
	item: Joi.alternatives(Joi.string(), Joi.number()).required(),
	to: Joi.alternatives(Joi.string(), Joi.number()).required(),
});

@Controller('utils')
export class UtilsController {
	constructor(
		@Inject(UtilsService) private readonly utilsService: ServiceFactory<UtilsService>,
		@Inject(RevisionsService) private readonly revisionsService: ServiceFactory<RevisionsService>,
		@Inject(ImportService) private readonly importService: ServiceFactory<ImportService>,
		@Inject(ExportService) private readonly exportService: ServiceFactory<ExportService>,
	) {}

	@Get('random/string')
	async randomString(@Req() req: Request, @Res() res: Response): Promise<void> {
		const { nanoid } = await import('nanoid');

		const { error, value } = randomStringSchema.validate(req.query, { allowUnknown: true });

		if (error) throw new InvalidQueryError({ reason: error.message });

		res.json({ data: nanoid(value.length) });
	}

	@Post('hash/generate')
	@HttpCode(200)
	async hashGenerate(@Req() req: Request, @Res() res: Response): Promise<void> {
		if (!req.body?.string) {
			throw new InvalidPayloadError({ reason: `"string" is required` });
		}

		const hash = await generateHash(req.body.string);

		res.json({ data: hash });
	}

	@Post('hash/verify')
	@HttpCode(200)
	async hashVerify(@Req() req: Request, @Res() res: Response): Promise<void> {
		if (!req.body?.string) {
			throw new InvalidPayloadError({ reason: `"string" is required` });
		}

		if (!req.body?.hash) {
			throw new InvalidPayloadError({ reason: `"hash" is required` });
		}

		let result: boolean;

		try {
			result = await argon2.verify(req.body.hash, req.body.string);
		} catch {
			throw new InvalidPayloadError({ reason: `Invalid "hash" or "string"` });
		}

		res.json({ data: result });
	}

	@Post('sort/:collection')
	@HttpCode(200)
	async sort(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(collectionExists, req, res);

		const { error } = SortSchema.validate(req.body);
		if (error) throw new InvalidPayloadError({ reason: error.message });

		const service = this.utilsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		await service.sort(req.collection, req.body);

		res.status(200).end();
	}

	@Post('revert/:revision')
	@HttpCode(200)
	async revert(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.revisionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		await service.revert(req.params['revision'] as string);
		return respond(req, res);
	}

	@Post('import/:collection')
	@HttpCode(200)
	async import(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(collectionExists, req, res);

		if (req.is('multipart/form-data') === false) {
			throw new UnsupportedMediaTypeError({ mediaType: req.headers['content-type']!, where: 'Content-Type header' });
		}

		const service = this.importService({
			accountability: req.accountability,
			schema: req.schema,
		});

		let headers;

		if (req.headers['content-type']) {
			headers = req.headers;
		} else {
			headers = {
				...req.headers,
				'content-type': 'application/octet-stream',
			};
		}

		// Backoffice: asyncHandler's next(err) of Directus is the rejection of this promise (Nest error filter).
		await new Promise<void>((resolve, reject) => {
			const busboy = Busboy({ headers });

			busboy.on('file', async (_fieldname, fileStream, { mimeType }) => {
				try {
					await service.import(req.params['collection'] as string, mimeType, fileStream, {
						background: toBoolean(req.query['background']),
					});
				} catch (err: any) {
					return reject(err);
				}

				res.status(200).end();
				return resolve();
			});

			busboy.on('error', (err: Error) => reject(err));

			req.pipe(busboy);
		});
	}

	@Post('export/:collection')
	@HttpCode(200)
	async export(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(collectionExists, req, res);

		if (!req.body.query) {
			throw new InvalidPayloadError({ reason: `"query" is required` });
		}

		if (!req.body.format) {
			throw new InvalidPayloadError({ reason: `"format" is required` });
		}

		const service = this.exportService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const sanitizedQuery = await sanitizeQuery(req.body.query, req.schema, req.accountability ?? null);

		// We're not awaiting this, as it's supposed to run async in the background
		service.exportToFile(req.params['collection'] as string, sanitizedQuery, req.body.format, {
			file: req.body.file,
		});

		return respond(req, res);
	}

	@Post('translations/generate')
	@HttpCode(200)
	async translationsGenerate(@Req() req: Request, @Res() res: Response): Promise<void> {
		if (!req.accountability?.admin) throw new ForbiddenError();

		const result = await generateTranslations(req.body, {
			knex: getDatabase(),
			schema: req.schema,
			accountability: req.accountability,
		});

		try {
			await clearSystemCache({ forced: true });
		} catch (error) {
			useLogger().error(error, 'Failed to clear system cache after translation changes');
		}

		res.locals['payload'] = { data: result };
		return respond(req, res);
	}

	@Post('cache/clear')
	@HttpCode(200)
	async cacheClear(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.utilsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const clearSystemCache = 'system' in req.query && (req.query['system'] === '' || Boolean(req.query['system']));

		await service.clearCache({ system: clearSystemCache });

		res.status(200).end();
	}

	@Post('resolve-redirect')
	@HttpCode(200)
	async resolveRedirect(@Req() req: Request, @Res() res: Response): Promise<void> {
		if (!req.body?.redirect) {
			throw new InvalidPayloadError({ reason: `"redirect" is required` });
		}

		if (req.body?.provider && typeof req.body.provider !== 'string') {
			throw new InvalidPayloadError({ reason: `"provider" must be a string` });
		}

		let resolved: string;

		try {
			resolved = resolveLoginRedirect(req.body.redirect, {
				provider: req.body.provider,
			}) as string;
		} catch {
			throw new InvalidPayloadError({ reason: `Invalid "redirect" provided` });
		}

		res.json({ data: resolved });
	}
}
