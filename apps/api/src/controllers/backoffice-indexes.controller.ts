// Backoffice (spec 030, D-210, contracts/api.md): the indexes of a user collection under /backoffice/ (D-189.6). DR
// has no such route (404). Admin only; POST answers 202 and the index is built by an in-process job.
import { ForbiddenError, InvalidCredentialsError, InvalidPayloadError } from '@backoffice/errors';
import { Controller, Delete, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import Joi from 'joi';
import { respond } from '../middleware/respond.js';
import type { ServiceFactory } from '../providers.js';
import { BackofficeIndexesService, MAX_FIELDS } from '../services/backoffice-indexes.service.js';

const bodySchema = Joi.object({
	fields: Joi.array().items(Joi.string().min(1)).min(1).max(MAX_FIELDS).required(),
	type: Joi.string().valid('btree', 'trigram'),
	unique: Joi.boolean(),
}).unknown(false);

/** Like `concurrentIndexCreation` of /fields, but on by default (FR-008): only `=false` turns it off. */
export function wantsConcurrent(req: Request): boolean {
	return req.query['concurrentIndexCreation'] !== 'false';
}

@Controller('backoffice/collections')
export class BackofficeIndexesController {
	constructor(
		@Inject(BackofficeIndexesService)
		private readonly backofficeIndexesService: ServiceFactory<BackofficeIndexesService>,
	) {}

	private service(req: Request, res: Response): BackofficeIndexesService {
		if (!req.accountability?.user) throw new InvalidCredentialsError();
		if (!req.accountability.admin) throw new ForbiddenError();
		// The shared response cache never keeps an answer: the status of a row changes behind it.
		res.locals['cache'] = false;
		return this.backofficeIndexesService({ accountability: req.accountability, schema: req.schema });
	}

	@Get(':collection/indexes')
	async list(@Req() req: Request, @Res() res: Response): Promise<void> {
		res.locals['payload'] = await this.service(req, res).list(req.params['collection'] as string);
		return respond(req, res);
	}

	@Post(':collection/indexes')
	@HttpCode(202)
	async create(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.service(req, res);
		const { error } = bodySchema.validate(req.body ?? {});
		if (error) throw new InvalidPayloadError({ reason: error.message });

		const data = await service.create(req.params['collection'] as string, req.body, {
			attemptConcurrentIndex: wantsConcurrent(req),
		});

		res.locals['payload'] = { data };
		return respond(req, res);
	}

	@Delete(':collection/indexes/:name')
	async remove(@Req() req: Request, @Res() res: Response): Promise<void> {
		await this.service(req, res).remove(req.params['collection'] as string, req.params['name'] as string);
		return respond(req, res);
	}
}
