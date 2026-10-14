// Ported from directus/api/src/controllers/graphql.ts
// Backoffice: the Directus router mounts `/system` and `/` with `router.use`, which matches every method and every path
// below them (`/graphql/system/x` is the system scope, `/graphql/x` and `/graphql/systemx` the items scope; research
// R12.4 of spec 011). Nest has no `use`, so each scope gets a handler for the exact path and one for `*splat`, the
// system ones first. parseGraphQL (405 for every method but GET and POST) and respond run through the same helpers
// as the other controllers.
import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { parseGraphQL } from '../middleware/graphql.js';
import { respond } from '../middleware/respond.js';
import type { ServiceFactory } from '../providers.js';
import { GraphQLService } from '../services/graphql/index.js';
import type { GQLScope } from '../types/index.js';
import { runMiddleware } from '../utils/run-middleware.js';

@Controller('graphql')
export class GraphqlController {
	constructor(@Inject(GraphQLService) private readonly graphqlService: ServiceFactory<GraphQLService>) {}

	@All('system')
	async system(@Req() req: Request, @Res() res: Response): Promise<void> {
		return this.execute(req, res, 'system');
	}

	@All('system/*splat')
	async systemDeep(@Req() req: Request, @Res() res: Response): Promise<void> {
		return this.execute(req, res, 'system');
	}

	@All()
	async items(@Req() req: Request, @Res() res: Response): Promise<void> {
		return this.execute(req, res, 'items');
	}

	@All('*splat')
	async itemsDeep(@Req() req: Request, @Res() res: Response): Promise<void> {
		return this.execute(req, res, 'items');
	}

	private async execute(req: Request, res: Response, scope: GQLScope): Promise<void> {
		await runMiddleware(parseGraphQL, req, res);

		const service = this.graphqlService({
			accountability: req.accountability,
			schema: req.schema,
			scope,
		} as any);

		res.locals['payload'] = await service.execute(res.locals['graphqlParams']);

		if (res.locals['payload']?.errors?.length > 0) {
			res.locals['cache'] = false;
		}

		return respond(req, res);
	}
}
