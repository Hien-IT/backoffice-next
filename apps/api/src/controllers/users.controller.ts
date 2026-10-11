// Ported from directus/api/src/controllers/users.ts
// Backoffice: one Nest handler per Directus route, in the same order (like roles.controller.ts).
import {
	ErrorCode,
	ForbiddenError,
	InvalidCredentialsError,
	InvalidPayloadError,
	isBackofficeError,
} from '@backoffice/errors';
import type { PrimaryKey, RegisterUserInput } from '@backoffice/types';
import { Controller, Delete, Get, HttpCode, Inject, Patch, Post, Req, Res, Search } from '@nestjs/common';
import type { Request, Response } from 'express';
import Joi from 'joi';
import { DEFAULT_AUTH_PROVIDER } from '../constants.js';
import getDatabase from '../database/index.js';
import checkRateLimit from '../middleware/rate-limiter-registration.js';
import { respond } from '../middleware/respond.js';
import { validateBatch } from '../middleware/validate-batch.js';
import type { ServiceFactory } from '../providers.js';
import { AuthenticationService } from '../services/authentication.service.js';
import { MetaService } from '../services/meta.service.js';
import { TFAService } from '../services/tfa.service.js';
import { UsersService } from '../services/users.service.js';
import { runMiddleware } from '../utils/run-middleware.js';
import { sanitizeQuery } from '../utils/sanitize-query.js';

const inviteSchema = Joi.object({
	email: Joi.alternatives(Joi.string().email(), Joi.array().items(Joi.string().email())).required(),
	role: Joi.string().uuid({ version: 'uuidv4' }).required(),
	invite_url: Joi.string().uri(),
});

const acceptInviteSchema = Joi.object({
	token: Joi.string().required(),
	password: Joi.string().required(),
});

const registerSchema = Joi.object<RegisterUserInput>({
	email: Joi.string().email().required(),
	password: Joi.string().required(),
	verification_url: Joi.string().uri(),
	first_name: Joi.string(),
	last_name: Joi.string(),
});

const verifyRegistrationSchema = Joi.string();

@Controller('users')
export class UsersController {
	constructor(
		@Inject(TFAService) private readonly tfaService: ServiceFactory<TFAService>,
		@Inject(AuthenticationService) private readonly authenticationService: ServiceFactory<AuthenticationService>,
		@Inject(UsersService) private readonly usersService: ServiceFactory<UsersService>,
		@Inject(MetaService) private readonly metaService: ServiceFactory<MetaService>,
	) {}

	@Post()
	@HttpCode(200)
	async create(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.usersService({
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
		const service = this.usersService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const metaService = this.metaService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const item = await service.readByQuery(req.sanitizedQuery);
		const meta = await metaService.getMetaForQuery('directus_users', req.sanitizedQuery);

		res.locals['payload'] = { data: item || null, meta };
		return respond(res);
	}

	@Get('me')
	async readMe(@Req() req: Request, @Res() res: Response): Promise<void> {
		if (req.accountability?.share) {
			res.locals['payload'] = {
				data: {
					share: req.accountability?.share,
				},
			};

			return respond(res);
		}

		if (!req.accountability?.user) {
			throw new InvalidCredentialsError();
		}

		const service = this.usersService({
			accountability: req.accountability,
			schema: req.schema,
		});

		try {
			const item = await service.readOne(req.accountability.user, req.sanitizedQuery);
			res.locals['payload'] = { data: item || null };
		} catch (error: any) {
			if (isBackofficeError(error, ErrorCode.Forbidden)) {
				res.locals['payload'] = { data: { id: req.accountability.user } };
				return respond(res);
			}

			throw error;
		}

		return respond(res);
	}

	@Get(':pk')
	async readOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		if (req.path.endsWith('me')) return respond(res);

		const service = this.usersService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const items = await service.readOne(req.params['pk'] as string, req.sanitizedQuery);

		res.locals['payload'] = { data: items || null };
		return respond(res);
	}

	@Patch('me')
	async updateMe(@Req() req: Request, @Res() res: Response): Promise<void> {
		if (!req.accountability?.user) {
			throw new InvalidCredentialsError();
		}

		const service = this.usersService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const primaryKey = await service.updateOne(req.accountability.user, req.body);
		const item = await service.readOne(primaryKey, req.sanitizedQuery);

		res.locals['payload'] = { data: item || null };
		return respond(res);
	}

	@Patch('me/track/page')
	async trackPage(@Req() req: Request, @Res() res: Response): Promise<void> {
		if (!req.accountability?.user) {
			throw new InvalidCredentialsError();
		}

		if (!req.body.last_page) {
			throw new InvalidPayloadError({ reason: `"last_page" key is required` });
		}

		const service = this.usersService({ schema: req.schema });
		await service.updateOne(req.accountability.user, { last_page: req.body.last_page }, { autoPurgeCache: false });

		return respond(res);
	}

	@Patch()
	async updateMany(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(validateBatch('update'), req, res);

		const service = this.usersService({
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
		const service = this.usersService({
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

		const service = this.usersService({
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
		const service = this.usersService({
			accountability: req.accountability,
			schema: req.schema,
		});

		await service.deleteOne(req.params['pk'] as string);

		return respond(res);
	}

	@Post('invite')
	@HttpCode(200)
	async invite(@Req() req: Request, @Res() res: Response): Promise<void> {
		const { error } = inviteSchema.validate(req.body);
		if (error) throw new InvalidPayloadError({ reason: error.message });

		const service = this.usersService({
			accountability: req.accountability,
			schema: req.schema,
		});

		await service.inviteUser(req.body.email, req.body.role, req.body.invite_url || null);
		return respond(res);
	}

	@Post('invite/accept')
	@HttpCode(200)
	async acceptInvite(@Req() req: Request, @Res() res: Response): Promise<void> {
		const { error } = acceptInviteSchema.validate(req.body);
		if (error) throw new InvalidPayloadError({ reason: error.message });

		const service = this.usersService({
			accountability: req.accountability,
			schema: req.schema,
		});

		await service.acceptInvite(req.body.token, req.body.password);
		return respond(res);
	}

	@Post('me/tfa/generate')
	@HttpCode(200)
	async generateTFA(@Req() req: Request, @Res() res: Response): Promise<void> {
		if (!req.accountability?.user) {
			throw new InvalidCredentialsError();
		}

		const currentUser = await getDatabase()
			.select('provider')
			.from('directus_users')
			.where({ id: req.accountability.user })
			.first();

		const requiresPassword = currentUser?.['provider'] === DEFAULT_AUTH_PROVIDER;

		if (requiresPassword && !req.body.password) {
			throw new InvalidPayloadError({ reason: `"password" is required` });
		}

		const service = this.tfaService({
			accountability: req.accountability,
			schema: req.schema,
		});

		if (requiresPassword) {
			const authService = this.authenticationService({
				accountability: req.accountability,
				schema: req.schema,
			});

			await authService.verifyPassword(req.accountability.user, req.body.password);
		}

		const { url, secret } = await service.generateTFA(req.accountability.user, requiresPassword);

		res.locals['payload'] = { data: { secret, otpauth_url: url } };
		respond(res);
	}

	@Post('me/tfa/enable')
	@HttpCode(200)
	async enableTFA(@Req() req: Request, @Res() res: Response): Promise<void> {
		if (!req.accountability?.user) {
			throw new InvalidCredentialsError();
		}

		if (!req.body.secret) {
			throw new InvalidPayloadError({ reason: `"secret" is required` });
		}

		if (!req.body.otp) {
			throw new InvalidPayloadError({ reason: `"otp" is required` });
		}

		const service = this.tfaService({
			accountability: req.accountability,
			schema: req.schema,
		});

		await service.enableTFA(req.accountability.user, req.body.otp, req.body.secret);

		return respond(res);
	}

	@Post('me/tfa/disable')
	@HttpCode(200)
	async disableTFA(@Req() req: Request, @Res() res: Response): Promise<void> {
		if (!req.accountability?.user) {
			throw new InvalidCredentialsError();
		}

		if (!req.body.otp) {
			throw new InvalidPayloadError({ reason: `"otp" is required` });
		}

		const service = this.tfaService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const otpValid = await service.verifyOTP(req.accountability.user, req.body.otp);

		if (otpValid === false) {
			throw new InvalidPayloadError({ reason: `"otp" is invalid` });
		}

		await service.disableTFA(req.accountability.user);
		return respond(res);
	}

	@Post(':pk/tfa/disable')
	@HttpCode(200)
	async disableUserTFA(@Req() req: Request, @Res() res: Response): Promise<void> {
		if (!req.accountability?.user) {
			throw new InvalidCredentialsError();
		}

		if (!req.accountability.admin || !req.params['pk']) {
			throw new ForbiddenError();
		}

		const service = this.tfaService({
			accountability: req.accountability,
			schema: req.schema,
		});

		await service.disableTFA(req.params['pk'] as string);
		return respond(res);
	}

	@Post('register')
	@HttpCode(200)
	async register(@Req() req: Request, @Res() res: Response): Promise<void> {
		await runMiddleware(checkRateLimit, req, res);

		const { error, value } = registerSchema.validate(req.body);
		if (error) throw new InvalidPayloadError({ reason: error.message });

		const usersService = this.usersService({ accountability: null, schema: req.schema });
		await usersService.registerUser(value);

		return respond(res);
	}

	@Get('register/verify-email')
	async verifyEmail(@Req() req: Request, @Res() res: Response): Promise<void> {
		const { error, value } = verifyRegistrationSchema.validate(req.query['token']);

		if (error) {
			return res.redirect('/admin/login');
		}

		const service = this.usersService({ accountability: null, schema: req.schema });
		const id = await service.verifyRegistration(value);

		return res.redirect(`/admin/users/${id}`);
	}
}
