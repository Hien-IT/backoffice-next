// Ported from directus/api/src/controllers/dashboards.ts
// Backoffice: one Nest handler per DR route, in the same order (research R16 of spec 010, R4 of spec 008);
// validateBatch runs through runMiddleware, useCollection('directus_dashboards') is applied in app.module.ts,
// `next()` to `respond` is respond().
import { ErrorCode, isBackofficeError } from '@backoffice/errors';
import type { PrimaryKey } from '@backoffice/types';
import { Controller, Delete, Get, HttpCode, Inject, Patch, Post, Req, Res, Search } from '@nestjs/common';
import type { Request, Response } from 'express';
import { respond } from '../middleware/respond.js';
import { validateBatch } from '../middleware/validate-batch.js';
import type { ServiceFactory } from '../providers.js';
import { DashboardsService } from '../services/dashboards.service.js';
import { MetaService } from '../services/meta.service.js';
import { runMiddleware } from '../utils/run-middleware.js';
import { sanitizeQuery } from '../utils/sanitize-query.js';

@Controller('dashboards')
export class DashboardsController {
	constructor(
		@Inject(DashboardsService) private readonly dashboardsService: ServiceFactory<DashboardsService>,
		@Inject(MetaService) private readonly metaService: ServiceFactory<MetaService>,
	) {}

	private service(req: Request): DashboardsService {
		return this.dashboardsService({
			accountability: req.accountability,
			schema: req.schema,
		});
	}

	@Post()
	@HttpCode(200)
	async create(@Req() req: Request, @Res() res: Response): Promise<void> {
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
				const records = await service.readMany(savedKeys, req.sanitizedQuery);
				res.locals['payload'] = { data: records };
			} else {
				const record = await service.readOne(savedKeys[0]!, req.sanitizedQuery);
				res.locals['payload'] = { data: record };
			}
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

		const records = await service.readByQuery(req.sanitizedQuery);
		const meta = await metaService.getMetaForQuery(req.collection, req.sanitizedQuery);

		res.locals['payload'] = { data: records || null, meta };
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
			res.locals['payload'] = { data: result };
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
		const service = this.service(req);

		const primaryKey = await service.updateOne(req.params['pk'] as string, req.body);

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

	// Backoffice: no validateBatch('delete') here, like the DR router of this collection.
	@Delete()
	async deleteMany(@Req() req: Request, @Res() res: Response): Promise<void> {
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
