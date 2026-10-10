// Ported from directus/api/src/controllers/auth.ts. Each driver router of Directus is a handler object in its driver
// file (research R3 of spec 003): a provider without a handler for the method and path is a 404, like a request that
// falls through the Express routers.
import { useEnv } from '@backoffice/env';
import { ErrorCode, InvalidPayloadError, isBackofficeError, RouteNotFoundError } from '@backoffice/errors';
import type { Accountability } from '@backoffice/types';
import { Controller, HttpCode, Inject, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { memoize } from 'lodash-es';
import { createLocalAuthRouter } from '../auth/drivers/local.js';
import { DEFAULT_AUTH_PROVIDER, refreshCookieOptions, sessionCookieOptions } from '../constants.js';
import { useLogger } from '../logger/index.js';
import { respond } from '../middleware/respond.js';
import { createDefaultAccountability } from '../permissions/utils/create-default-accountability.js';
import type { ServiceFactory } from '../providers.js';
import { AuthenticationService } from '../services/authentication.service.js';
import { UsersService } from '../services/users.service.js';
import type { AuthenticationMode } from '../types/auth.js';
import { clearCookie } from '../utils/clear-cookie.js';
import { getAuthProviders } from '../utils/get-auth-providers.js';
import { getIPFromReq } from '../utils/get-ip-from-req.js';
import { getSecret } from '../utils/get-secret.js';
import isDirectusJWT from '../utils/is-directus-jwt.js';
import { verifyAccessJWT } from '../utils/jwt.js';

function getCurrentMode(req: Request): AuthenticationMode {
	if (req.body.mode) {
		return req.body.mode as AuthenticationMode;
	}

	if (req.body.refresh_token) {
		return 'json';
	}

	return 'cookie';
}

function getCurrentRefreshToken(req: Request, mode: AuthenticationMode): string | undefined {
	const env = useEnv();

	if (mode === 'json') {
		return req.body.refresh_token;
	}

	if (mode === 'cookie') {
		return req.cookies[env['REFRESH_TOKEN_COOKIE_NAME'] as string];
	}

	if (mode === 'session') {
		const token = req.cookies[env['SESSION_COOKIE_NAME'] as string];

		if (isDirectusJWT(token)) {
			const payload = verifyAccessJWT(token, getSecret());
			return payload.session;
		}
	}

	return undefined;
}

/** The accountability the refresh and logout handlers of Directus build (not the one of `authenticate`). */
function requestAccountability(req: Request): Accountability {
	const accountability: Accountability = createDefaultAccountability({ ip: getIPFromReq(req) });

	const userAgent = req.get('user-agent')?.substring(0, 1024);
	if (userAgent) accountability.userAgent = userAgent;

	const origin = req.get('origin');
	if (origin) accountability.origin = origin;

	return accountability;
}

@Controller('auth')
export class AuthController {
	// Directus builds each driver router once, when the controller module loads.
	private readonly localRouter = memoize(createLocalAuthRouter);

	constructor(
		@Inject(AuthenticationService)
		private readonly authenticationService: ServiceFactory<AuthenticationService>,
		@Inject(UsersService) private readonly usersService: ServiceFactory<UsersService>,
	) {}

	// Nest answers POST with 201 by default; Directus answers 200.
	@Post('login')
	@HttpCode(200)
	async login(@Req() req: Request, @Res() res: Response): Promise<void> {
		if (useEnv()['AUTH_DISABLE_DEFAULT']) throw new RouteNotFoundError({ path: req.path });

		await this.localRouter(DEFAULT_AUTH_PROVIDER).login(req, res);
		respond(res);
	}

	@Post('login/:provider')
	@HttpCode(200)
	async loginProvider(@Param('provider') name: string, @Req() req: Request, @Res() res: Response): Promise<void> {
		// Express matches mount paths case-insensitively, in the order of AUTH_PROVIDERS (FR-079).
		const provider = getAuthProviders().find((p) => p.name.toLowerCase() === name.toLowerCase());

		if (provider?.driver !== 'local') throw new RouteNotFoundError({ path: req.path });

		await this.localRouter(provider.name).login(req, res);
		respond(res);
	}

	@Post('refresh')
	@HttpCode(200)
	async refresh(@Req() req: Request, @Res() res: Response): Promise<void> {
		const env = useEnv();

		const authenticationService = this.authenticationService({
			accountability: requestAccountability(req),
			schema: req.schema,
		});

		const mode = getCurrentMode(req);
		const currentRefreshToken = getCurrentRefreshToken(req, mode);

		if (!currentRefreshToken) {
			throw new InvalidPayloadError({
				reason: `The refresh token is required in either the payload or cookie`,
			});
		}

		const { accessToken, refreshToken, expires } = await authenticationService.refresh(currentRefreshToken, {
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
		respond(res);
	}

	@Post('logout')
	@HttpCode(200)
	async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
		const env = useEnv();

		const authenticationService = this.authenticationService({
			accountability: requestAccountability(req),
			schema: req.schema,
		});

		const mode = getCurrentMode(req);
		const currentRefreshToken = getCurrentRefreshToken(req, mode);

		if (!currentRefreshToken) {
			throw new InvalidPayloadError({
				reason: `The refresh token is required in either the payload or cookie`,
			});
		}

		await authenticationService.logout(currentRefreshToken);

		// Backoffice: res.clearCookie of Express 4 (keeps Max-Age), see utils/clear-cookie.ts
		if (req.cookies[env['REFRESH_TOKEN_COOKIE_NAME'] as string]) {
			clearCookie(res, env['REFRESH_TOKEN_COOKIE_NAME'] as string, refreshCookieOptions());
		}

		if (req.cookies[env['SESSION_COOKIE_NAME'] as string]) {
			clearCookie(res, env['SESSION_COOKIE_NAME'] as string, sessionCookieOptions());
		}

		respond(res);
	}

	@Post('password/request')
	@HttpCode(200)
	async passwordRequest(@Req() req: Request, @Res() res: Response): Promise<void> {
		if (typeof req.body.email !== 'string') {
			throw new InvalidPayloadError({ reason: `"email" field is required` });
		}

		const service = this.usersService({ accountability: requestAccountability(req), schema: req.schema });

		try {
			await service.requestPasswordReset(req.body.email, req.body.reset_url || null);
		} catch (err: any) {
			if (isBackofficeError(err, ErrorCode.InvalidPayload)) {
				throw err;
			} else {
				useLogger().warn(err, `[email] ${err}`);
			}
		}

		respond(res);
	}

	@Post('password/reset')
	@HttpCode(200)
	async passwordReset(@Req() req: Request, @Res() res: Response): Promise<void> {
		if (typeof req.body.token !== 'string') {
			throw new InvalidPayloadError({ reason: `"token" field is required` });
		}

		if (typeof req.body.password !== 'string') {
			throw new InvalidPayloadError({ reason: `"password" field is required` });
		}

		const service = this.usersService({ accountability: requestAccountability(req), schema: req.schema });
		await service.resetPassword(req.body.token, req.body.password);
		respond(res);
	}
}
