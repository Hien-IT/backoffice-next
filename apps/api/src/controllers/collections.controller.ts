// Ported from directus/api/src/controllers/collections.ts
// Backoffice: one Nest handler per DR route, in the same order (research R2 of spec 006); `validateBatch` runs
// through runMiddleware, `next()` to `respond` is respond(). No useCollection: req.collection stays undefined, as in
// DR (permissionsCacheable of the response cache).
import { ErrorCode, isBackofficeError } from '@backoffice/errors';
import type { Item } from '@backoffice/types';
import { Controller, Delete, Get, HttpCode, Inject, Patch, Post, Req, Res, Search } from '@nestjs/common';
import type { Request, Response } from 'express';
import { respond } from '../middleware/respond.js';
import { validateBatch } from '../middleware/validate-batch.js';
import type { ServiceFactory } from '../providers.js';
import { CollectionsService } from '../services/collections.service.js';
import { MetaService } from '../services/meta.service.js';
import { runMiddleware } from '../utils/run-middleware.js';

@Controller('collections')
export class CollectionsController {
	constructor(
		@Inject(CollectionsService) private readonly collectionsService: ServiceFactory<CollectionsService>,
		@Inject(MetaService) private readonly metaService: ServiceFactory<MetaService>,
	) {}

	private service(req: Request): CollectionsService {
		return this.collectionsService({
			accountability: req.accountability,
			schema: req.schema,
		});
	}

	@Post()
	@HttpCode(200)
	async create(@Req() req: Request, @Res() res: Response): Promise<void> {
		const collectionsService = this.service(req);

		const attemptConcurrentIndex =
			'concurrentIndexCreation' in req.query && req.query['concurrentIndexCreation'] !== 'false';

		if (Array.isArray(req.body)) {
			const collectionKey = await collectionsService.createMany(req.body, {
				attemptConcurrentIndex,
			});

			const records = await collectionsService.readMany(collectionKey);
			res.locals['payload'] = { data: records || null };
		} else {
			const collectionKey = await collectionsService.createOne(req.body, {
				attemptConcurrentIndex,
			});

			const record = await collectionsService.readOne(collectionKey);
			res.locals['payload'] = { data: record || null };
		}

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

	private async readHandler(req: Request, res: Response): Promise<void> {
		const collectionsService = this.service(req);

		const metaService = this.metaService({
			accountability: req.accountability,
			schema: req.schema,
		});

		let result: Item[] = [];

		if (req.body.keys) {
			result = await collectionsService.readMany(req.body.keys);
		} else {
			result = await collectionsService.readByQuery();
		}

		const meta = await metaService.getMetaForQuery('directus_collections', {});

		res.locals['payload'] = { data: result, meta };
		return respond(req, res);
	}

	@Get(':collection')
	async readOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		const collectionsService = this.service(req);

		const collection = await collectionsService.readOne(req.params['collection'] as string);
		res.locals['payload'] = { data: collection || null };

		return respond(req, res);
	}

	@Patch()
	async updateBatch(@Req() req: Request, @Res() res: Response): Promise<void> {
		const collectionsService = this.service(req);

		const collectionKeys = await collectionsService.updateBatch(req.body);

		try {
			const collections = await collectionsService.readMany(collectionKeys);
			res.locals['payload'] = { data: collections || null };
		} catch (error: any) {
			if (isBackofficeError(error, ErrorCode.Forbidden)) {
				return respond(req, res);
			}

			throw error;
		}

		return respond(req, res);
	}

	@Patch(':collection')
	async updateOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		const collectionsService = this.service(req);

		await collectionsService.updateOne(req.params['collection'] as string, req.body);

		try {
			const collection = await collectionsService.readOne(req.params['collection'] as string);
			res.locals['payload'] = { data: collection || null };
		} catch (error: any) {
			if (isBackofficeError(error, ErrorCode.Forbidden)) {
				return respond(req, res);
			}

			throw error;
		}

		return respond(req, res);
	}

	@Delete(':collection')
	async deleteOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		const collectionsService = this.service(req);

		await collectionsService.deleteOne(req.params['collection'] as string);

		return respond(req, res);
	}
}
