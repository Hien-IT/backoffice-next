// Ported from directus/api/src/controllers/auth.ts. Each driver router of Directus is a handler object in its driver
// file (research R3 of spec 003): a provider without a handler for the method and path is a 404, like a request that
// falls through the Express routers.
import { useEnv } from '@backoffice/env';
import { RouteNotFoundError } from '@backoffice/errors';
import { Controller, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { memoize } from 'lodash-es';
import { createLocalAuthRouter } from '../auth/drivers/local.js';
import { DEFAULT_AUTH_PROVIDER } from '../constants.js';
import { respond } from '../middleware/respond.js';
import { getAuthProviders } from '../utils/get-auth-providers.js';

@Controller('auth')
export class AuthController {
	// Directus builds each driver router once, when the controller module loads.
	private readonly localRouter = memoize(createLocalAuthRouter);

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
}
