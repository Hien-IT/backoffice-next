// Ported from directus/api/src/controllers/users.ts (lines 330-369: POST /users/me/tfa/generate only). The other
// /users routes come with feature 004 (D-09.2); enabling and disabling TFA with feature 005 (D-09.10 of spec 003).
import { InvalidCredentialsError, InvalidPayloadError } from '@backoffice/errors';
import { Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DEFAULT_AUTH_PROVIDER } from '../constants.js';
import getDatabase from '../database/index.js';
import { respond } from '../middleware/respond.js';
import type { ServiceFactory } from '../providers.js';
import { AuthenticationService } from '../services/authentication.service.js';
import { TFAService } from '../services/tfa.service.js';

@Controller('users')
export class UsersController {
	constructor(
		@Inject(TFAService) private readonly tfaService: ServiceFactory<TFAService>,
		@Inject(AuthenticationService) private readonly authenticationService: ServiceFactory<AuthenticationService>,
	) {}

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
}
