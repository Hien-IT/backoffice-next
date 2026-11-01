// Backoffice (spec 029, D-207, contracts/api.md): passkey login and management under /backoffice/ (D-189.6). DR has
// no such route (404). With PUBLIC_URL unusable as an RP ID every route answers 404 too (FR-026).
import { performance } from 'perf_hooks';
import { useEnv } from '@backoffice/env';
import { ForbiddenError, InvalidCredentialsError, InvalidPayloadError, RouteNotFoundError } from '@backoffice/errors';
import type { Accountability } from '@backoffice/types';
import { Controller, Delete, Get, HttpCode, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import Joi from 'joi';
import { getPasskeyRp } from '../auth/passkey/rp.js';
import { refreshCookieOptions, sessionCookieOptions } from '../constants.js';
import { respond } from '../middleware/respond.js';
import { createDefaultAccountability } from '../permissions/utils/create-default-accountability.js';
import type { ServiceFactory } from '../providers.js';
import { PasskeyService } from '../services/passkey.service.js';
import type { AuthenticationMode } from '../types/index.js';
import { getIPFromReq } from '../utils/get-ip-from-req.js';
import { stall } from '../utils/stall.js';

const loginSchema = Joi.object({
	response: Joi.object({ id: Joi.string().required(), response: Joi.object().required() }).unknown().required(),
	mode: Joi.string().valid('cookie', 'json', 'session'),
}).unknown();

const optionsSchema = Joi.object({ password: Joi.string().required() }).unknown();

const registerSchema = Joi.object({
	response: Joi.object({ id: Joi.string().required(), response: Joi.object().required() }).unknown().required(),
	name: Joi.string().trim().min(1).max(100).required(),
}).unknown();

const renameSchema = Joi.object({ name: Joi.string().trim().min(1).max(100).required() }).unknown();

function validate(schema: Joi.ObjectSchema, body: unknown): void {
	const { error } = schema.validate(body ?? {});
	if (error) throw new InvalidPayloadError({ reason: error.message });
}

@Controller('backoffice')
export class BackofficePasskeysController {
	constructor(@Inject(PasskeyService) private readonly passkeyService: ServiceFactory<PasskeyService>) {}

	private enabled(req: Request): void {
		if (!getPasskeyRp()) throw new RouteNotFoundError({ path: req.path });
	}

	private service(req: Request, accountability: Accountability | null = req.accountability ?? null) {
		return this.passkeyService({ accountability, schema: req.schema });
	}

	/** Like /users/me/tfa/*: any token of a user (session, JSON or static). */
	private me(req: Request): string {
		this.enabled(req);
		if (!req.accountability?.user) throw new InvalidCredentialsError();
		return req.accountability.user;
	}

	private admin(req: Request): void {
		this.enabled(req);
		if (!req.accountability?.user) throw new InvalidCredentialsError();
		if (!req.accountability.admin) throw new ForbiddenError();
	}

	private noCache(res: Response): void {
		// The shared response cache never keeps a passkey answer (it depends on the caller).
		res.locals['cache'] = false;
	}

	@Get('auth/passkey')
	async rp(@Req() req: Request, @Res() res: Response): Promise<void> {
		const rp = getPasskeyRp();
		if (!rp) throw new RouteNotFoundError({ path: req.path });
		this.noCache(res);
		res.locals['payload'] = { data: { rp_id: rp.rpId } };
		return respond(req, res);
	}

	@Post('auth/passkey/login/options')
	@HttpCode(200)
	async loginOptions(@Req() req: Request, @Res() res: Response): Promise<void> {
		this.enabled(req);
		res.locals['payload'] = { data: await this.service(req, null).loginOptions() };
		return respond(req, res);
	}

	/** The response and cookies of POST /auth/login for the same `mode` (auth/drivers/local.ts). */
	@Post('auth/passkey/login')
	@HttpCode(200)
	async login(@Req() req: Request, @Res() res: Response): Promise<void> {
		this.enabled(req);
		const env = useEnv();
		const timeStart = performance.now();

		try {
			validate(loginSchema, req.body);
		} catch (error) {
			await stall(env['LOGIN_STALL_TIME'] as number, timeStart);
			throw error;
		}

		const accountability: Accountability = createDefaultAccountability({ ip: getIPFromReq(req) });
		const userAgent = req.get('user-agent')?.substring(0, 1024);
		if (userAgent) accountability.userAgent = userAgent;
		const origin = req.get('origin');
		if (origin) accountability.origin = origin;

		const mode: AuthenticationMode = req.body.mode ?? 'json';
		const { accessToken, refreshToken, expires } = await this.service(req, accountability).login(
			req.body.response,
			mode,
		);

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

	// The `me` routes come before `:pk` so "me" is never read as a user id.
	@Get('users/me/passkeys')
	async list(@Req() req: Request, @Res() res: Response): Promise<void> {
		const user = this.me(req);
		this.noCache(res);
		res.locals['payload'] = { data: await this.service(req).list(user) };
		return respond(req, res);
	}

	@Post('users/me/passkeys/options')
	@HttpCode(200)
	async registrationOptions(@Req() req: Request, @Res() res: Response): Promise<void> {
		const user = this.me(req);
		validate(optionsSchema, req.body);
		res.locals['payload'] = { data: await this.service(req).registrationOptions(user, req.body.password) };
		return respond(req, res);
	}

	@Post('users/me/passkeys')
	@HttpCode(200)
	async register(@Req() req: Request, @Res() res: Response): Promise<void> {
		const user = this.me(req);
		validate(registerSchema, req.body);
		res.locals['payload'] = { data: await this.service(req).register(user, req.body.response, req.body.name) };
		return respond(req, res);
	}

	@Patch('users/me/passkeys/:id')
	async rename(@Req() req: Request, @Res() res: Response): Promise<void> {
		const user = this.me(req);
		validate(renameSchema, req.body);
		res.locals['payload'] = { data: await this.service(req).rename(user, req.params['id'] as string, req.body.name) };
		return respond(req, res);
	}

	@Delete('users/me/passkeys/:id')
	async remove(@Req() req: Request, @Res() res: Response): Promise<void> {
		const user = this.me(req);
		await this.service(req).remove(user, req.params['id'] as string);
		return respond(req, res);
	}

	@Get('users/:pk/passkeys')
	async listForAdmin(@Req() req: Request, @Res() res: Response): Promise<void> {
		this.admin(req);
		this.noCache(res);
		res.locals['payload'] = { data: await this.service(req).listForAdmin(req.params['pk'] as string) };
		return respond(req, res);
	}

	@Delete('users/:pk/passkeys/:id')
	async removeForAdmin(@Req() req: Request, @Res() res: Response): Promise<void> {
		this.admin(req);
		await this.service(req).removeForAdmin(req.params['pk'] as string, req.params['id'] as string);
		return respond(req, res);
	}
}
