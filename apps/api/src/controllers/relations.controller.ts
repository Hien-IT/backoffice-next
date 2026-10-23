// Ported from directus/api/src/controllers/relations.ts
// Backoffice: one Nest handler per DR route, in the same order (research R2 of spec 006). `validateCollection` is
// the collection-exists middleware (feature 005) run through runMiddleware; useCollection('directus_relations') is
// applied in app.module.ts; `next()` to `respond` is respond().
import { ErrorCode, InvalidPayloadError, isBackofficeError } from '@backoffice/errors';
import { Controller, Delete, Get, HttpCode, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import Joi from 'joi';
import validateCollection from '../middleware/collection-exists.js';
import { respond } from '../middleware/respond.js';
import type { ServiceFactory } from '../providers.js';
import { RelationsService } from '../services/relations.service.js';
import { runMiddleware } from '../utils/run-middleware.js';

const newRelationSchema = Joi.object({
	collection: Joi.string().required(),
	field: Joi.string().required(),
	related_collection: Joi.string().allow(null).optional(),
	schema: Joi.object({
		on_delete: Joi.string().valid('NO ACTION', 'SET NULL', 'SET DEFAULT', 'CASCADE', 'RESTRICT'),
	})
		.unknown()
		.allow(null),
	meta: Joi.any(),
});

const updateRelationSchema = Joi.object({
	collection: Joi.string().optional(),
	field: Joi.string().optional(),
	related_collection: Joi.string().allow(null).optional(),
	schema: Joi.object({
		on_delete: Joi.string().valid('NO ACTION', 'SET NULL', 'SET DEFAULT', 'CASCADE', 'RESTRICT'),
	})
		.unknown()
		.allow(null),
	meta: Joi.any(),
});

@Controller('relations')
export class RelationsController {
	constructor(@Inject(RelationsService) private readonly relationsService: ServiceFactory<RelationsService>) {}

	private service(req: Request): RelationsService {
		return this.relationsService({
			accountability: req.accountability,
			schema: req.schema,
		});
	}

	@Get()
	async readAll(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.service(req);

		const relations = await service.readAll();
		res.locals['payload'] = { data: relations || null };
		return respond(req, res);
	}

	@Get(':collection')
	async readCollection(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(validateCollection, req, res);
		const service = this.service(req);

		const relations = await service.readAll(req.params['collection'] as string);

		res.locals['payload'] = { data: relations || null };
		return respond(req, res);
	}

	@Get(':collection/:field')
	async readOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(validateCollection, req, res);
		const service = this.service(req);

		const relation = await service.readOne(req.params['collection'] as string, req.params['field'] as string);

		res.locals['payload'] = { data: relation || null };
		return respond(req, res);
	}

	@Post()
	@HttpCode(200)
	async create(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.service(req);

		const { error } = newRelationSchema.validate(req.body);

		if (error) {
			throw new InvalidPayloadError({ reason: error.message });
		}

		await service.createOne(req.body);

		try {
			const createdRelation = await service.readOne(req.body.collection, req.body.field);
			res.locals['payload'] = { data: createdRelation || null };
		} catch (error: any) {
			if (isBackofficeError(error, ErrorCode.Forbidden)) {
				return respond(req, res);
			}

			throw error;
		}

		return respond(req, res);
	}

	@Patch(':collection/:field')
	async updateOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(validateCollection, req, res);
		const service = this.service(req);

		const { error } = updateRelationSchema.validate(req.body);

		if (error) {
			throw new InvalidPayloadError({ reason: error.message });
		}

		await service.updateOne(req.params['collection'] as string, req.params['field'] as string, req.body);

		try {
			const updatedField = await service.readOne(req.params['collection'] as string, req.params['field'] as string);
			res.locals['payload'] = { data: updatedField || null };
		} catch (error: any) {
			if (isBackofficeError(error, ErrorCode.Forbidden)) {
				return respond(req, res);
			}

			throw error;
		}

		return respond(req, res);
	}

	@Delete(':collection/:field')
	async deleteOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(validateCollection, req, res);
		const service = this.service(req);

		await service.deleteOne(req.params['collection'] as string, req.params['field'] as string);
		return respond(req, res);
	}
}
