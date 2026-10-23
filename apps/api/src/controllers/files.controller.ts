// Ported from directus/api/src/controllers/files.ts
// Backoffice: one Nest handler per DR route, in the same order (research R4 of spec 007). multipartHandler is the
// DR middleware unchanged, run through runMiddleware: the Nest app has no body parser of its own and jsonBody
// only reads application/json, so busboy still gets the raw multipart stream. useCollection('directus_files') is
// applied in app.module.ts; `next()` to `respond` is respond(); the env is read on use instead of at import (001).
import path from 'path';
import { useEnv } from '@backoffice/env';
import { ErrorCode, InvalidPayloadError, isBackofficeError } from '@backoffice/errors';
import formatTitle from '@backoffice/format-title';
import type { BusboyFileStream, PrimaryKey } from '@backoffice/types';
import { toArray } from '@backoffice/utils';
import { Controller, Delete, Get, HttpCode, Inject, Patch, Post, Req, Res, Search } from '@nestjs/common';
import Busboy from 'busboy';
import bytes from 'bytes';
import type { Request, RequestHandler, Response } from 'express';
import Joi from 'joi';
import { minimatch } from 'minimatch';
import { respond } from '../middleware/respond.js';
import { validateBatch } from '../middleware/validate-batch.js';
import type { ServiceFactory } from '../providers.js';
import { FilesService } from '../services/files.service.js';
import { MetaService } from '../services/meta.service.js';
import { runMiddleware } from '../utils/run-middleware.js';
import { sanitizeQuery } from '../utils/sanitize-query.js';

export const multipartHandler: RequestHandler = (req, res, next) => {
	const env = useEnv();

	if (req.is('multipart/form-data') === false) return next();

	let headers;

	if (req.headers['content-type']) {
		headers = req.headers;
	} else {
		headers = {
			...req.headers,
			'content-type': 'application/octet-stream',
		};
	}

	const busboy = Busboy({
		headers,
		defParamCharset: 'utf8',
		limits: {
			fileSize: bytes.parse(env['FILES_MAX_UPLOAD_SIZE'] as string) ?? undefined,
		},
	});

	const savedFiles: PrimaryKey[] = [];
	const service = new FilesService({ accountability: req.accountability, schema: req.schema });

	const existingPrimaryKey = (req.params['pk'] as string | undefined) || undefined;

	/**
	 * The order of the fields in multipart/form-data is important. We require that all fields
	 * are provided _before_ the files. This allows us to set the storage location, and create
	 * the row in directus_files async during the upload of the actual file.
	 */

	let payload: any = {};
	let fileCount = 0;

	busboy.on('field', (fieldname, val) => {
		let fieldValue: string | null | boolean = val;

		if (typeof fieldValue === 'string' && fieldValue.trim() === 'null') fieldValue = null;
		if (typeof fieldValue === 'string' && fieldValue.trim() === 'false') fieldValue = false;
		if (typeof fieldValue === 'string' && fieldValue.trim() === 'true') fieldValue = true;

		payload[fieldname] = fieldValue;
	});

	busboy.on('file', async (_fieldname, fileStream: BusboyFileStream, { filename, mimeType }) => {
		if (!filename) {
			return busboy.emit('error', new InvalidPayloadError({ reason: `File is missing filename` }));
		}

		const allowedPatterns = toArray(env['FILES_MIME_TYPE_ALLOW_LIST'] as string | string[]);
		const mimeTypeAllowed = allowedPatterns.some((pattern) => minimatch(mimeType, pattern));

		if (mimeTypeAllowed === false) {
			return busboy.emit('error', new InvalidPayloadError({ reason: `File is of invalid content type` }));
		}

		fileCount++;

		if (!existingPrimaryKey) {
			if (!payload.title) {
				payload.title = formatTitle(path.parse(filename).name);
			}
		}

		payload.filename_download ||= filename;

		const payloadWithRequiredFields = {
			...payload,
			type: mimeType,
		};

		// Clear the payload for the next to-be-uploaded file
		payload = {};

		try {
			const primaryKey = await service.uploadOne(fileStream, payloadWithRequiredFields, existingPrimaryKey);
			savedFiles.push(primaryKey);
			tryDone();
		} catch (error: any) {
			busboy.emit('error', error);
		}

		return undefined;
	});

	busboy.on('error', (error: Error) => {
		next(error);
	});

	busboy.on('close', () => {
		tryDone();
	});

	req.pipe(busboy);

	function tryDone() {
		if (savedFiles.length === fileCount) {
			if (fileCount === 0) {
				return next(new InvalidPayloadError({ reason: `No files were included in the body` }));
			}

			res.locals['savedFiles'] = savedFiles;
			return next();
		}
	}
};

const importSchema = Joi.object({
	url: Joi.string().required(),
	data: Joi.object(),
	options: Joi.object({ filterMimeType: Joi.array().items(Joi.string()) }),
});

@Controller('files')
export class FilesController {
	constructor(
		@Inject(FilesService) private readonly filesService: ServiceFactory<FilesService>,
		@Inject(MetaService) private readonly metaService: ServiceFactory<MetaService>,
	) {}

	private service(req: Request): FilesService {
		return this.filesService({
			accountability: req.accountability,
			schema: req.schema,
		});
	}

	@Post()
	@HttpCode(200)
	async create(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(multipartHandler, req, res);

		const service = this.service(req);

		let keys: PrimaryKey | PrimaryKey[] = [];

		if (req.is('multipart/form-data')) {
			keys = res.locals['savedFiles'];
		} else {
			keys = await service.createOne(req.body);
		}

		try {
			if (Array.isArray(keys) && keys.length > 1) {
				const records = await service.readMany(keys, req.sanitizedQuery);

				res.locals['payload'] = {
					data: records,
				};
			} else {
				const key = Array.isArray(keys) ? keys[0]! : keys;
				const record = await service.readOne(key, req.sanitizedQuery);

				res.locals['payload'] = {
					data: record,
				};
			}
		} catch (error: any) {
			if (isBackofficeError(error, ErrorCode.Forbidden)) {
				return respond(req, res);
			}

			throw error;
		}

		return respond(req, res);
	}

	@Post('import')
	@HttpCode(200)
	async import(@Req() req: Request, @Res() res: Response): Promise<void> {
		const { error } = importSchema.validate(req.body);

		if (error) {
			throw new InvalidPayloadError({ reason: error.message });
		}

		const service = this.service(req);

		const primaryKey = await service.importOne(req.body.url, req.body.data, req.body.options);

		try {
			const record = await service.readOne(primaryKey, req.sanitizedQuery);
			res.locals['payload'] = { data: record || null };
		} catch (error: any) {
			if (isBackofficeError(error, ErrorCode.Forbidden)) {
				return respond(req, res);
			}

			throw error;
		}

		return respond(req, res);
	}

	private async readHandler(req: Request, res: Response): Promise<void> {
		const service = this.service(req);

		const metaService = this.metaService({
			accountability: req.accountability,
			schema: req.schema,
		});

		let result;

		if (req.singleton) {
			result = await service.readSingleton(req.sanitizedQuery);
		} else if (req.body.keys) {
			result = await service.readMany(req.body.keys, req.sanitizedQuery);
		} else {
			result = await service.readByQuery(req.sanitizedQuery);
		}

		const meta = await metaService.getMetaForQuery('directus_files', req.sanitizedQuery);

		res.locals['payload'] = { data: result, meta };
		return respond(req, res);
	}

	@Get()
	async readMany(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(validateBatch('read'), req, res);
		return this.readHandler(req, res);
	}

	@Search()
	async search(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(validateBatch('read'), req, res);
		return this.readHandler(req, res);
	}

	@Get(':pk')
	async readOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.service(req);

		const record = await service.readOne(req.params['pk'] as string, req.sanitizedQuery);
		res.locals['payload'] = { data: record || null };
		return respond(req, res);
	}

	@Patch()
	async updateMany(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(validateBatch('update'), req, res);

		const service = this.service(req);

		let keys: PrimaryKey[] = [];

		if (Array.isArray(req.body)) {
			keys = await service.updateBatch(req.body);
		} else if (req.body.keys) {
			keys = await service.updateMany(req.body.keys, req.body.data);
		} else {
			const sanitizedQuery = await sanitizeQuery(req.body.query, req.schema, req.accountability);
			keys = await service.updateByQuery(sanitizedQuery, req.body.data);
		}

		try {
			const result = await service.readMany(keys, req.sanitizedQuery);
			res.locals['payload'] = { data: result || null };
		} catch (error: any) {
			if (isBackofficeError(error, ErrorCode.Forbidden)) {
				return respond(req, res);
			}

			throw error;
		}

		return respond(req, res);
	}

	@Patch(':pk')
	async updateOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(multipartHandler, req, res);

		const service = this.service(req);

		await service.updateOne(req.params['pk'] as string, req.body);

		try {
			const record = await service.readOne(req.params['pk'] as string, req.sanitizedQuery);
			res.locals['payload'] = { data: record || null };
		} catch (error: any) {
			if (isBackofficeError(error, ErrorCode.Forbidden)) {
				return respond(req, res);
			}

			throw error;
		}

		return respond(req, res);
	}

	@Delete()
	async deleteMany(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(validateBatch('delete'), req, res);

		const service = this.service(req);

		if (Array.isArray(req.body)) {
			await service.deleteMany(req.body);
		} else if (req.body.keys) {
			await service.deleteMany(req.body.keys);
		} else {
			const sanitizedQuery = await sanitizeQuery(req.body.query, req.schema, req.accountability);
			await service.deleteByQuery(sanitizedQuery);
		}

		return respond(req, res);
	}

	@Delete(':pk')
	async deleteOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.service(req);

		await service.deleteOne(req.params['pk'] as string);

		return respond(req, res);
	}
}
