// Ported from directus/api/src/auth/drivers/local.ts
import { performance } from 'perf_hooks';
import { useEnv } from '@backoffice/env';
import { InvalidCredentialsError, InvalidPayloadError } from '@backoffice/errors';
import type { Accountability } from '@backoffice/types';
import argon2 from 'argon2';
import type { Request, Response } from 'express';
import Joi from 'joi';
import { refreshCookieOptions, sessionCookieOptions } from '../../constants.js';
import { createDefaultAccountability } from '../../permissions/utils/create-default-accountability.js';
import { AuthenticationService } from '../../services/authentication.service.js';
import type { AuthenticationMode, User } from '../../types/index.js';
import { getIPFromReq } from '../../utils/get-ip-from-req.js';
import { stall } from '../../utils/stall.js';
import { AuthDriver } from '../auth.js';

export class LocalAuthDriver extends AuthDriver {
	async getUserID(payload: Record<string, any>): Promise<string> {
		if (!payload['email']) {
			throw new InvalidCredentialsError();
		}

		const user = await this.knex
			.select('id')
			.from('directus_users')
			.whereRaw('LOWER(??) = ?', ['email', payload['email'].toLowerCase()])
			.first();

		if (!user) {
			throw new InvalidCredentialsError();
		}

		return user.id;
	}

	async verify(user: User, password?: string): Promise<void> {
		if (!user.password || !(await argon2.verify(user.password, password as string))) {
			throw new InvalidCredentialsError();
		}
	}

	override async login(user: User, payload: Record<string, any>): Promise<void> {
		await this.verify(user, payload['password']);
	}
}

/**
 * The `POST /` handler of `createLocalAuthRouter`, as a function the AuthController calls (research R3 of spec 003).
 * It leaves the response in `res.locals.payload`, like the router before `respond`.
 */
export function createLocalAuthRouter(provider: string): { login: (req: Request, res: Response) => Promise<void> } {
	const env = useEnv();

	const userLoginSchema = Joi.object({
		email: Joi.string().email().required(),
		password: Joi.string().required(),
		mode: Joi.string().valid('cookie', 'json', 'session'),
		otp: Joi.string(),
	}).unknown();

	return {
		async login(req, res) {
			const STALL_TIME = env['LOGIN_STALL_TIME'] as number;
			const timeStart = performance.now();

			const accountability: Accountability = createDefaultAccountability({
				ip: getIPFromReq(req),
			});

			const userAgent = req.get('user-agent')?.substring(0, 1024);
			if (userAgent) accountability.userAgent = userAgent;

			const origin = req.get('origin');
			if (origin) accountability.origin = origin;

			const authenticationService = new AuthenticationService({
				accountability: accountability,
				schema: req.schema,
			});

			const { error } = userLoginSchema.validate(req.body);

			if (error) {
				await stall(STALL_TIME, timeStart);
				throw new InvalidPayloadError({ reason: error.message });
			}

			const mode: AuthenticationMode = req.body.mode ?? 'json';

			const { accessToken, refreshToken, expires } = await authenticationService.login(provider, req.body, {
				session: mode === 'session',
				otp: req.body?.otp,
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
		},
	};
}
