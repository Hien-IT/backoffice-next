// Ported from directus/api/src/controllers/permissions.ts
// Backoffice: one Nest handler per Directus route, in the same order; `router.use(useCollection(...))` is applied by
// AppModule.configure, `validateBatch` runs through runMiddleware (research R3), `next()` to `respond` is respond().
import { ErrorCode, ForbiddenError, isBackofficeError } from '@backoffice/errors';
import type { PrimaryKey } from '@backoffice/types';
import { Controller, Delete, Get, HttpCode, Inject, Patch, Post, Req, Res, Search } from '@nestjs/common';
import type { Request, Response } from 'express';
import getDatabase from '../database/index.js';
import { respond } from '../middleware/respond.js';
import { validateBatch } from '../middleware/validate-batch.js';
import { fetchAccountabilityCollectionAccess } from '../permissions/modules/fetch-accountability-collection-access/fetch-accountability-collection-access.js';
import type { ServiceFactory } from '../providers.js';
import { MetaService } from '../services/meta.service.js';
import { PermissionsService } from '../services/permissions.service.js';
import { runMiddleware } from '../utils/run-middleware.js';
import { sanitizeQuery } from '../utils/sanitize-query.js';

@Controller('permissions')
export class PermissionsController {
	constructor(
		@Inject(PermissionsService) private readonly permissionsService: ServiceFactory<PermissionsService>,
		@Inject(MetaService) private readonly metaService: ServiceFactory<MetaService>,
	) {}

	@Post()
	@HttpCode(200)
	async create(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.permissionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

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
				return respond(res);
			}

			throw error;
		}

		return respond(res);
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
		const service = this.permissionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const metaService = this.metaService({
			accountability: req.accountability,
			schema: req.schema,
		});

		let result;

		// TODO fix this at the service level
		// temporary fix for missing permissions https://github.com/directus/directus/issues/18654
		const temporaryQuery = { ...req.sanitizedQuery, limit: -1 };

		if (req.singleton) {
			result = await service.readSingleton(temporaryQuery);
		} else if (req.body.keys) {
			result = await service.readMany(req.body.keys, temporaryQuery);
		} else {
			result = await service.readByQuery(temporaryQuery);
		}

		const meta = await metaService.getMetaForQuery('directus_permissions', temporaryQuery);

		res.locals['payload'] = { data: result, meta };
		return respond(res);
	}

	@Get('me')
	async readMe(@Req() req: Request, @Res() res: Response): Promise<void> {
		if (!req.accountability?.user && !req.accountability?.role && !req.accountability?.share)
			throw new ForbiddenError();

		const result = await fetchAccountabilityCollectionAccess(req.accountability, {
			schema: req.schema,
			knex: getDatabase(),
		});

		res.locals['payload'] = { data: result };
		return respond(res);
	}

	@Get(':pk')
	async readOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		if (req.path.endsWith('me')) return respond(res);

		const service = this.permissionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const record = await service.readOne(req.params['pk'] as string, req.sanitizedQuery);

		res.locals['payload'] = { data: record };
		return respond(res);
	}

	@Patch()
	async updateMany(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(validateBatch('update'), req, res);

		const service = this.permissionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

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
				return respond(res);
			}

			throw error;
		}

		return respond(res);
	}

	@Patch(':pk')
	async updateOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.permissionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const primaryKey = await service.updateOne(req.params['pk'] as string, req.body);

		try {
			const item = await service.readOne(primaryKey, req.sanitizedQuery);
			res.locals['payload'] = { data: item || null };
		} catch (error: any) {
			if (isBackofficeError(error, ErrorCode.Forbidden)) {
				return respond(res);
			}

			throw error;
		}

		return respond(res);
	}

	@Delete()
	async deleteMany(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(validateBatch('delete'), req, res);

		const service = this.permissionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		if (Array.isArray(req.body)) {
			await service.deleteMany(req.body);
		} else if (req.body.keys) {
			await service.deleteMany(req.body.keys);
		} else {
			const sanitizedQuery = await sanitizeQuery(req.body.query, req.schema, req.accountability);
			await service.deleteByQuery(sanitizedQuery);
		}

		return respond(res);
	}

	@Delete(':pk')
	async deleteOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.permissionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		await service.deleteOne(req.params['pk'] as string);

		return respond(res);
	}

	// Directus: '/me/:collection/:pk?' (Express 4 optional parameter).
	@Get(['me/:collection', 'me/:collection/:pk'])
	async readItemPermissions(@Req() req: Request, @Res() res: Response): Promise<void> {
		const { collection, pk } = req.params as { collection: string; pk?: string };

		const service = this.permissionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const itemPermissions = await service.getItemPermissions(collection!, pk);

		res.locals['payload'] = { data: itemPermissions };

		return respond(res);
	}
}
