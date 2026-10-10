// Ported from directus/api/src/controllers/server.ts (GET /server/info, /server/health, /server/specs/oas).
// Not built yet: /server/specs/graphql (011, D-15) and POST /server/setup (010, D-14).
import { useEnv } from '@backoffice/env';
import { RouteNotFoundError } from '@backoffice/errors';
import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { respond } from '../middleware/respond.js';
import type { ServiceFactory } from '../providers.js';
import { ServerService } from '../services/server.service.js';
import { SpecificationService } from '../services/specifications.service.js';

@Controller('server')
export class ServerController {
	constructor(
		@Inject(ServerService) private readonly serverService: ServiceFactory<ServerService>,
		@Inject(SpecificationService) private readonly specificationService: ServiceFactory<SpecificationService>,
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
		respond(res);
	}

	@Get('info')
	async info(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.serverService({ accountability: req.accountability ?? null, schema: req.schema });

		const data = await service.serverInfo();
		res.locals['payload'] = { data };
		respond(res);
	}

	@Get('health')
	async health(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.serverService({ accountability: req.accountability ?? null });

		const data = await service.health();

		res.setHeader('Content-Type', 'application/health+json');

		if (data['status'] === 'error') res.status(503);
		res.locals['payload'] = data;
		respond(res);
	}
}
