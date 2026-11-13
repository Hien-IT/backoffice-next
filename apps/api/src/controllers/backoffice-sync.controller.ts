// Backoffice (spec 032, D-214, contracts/api.md): environment sync under /backoffice/ (D-189.6). DR has no such route
// (404). Admin only; the URL and the token of the source only travel in POST bodies, never in a query string (FR-003).
import { ForbiddenError, InvalidCredentialsError, InvalidPayloadError } from '@backoffice/errors';
import { Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import Joi from 'joi';
import { respond } from '../middleware/respond.js';
import type { ServiceFactory } from '../providers.js';
import { BackofficeSyncService, parseGroups } from '../services/backoffice-sync.service.js';
import { GROUP_KEYS } from '../sync/types.js';

const connection = {
	url: Joi.string().min(1).max(2048).required(),
	token: Joi.string().min(1).max(4096).required(),
	groups: Joi.array()
		.items(Joi.string().valid(...GROUP_KEYS))
		.unique(),
};

export const diffBody = Joi.object(connection).unknown(false);

@Controller('backoffice/sync')
export class BackofficeSyncController {
	constructor(
		@Inject(BackofficeSyncService)
		private readonly backofficeSyncService: ServiceFactory<BackofficeSyncService>,
	) {}

	private service(req: Request, res: Response): BackofficeSyncService {
		if (!req.accountability?.user) throw new InvalidCredentialsError();
		if (!req.accountability.admin) throw new ForbiddenError();
		// Never kept by the shared response cache: the answers carry config of another instance.
		res.locals['cache'] = false;
		return this.backofficeSyncService({ accountability: req.accountability, schema: req.schema });
	}

	/** Instance info; also the probe of the web page (DR answers 404). */
	@Get()
	async info(@Req() req: Request, @Res() res: Response): Promise<void> {
		res.locals['payload'] = { data: await this.service(req, res).info() };
		return respond(req, res);
	}

	@Get('state')
	async state(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.service(req, res);
		res.locals['payload'] = { data: await service.state(parseGroups(req.query['groups'])) };
		return respond(req, res);
	}

	@Post('diff')
	@HttpCode(200)
	async diff(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.service(req, res);
		const { error, value } = diffBody.validate(req.body ?? {});
		if (error) throw new InvalidPayloadError({ reason: error.message });

		res.locals['payload'] = { data: await service.diff(value) };
		return respond(req, res);
	}
}
