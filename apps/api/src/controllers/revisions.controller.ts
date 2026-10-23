// Ported from directus/api/src/controllers/revisions.ts
// Backoffice: one Nest handler per DR route, in the same order (research R4 of spec 008); validateBatch runs
// through runMiddleware, useCollection('directus_revisions') is applied in app.module.ts, `next()` to `respond` is
// respond().
import { Controller, Get, Inject, Req, Res, Search } from '@nestjs/common';
import type { Request, Response } from 'express';
import { respond } from '../middleware/respond.js';
import { validateBatch } from '../middleware/validate-batch.js';
import type { ServiceFactory } from '../providers.js';
import { MetaService } from '../services/meta.service.js';
import { RevisionsService } from '../services/revisions.service.js';
import { runMiddleware } from '../utils/run-middleware.js';

@Controller('revisions')
export class RevisionsController {
	constructor(
		@Inject(RevisionsService) private readonly revisionsService: ServiceFactory<RevisionsService>,
		@Inject(MetaService) private readonly metaService: ServiceFactory<MetaService>,
	) {}

	private async readHandler(req: Request, res: Response): Promise<void> {
		const service = this.revisionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const metaService = this.metaService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const records = await service.readByQuery(req.sanitizedQuery);
		const meta = await metaService.getMetaForQuery('directus_revisions', req.sanitizedQuery);

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
		const service = this.revisionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const record = await service.readOne(req.params['pk'] as string, req.sanitizedQuery);

		res.locals['payload'] = { data: record || null };
		return respond(req, res);
	}
}
