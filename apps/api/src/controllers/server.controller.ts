// Ported from directus/api/src/controllers/server.ts (GET /server/info, /server/health, /server/specs/oas,
// /server/specs/graphql/:scope?, POST /server/setup).
import { useEnv } from '@backoffice/env';
import { ErrorCode, ForbiddenError, isBackofficeError, RouteNotFoundError } from '@backoffice/errors';
import { Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { format } from 'date-fns';
import type { Request, Response } from 'express';
import { respond } from '../middleware/respond.js';
import type { ServiceFactory } from '../providers.js';
import { ServerService } from '../services/server.service.js';
import { SettingsService } from '../services/settings.service.js';
import { SpecificationService } from '../services/specifications.service.js';
import { createAdmin } from '../utils/create-admin.js';

@Controller('server')
export class ServerController {
	constructor(
		@Inject(ServerService) private readonly serverService: ServiceFactory<ServerService>,
		@Inject(SpecificationService) private readonly specificationService: ServiceFactory<SpecificationService>,
		@Inject(SettingsService) private readonly settingsService: ServiceFactory<SettingsService>,
	) {}

	@Get('specs/oas')
	async oas(@Req() req: Request, @Res() res: Response): Promise<void> {
		// Directus only mounts this route when OPENAPI_ENABLED !== false (FR-043).
		if (useEnv()['OPENAPI_ENABLED'] === false) throw new RouteNotFoundError({ path: req.path });

		const service = this.specificationService({
			accountability: req.accountability ?? null,
			schema: req.schema,
		});

		res.locals['payload'] = await service.oas.generate(req.headers.host);
		await respond(req, res);
	}

	// Directus only mounts this route when GRAPHQL_INTROSPECTION !== false (spec FR-042, FR-043); the scope is optional
	// (`/specs/graphql/:scope?`), so Nest gets one handler per form.
	@Get('specs/graphql')
	async graphql(@Req() req: Request, @Res() res: Response): Promise<void> {
		return this.sdl(req, res, undefined);
	}

	@Get('specs/graphql/:scope')
	async graphqlScope(@Req() req: Request, @Res() res: Response): Promise<void> {
		return this.sdl(req, res, req.params['scope'] as string);
	}

	private async sdl(req: Request, res: Response, scopeParam: string | undefined): Promise<void> {
		if (useEnv()['GRAPHQL_INTROSPECTION'] === false) throw new RouteNotFoundError({ path: req.path });

		const service = this.specificationService({ accountability: req.accountability ?? null, schema: req.schema });
		const serverService = this.serverService({ accountability: req.accountability ?? null, schema: req.schema });

		const scope = scopeParam || 'items';

		// Inside the Directus router: the path is relative to its /server mount.
		if (['items', 'system'].includes(scope) === false) {
			throw new RouteNotFoundError({ path: req.path.replace(/^\/server/i, '') });
		}

		const info = await serverService.serverInfo();
		const result = await service.graphql.generate(scope as 'items' | 'system');
		const filename = info['project'].project_name + '_' + format(new Date(), 'yyyy-MM-dd') + '.graphql';

		res.attachment(filename);
		res.send(result);
	}

	@Get('info')
	async info(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.serverService({ accountability: req.accountability ?? null, schema: req.schema });

		const data = await service.serverInfo();
		res.locals['payload'] = { data };
		await respond(req, res);
	}

	@Get('health')
	async health(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.serverService({ accountability: req.accountability ?? null });

		const data = await service.health();

		res.setHeader('Content-Type', 'application/health+json');

		if (data['status'] === 'error') res.status(503);
		res.locals['payload'] = data;
		res.locals['cache'] = false;
		await respond(req, res);
	}

	// Feature 010 (spec FR-013, contracts/system-api.md §5): gone from D-14.
	@Post('setup')
	@HttpCode(200)
	async setup(@Req() req: Request, @Res() res: Response): Promise<void> {
		const serverService = this.serverService({ schema: req.schema });

		if (await serverService.isSetupCompleted()) {
			throw new ForbiddenError();
		}

		try {
			await createAdmin(req.schema, {
				email: req.body.project_owner,
				password: req.body.password,
				first_name: req.body.first_name,
				last_name: req.body.last_name,
			});

			const settingsService = this.settingsService({ schema: req.schema });

			// Not awaited, like Directus (the owner report it would send is out of scope here, D-38).
			settingsService.setOwner(req.body);
		} catch (error: any) {
			if (isBackofficeError(error, ErrorCode.Forbidden)) {
				return respond(req, res);
			}

			throw error;
		}

		return respond(req, res);
	}
}
