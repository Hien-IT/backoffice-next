// Ported from directus/api/src/controllers/items.ts
// Backoffice: one Nest handler per DR route, in the same order (research R2 of spec 005); `collectionExists` and
// `validateBatch` run through runMiddleware in the order of the DR router, `next()` to `respond` is respond().
import { ErrorCode, ForbiddenError, isBackofficeError, RouteNotFoundError } from '@backoffice/errors';
import { isSystemCollection } from '@backoffice/system-data';
import type { PrimaryKey } from '@backoffice/types';
import { Controller, Delete, Get, HttpCode, Inject, Patch, Post, Req, Res, Search } from '@nestjs/common';
import type { Request, Response } from 'express';
import collectionExists from '../middleware/collection-exists.js';
import { respond } from '../middleware/respond.js';
import { validateBatch } from '../middleware/validate-batch.js';
import type { ItemsServiceFactory, ServiceFactory } from '../providers.js';
import { ItemsService } from '../services/items.service.js';
import { MetaService } from '../services/meta.service.js';
import { runMiddleware } from '../utils/run-middleware.js';
import { sanitizeQuery } from '../utils/sanitize-query.js';

/** `req.path` inside the DR router mounted at /items (Express strips the mount path, case-insensitively). */
const routerPath = (req: Request) => req.path.replace(/^\/items/i, '');

@Controller('items')
export class ItemsController {
	constructor(
		@Inject(ItemsService) private readonly itemsService: ItemsServiceFactory,
		@Inject(MetaService) private readonly metaService: ServiceFactory<MetaService>,
	) {}

	private service(req: Request): ItemsService {
		return this.itemsService(req.collection, {
			accountability: req.accountability,
			schema: req.schema,
		});
	}

	@Post(':collection')
	@HttpCode(200)
	async create(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(collectionExists, req, res);

		if (isSystemCollection(req.params['collection'] as string)) throw new ForbiddenError();

		if (req.singleton) {
			throw new RouteNotFoundError({ path: routerPath(req) });
		}

		const service = this.service(req);

		const savedKeys: PrimaryKey[] = [];

		if (Array.isArray(req.body)) {
			const keys = await service.createMany(req.body);
			savedKeys.push(...keys);
		} else {
			const key = await service.createOne(req.body);
			savedKeys.push(key);
		}

		try {
			if (Array.isArray(req.body)) {
				const result = await service.readMany(savedKeys, req.sanitizedQuery);
				res.locals['payload'] = { data: result || null };
			} else {
				const result = await service.readOne(savedKeys[0]!, req.sanitizedQuery);
				res.locals['payload'] = { data: result || null };
			}
		} catch (error: any) {
			if (isBackofficeError(error, ErrorCode.Forbidden)) {
				return respond(req, res);
			}

			throw error;
		}

		return respond(req, res);
	}

	@Search(':collection')
	async search(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(collectionExists, req, res);
		await runMiddleware(validateBatch('read'), req, res);
		return this.readHandler(req, res);
	}

	@Get(':collection')
	async readMany(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(collectionExists, req, res);
		return this.readHandler(req, res);
	}

	private async readHandler(req: Request, res: Response): Promise<void> {
		if (isSystemCollection(req.params['collection'] as string)) throw new ForbiddenError();

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

		const meta = await metaService.getMetaForQuery(req.collection, req.sanitizedQuery);

		res.locals['payload'] = {
			meta: meta,
			data: result,
		};

		return respond(req, res);
	}

	@Get(':collection/:pk')
	async readOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(collectionExists, req, res);

		if (isSystemCollection(req.params['collection'] as string)) throw new ForbiddenError();

		const service = this.service(req);

		const result = await service.readOne(req.params['pk'] as string, req.sanitizedQuery);

		res.locals['payload'] = {
			data: result || null,
		};

		return respond(req, res);
	}

	@Patch(':collection')
	async updateMany(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(collectionExists, req, res);
		await runMiddleware(validateBatch('update'), req, res);

		if (isSystemCollection(req.params['collection'] as string)) throw new ForbiddenError();

		const service = this.service(req);

		if (req.singleton === true) {
			await service.upsertSingleton(req.body);
			const item = await service.readSingleton(req.sanitizedQuery);

			res.locals['payload'] = { data: item || null };
			return respond(req, res);
		}

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
			res.locals['payload'] = { data: result };
		} catch (error: any) {
			if (isBackofficeError(error, ErrorCode.Forbidden)) {
				return respond(req, res);
			}

			throw error;
		}

		return respond(req, res);
	}

	@Patch(':collection/:pk')
	async updateOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(collectionExists, req, res);

		if (isSystemCollection(req.params['collection'] as string)) throw new ForbiddenError();

		if (req.singleton) {
			throw new RouteNotFoundError({ path: routerPath(req) });
		}

		const service = this.service(req);

		const updatedPrimaryKey = await service.updateOne(req.params['pk'] as string, req.body);

		try {
			const result = await service.readOne(updatedPrimaryKey, req.sanitizedQuery);
			res.locals['payload'] = { data: result || null };
		} catch (error: any) {
			if (isBackofficeError(error, ErrorCode.Forbidden)) {
				return respond(req, res);
			}

			throw error;
		}

		return respond(req, res);
	}

	@Delete(':collection')
	async deleteMany(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(collectionExists, req, res);
		await runMiddleware(validateBatch('delete'), req, res);

		if (isSystemCollection(req.params['collection'] as string)) throw new ForbiddenError();

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

	@Delete(':collection/:pk')
	async deleteOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(collectionExists, req, res);

		if (isSystemCollection(req.params['collection'] as string)) throw new ForbiddenError();

		const service = this.service(req);

		await service.deleteOne(req.params['pk'] as string);
		return respond(req, res);
	}
}
