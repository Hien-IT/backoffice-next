// Ported from directus/api/src/controllers/fields.ts
// Backoffice: one Nest handler per DR route, in the same order (research R2 of spec 006). `validateCollection` is
// the collection-exists middleware (feature 005), run through runMiddleware first like in the DR router;
// useCollection('directus_fields') is applied in app.module.ts; `next()` to `respond` is respond().
import { TYPES } from '@backoffice/constants';
import { ErrorCode, ForbiddenError, InvalidPayloadError, isBackofficeError } from '@backoffice/errors';
import { isSystemField } from '@backoffice/system-data';
import type { Field, RawField, Type } from '@backoffice/types';
import { Controller, Delete, Get, HttpCode, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import Joi from 'joi';
import { ALIAS_TYPES } from '../constants.js';
import validateCollection from '../middleware/collection-exists.js';
import { respond } from '../middleware/respond.js';
import type { ServiceFactory } from '../providers.js';
import { FieldsService, systemFieldUpdateSchema } from '../services/fields.service.js';
import { runMiddleware } from '../utils/run-middleware.js';

const newFieldSchema = Joi.object({
	collection: Joi.string().optional(),
	field: Joi.string().required(),
	type: Joi.string()
		.valid(...TYPES, ...ALIAS_TYPES)
		.allow(null)
		.optional(),
	schema: Joi.object({
		default_value: Joi.any(),
		max_length: [Joi.number(), Joi.string(), Joi.valid(null)],
		is_nullable: Joi.bool(),
	})
		.unknown()
		.allow(null),
	meta: Joi.any(),
});

const updateSchema = Joi.object({
	type: Joi.string()
		.valid(...TYPES, ...ALIAS_TYPES)
		.allow(null),
	schema: Joi.object({
		default_value: Joi.any(),
		max_length: [Joi.number(), Joi.string(), Joi.valid(null)],
		is_nullable: Joi.bool(),
	})
		.unknown()
		.allow(null),
	meta: Joi.any(),
}).unknown();

const concurrentIndex = (req: Request) =>
	'concurrentIndexCreation' in req.query && req.query['concurrentIndexCreation'] !== 'false';

@Controller('fields')
export class FieldsController {
	constructor(@Inject(FieldsService) private readonly fieldsService: ServiceFactory<FieldsService>) {}

	private service(req: Request): FieldsService {
		return this.fieldsService({
			accountability: req.accountability,
			schema: req.schema,
		});
	}

	@Get()
	async readAll(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.service(req);

		const fields = await service.readAll();

		res.locals['payload'] = { data: fields || null };
		return respond(req, res);
	}

	@Get(':collection')
	async readCollection(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(validateCollection, req, res);
		const service = this.service(req);

		const fields = await service.readAll(req.params['collection'] as string);

		res.locals['payload'] = { data: fields || null };
		return respond(req, res);
	}

	@Get(':collection/:field')
	async readOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(validateCollection, req, res);
		const service = this.service(req);

		const field = await service.readOne(req.params['collection'] as string, req.params['field'] as string);

		res.locals['payload'] = { data: field || null };
		return respond(req, res);
	}

	@Post(':collection')
	@HttpCode(200)
	async create(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(validateCollection, req, res);
		const service = this.service(req);

		const { error } = newFieldSchema.validate(req.body);

		if (error) {
			throw new InvalidPayloadError({ reason: error.message });
		}

		const field: Partial<Field> & { field: string; type: Type | null } = req.body;

		await service.createField(req.params['collection'] as string, field, undefined, {
			attemptConcurrentIndex: concurrentIndex(req),
		});

		try {
			const createdField = await service.readOne(req.params['collection'] as string, field.field);
			res.locals['payload'] = { data: createdField || null };
		} catch (error: any) {
			if (isBackofficeError(error, ErrorCode.Forbidden)) {
				return respond(req, res);
			}

			throw error;
		}

		return respond(req, res);
	}

	@Patch(':collection')
	async updateMany(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(validateCollection, req, res);
		const service = this.service(req);

		if (Array.isArray(req.body) === false) {
			throw new InvalidPayloadError({ reason: 'Submitted body has to be an array' });
		}

		for (const fieldData of req.body) {
			if (isSystemField(req.params['collection'] as string, fieldData['field']!)) {
				const { error } = systemFieldUpdateSchema.safeParse(fieldData);

				if (error) {
					throw new InvalidPayloadError({ reason: 'Only "schema.is_indexed" may be modified for system fields' });
				}
			}
		}

		await service.updateFields(req.params['collection'] as string, req.body, {
			attemptConcurrentIndex: concurrentIndex(req),
		});

		try {
			const results: any = [];

			for (const field of req.body) {
				const updatedField = await service.readOne(req.params['collection'] as string, field.field);
				results.push(updatedField);
				res.locals['payload'] = { data: results || null };
			}
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

		if (isSystemField(req.params['collection'] as string, req.params['field'] as string)) {
			const { error } = systemFieldUpdateSchema.safeParse(req.body);

			if (error) {
				throw new InvalidPayloadError({ reason: 'Only "schema.is_indexed" may be modified for system fields' });
			}
		} else {
			const { error } = updateSchema.validate(req.body);

			if (error) throw new InvalidPayloadError({ reason: error.message });
		}

		const fieldData: RawField = req.body;

		if (!fieldData.field) fieldData.field = req.params['field'] as string;

		await service.updateField(req.params['collection'] as string, fieldData, {
			attemptConcurrentIndex: concurrentIndex(req),
		});

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

		if (isSystemField(req.params['collection'] as string, req.params['field'] as string)) {
			throw new ForbiddenError();
		}

		await service.deleteField(req.params['collection'] as string, req.params['field'] as string);
		return respond(req, res);
	}
}
