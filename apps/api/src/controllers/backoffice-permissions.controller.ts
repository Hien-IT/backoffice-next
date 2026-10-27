// Backoffice (spec 025, FR-020, D-189.6): /backoffice/permissions, the rows of backoffice_permissions, with the routes
// and bodies of /permissions (permissions.controller.ts) without the /me routes. DR has no such route (404).
import { ErrorCode, isBackofficeError } from '@backoffice/errors';
import type { PrimaryKey } from '@backoffice/types';
import { Controller, Delete, Get, HttpCode, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { respond } from '../middleware/respond.js';
import { validateBatch } from '../middleware/validate-batch.js';
import type { ServiceFactory } from '../providers.js';
import { BackofficePermissionsService, TABLE } from '../services/backoffice-permissions.service.js';
import { MetaService } from '../services/meta.service.js';
import { runMiddleware } from '../utils/run-middleware.js';
import { sanitizeQuery } from '../utils/sanitize-query.js';

@Controller('backoffice/permissions')
export class BackofficePermissionsController {
	constructor(
		@Inject(BackofficePermissionsService)
		private readonly backofficePermissionsService: ServiceFactory<BackofficePermissionsService>,
		@Inject(MetaService) private readonly metaService: ServiceFactory<MetaService>,
	) {}

	private service(req: Request) {
		return this.backofficePermissionsService({ accountability: req.accountability, schema: req.schema });
	}

	@Post()
	@HttpCode(200)
	async create(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.service(req);
		const savedKeys: PrimaryKey[] = Array.isArray(req.body)
			? await service.createMany(req.body)
			: [await service.createOne(req.body)];

		return this.respondWith(req, res, async () =>
			Array.isArray(req.body)
				? await service.readMany(savedKeys, req.sanitizedQuery)
				: await service.readOne(savedKeys[0]!, req.sanitizedQuery),
		);
	}

	@Get()
	async readMany(@Req() req: Request, @Res() res: Response): Promise<void> {
		const result = await this.service(req).readByQuery(req.sanitizedQuery);
		// The read above checked the caller's read access on directus_permissions; the counts run as admin like it.
		const metaService = this.metaService({
			accountability: { ...req.accountability!, admin: true },
			schema: req.schema,
		});
		const meta = await metaService.getMetaForQuery(TABLE, req.sanitizedQuery);

		res.locals['payload'] = { data: result, meta };
		return respond(req, res);
	}

	@Get(':pk')
	async readOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		res.locals['payload'] = { data: await this.service(req).readOne(req.params['pk'] as string, req.sanitizedQuery) };
		return respond(req, res);
	}

	@Patch()
	async updateMany(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(validateBatch('update'), req, res);
		const service = this.service(req);
		let keys: PrimaryKey[];

		if (Array.isArray(req.body)) {
			keys = await service.updateBatch(req.body);
		} else if (req.body.keys) {
			keys = await service.updateMany(req.body.keys, req.body.data);
		} else {
			const sanitizedQuery = await sanitizeQuery(req.body.query, req.schema, req.accountability);
			keys = await service.updateByQuery(sanitizedQuery, req.body.data);
		}

		return this.respondWith(req, res, () => service.readMany(keys, req.sanitizedQuery));
	}

	@Patch(':pk')
	async updateOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.service(req);
		const primaryKey = await service.updateOne(req.params['pk'] as string, req.body);
		return this.respondWith(req, res, async () => (await service.readOne(primaryKey, req.sanitizedQuery)) || null);
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
		await this.service(req).deleteOne(req.params['pk'] as string);
		return respond(req, res);
	}

	/** The read after a write; a caller who may write but not read gets an empty answer, as in permissions.controller. */
	private async respondWith(req: Request, res: Response, read: () => Promise<unknown>): Promise<void> {
		try {
			res.locals['payload'] = { data: await read() };
		} catch (error: any) {
			if (!isBackofficeError(error, ErrorCode.Forbidden)) throw error;
		}

		return respond(req, res);
	}
}
