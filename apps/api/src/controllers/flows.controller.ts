// Ported from directus/api/src/controllers/flows.ts
// Backoffice: one Nest handler per Directus route, in the same order (research R3 of spec 009); validateBatch runs
// through runMiddleware, useCollection('directus_flows') is applied in app.module.ts, `next()` to `respond` is
// respond(). Express 5 has no regular expression route parameters, so the trigger handlers check the uuid themselves.
import { ErrorCode, isBackofficeError, RouteNotFoundError } from '@backoffice/errors';
import type { PrimaryKey } from '@backoffice/types';
import { Controller, Delete, Get, HttpCode, Inject, Patch, Post, Req, Res, Search } from '@nestjs/common';
import type { Request, Response } from 'express';
import { UUID_REGEX } from '../constants.js';
import { getFlowManager } from '../flows.js';
import { respond } from '../middleware/respond.js';
import { validateBatch } from '../middleware/validate-batch.js';
import type { ServiceFactory } from '../providers.js';
import { FlowsService } from '../services/flows.service.js';
import { MetaService } from '../services/meta.service.js';
import { runMiddleware } from '../utils/run-middleware.js';
import { sanitizeQuery } from '../utils/sanitize-query.js';

// Backoffice: `/trigger/:pk(${UUID_REGEX})` of the Express 4 router, which matches case-insensitively.
const TRIGGER_PK = new RegExp(`^${UUID_REGEX}$`, 'i');

@Controller('flows')
export class FlowsController {
	constructor(
		@Inject(FlowsService) private readonly flowsService: ServiceFactory<FlowsService>,
		@Inject(MetaService) private readonly metaService: ServiceFactory<MetaService>,
	) {}

	private service(req: Request): FlowsService {
		return this.flowsService({
			accountability: req.accountability,
			schema: req.schema,
		});
	}

	private async webhookFlowHandler(req: Request, res: Response): Promise<void> {
		// Backoffice: no route matches a key that is not a uuid in Directus, so its 404 handler answers.
		if (!TRIGGER_PK.test(req.params['pk'] as string)) throw new RouteNotFoundError({ path: req.path });

		const flowManager = getFlowManager();

		const { result, cacheEnabled } = await flowManager.runWebhookFlow(
			`${req.method}-${req.params['pk']}`,
			{
				// Backoffice: the path inside the Directus router, without its /flows mount path.
				path: req.path.replace(/^\/flows/i, ''),
				query: req.query,
				body: req.body,
				method: req.method,
				headers: req.headers,
			},
			{
				accountability: req.accountability,
				schema: req.schema,
			},
		);

		if (!cacheEnabled) {
			res.locals['cache'] = false;
		}

		res.locals['payload'] = result;
		return respond(req, res);
	}

	@Get('trigger/:pk')
	async triggerGet(@Req() req: Request, @Res() res: Response): Promise<void> {
		return this.webhookFlowHandler(req, res);
	}

	@Post('trigger/:pk')
	@HttpCode(200)
	async triggerPost(@Req() req: Request, @Res() res: Response): Promise<void> {
		return this.webhookFlowHandler(req, res);
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
				const items = await service.readMany(savedKeys, req.sanitizedQuery);
				res.locals['payload'] = { data: items };
			} else {
				const item = await service.readOne(savedKeys[0]!, req.sanitizedQuery);
				res.locals['payload'] = { data: item };
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
			const item = await service.readOne(primaryKey, req.sanitizedQuery);
			res.locals['payload'] = { data: item || null };
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
