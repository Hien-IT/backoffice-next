// Ported from directus/api/src/controllers/shares.ts
// Backoffice: one Nest handler per Directus route, in the same order (research R4, R16 of spec 010); validateBatch runs
// through runMiddleware, useCollection('directus_shares') is applied in app.module.ts, `next()` to `respond` is
// respond(). Express 5 has no regex params: `/info/:pk` and `/:pk` check the uuid in the handler (404 otherwise, like
// Express 4 where no route matches), case insensitive like Express 4.
import { useEnv } from '@backoffice/env';
import { ErrorCode, InvalidPayloadError, isBackofficeError } from '@backoffice/errors';
import type { PrimaryKey } from '@backoffice/types';
import { Controller, Delete, Get, HttpCode, Inject, Patch, Post, Req, Res, Search } from '@nestjs/common';
import type { Request, Response } from 'express';
import Joi from 'joi';
import { refreshCookieOptions, sessionCookieOptions } from '../constants.js';
import { respond } from '../middleware/respond.js';
import { validateBatch } from '../middleware/validate-batch.js';
import type { ServiceFactory } from '../providers.js';
import { SharesService } from '../services/shares.service.js';
import type { AuthenticationMode } from '../types/auth.js';
import { runMiddleware } from '../utils/run-middleware.js';
import { sanitizeQuery } from '../utils/sanitize-query.js';
import { uuidParam } from '../utils/uuid-param.js';

const sharedLoginSchema = Joi.object({
	share: Joi.string().required(),
	password: Joi.string(),
	mode: Joi.string().valid('cookie', 'json', 'session').optional(),
}).unknown();

const sharedInviteSchema = Joi.object({
	share: Joi.string().required(),
	emails: Joi.array().items(Joi.string()),
}).unknown();


@Controller('shares')
export class SharesController {
	constructor(@Inject(SharesService) private readonly sharesService: ServiceFactory<SharesService>) {}

	private service(req: Request): SharesService {
		return this.sharesService({
			accountability: req.accountability,
			schema: req.schema,
		});
	}

	@Post('auth')
	@HttpCode(200)
	async auth(@Req() req: Request, @Res() res: Response): Promise<void> {
		const env = useEnv();

		// This doesn't use accountability, as the user isn't logged in at this point
		const service = this.sharesService({
			schema: req.schema,
		});

		const { error } = sharedLoginSchema.validate(req.body);

		if (error) {
			throw new InvalidPayloadError({ reason: error.message });
		}

		const mode: AuthenticationMode = req.body.mode ?? 'json';

		const { accessToken, refreshToken, expires } = await service.login(req.body, {
			session: mode === 'session',
		});

		const payload = { expires } as { expires: number; access_token?: string; refresh_token?: string };

		if (mode === 'json') {
			payload.refresh_token = refreshToken;
			payload.access_token = accessToken;
		}

		if (mode === 'cookie') {
			res.cookie(env['REFRESH_TOKEN_COOKIE_NAME'] as string, refreshToken, refreshCookieOptions());
			payload.access_token = accessToken;
		}

		if (mode === 'session') {
			res.cookie(env['SESSION_COOKIE_NAME'] as string, accessToken, sessionCookieOptions());
		}

		res.locals['payload'] = { data: payload };

		return respond(req, res);
	}

	@Post('invite')
	@HttpCode(200)
	async invite(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.service(req);

		const { error } = sharedInviteSchema.validate(req.body);

		if (error) {
			throw new InvalidPayloadError({ reason: error.message });
		}

		await service.invite(req.body);

		return respond(req, res);
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

		const records = await service.readByQuery(req.sanitizedQuery);

		res.locals['payload'] = { data: records || null };
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

	@Get('info/:pk')
	async info(@Req() req: Request, @Res() res: Response): Promise<void> {
		const pk = uuidParam(req);

		const service = this.sharesService({
			schema: req.schema,
		});

		const record = await service.readOne(pk, {
			fields: ['id', 'collection', 'item', 'password', 'max_uses', 'times_used', 'date_start', 'date_end'],
			filter: {
				_and: [
					{
						_or: [
							{
								date_start: {
									_lte: new Date().toISOString(),
								},
							},
							{
								date_start: {
									_null: true,
								},
							},
						],
					},
					{
						_or: [
							{
								date_end: {
									_gte: new Date().toISOString(),
								},
							},
							{
								date_end: {
									_null: true,
								},
							},
						],
					},
				],
			},
		});

		res.locals['payload'] = { data: record || null };
		return respond(req, res);
	}

	@Get(':pk')
	async readOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		const pk = uuidParam(req);
		const service = this.service(req);

		const record = await service.readOne(pk, req.sanitizedQuery);

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
		const pk = uuidParam(req);
		const service = this.service(req);

		const primaryKey = await service.updateOne(pk, req.body);

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

	// Backoffice: no validateBatch('delete') here, like the Directus router of this collection.
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
		const pk = uuidParam(req);
		const service = this.service(req);

		await service.deleteOne(pk);

		return respond(req, res);
	}
}
