// Ported from directus/api/src/controllers/metrics.ts. DR mounts the route only when METRICS_ENABLED is true;
// otherwise /metrics is a 404 like any unknown route. No logged-in admin before feature 003, so only the
// `Metrics <token>` header grants access (FR-044, FR-071).
import { useEnv } from '@backoffice/env';
import { ForbiddenError, RouteNotFoundError } from '@backoffice/errors';
import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { MetricsService } from '../metrics/metrics.service.js';

@Controller('metrics')
export class MetricsController {
	constructor(@Inject(MetricsService) private readonly metrics: MetricsService) {}

	@Get()
	async read(@Req() req: Request, @Res() res: Response): Promise<void> {
		const env = useEnv();

		if (env['METRICS_ENABLED'] !== true) throw new RouteNotFoundError({ path: req.path });

		if (req.accountability?.admin !== true) {
			// support Bearer Token of type `Metrics`
			const metricTokens = env['METRICS_TOKENS'] as string[] | undefined;

			if (!req.headers || !req.headers.authorization || !metricTokens) {
				throw new ForbiddenError();
			}

			const parts = req.headers.authorization.split(' ');

			if (parts.length !== 2 || parts[0]!.toLowerCase() !== 'metrics') {
				throw new ForbiddenError();
			}

			if (metricTokens.find((mt) => mt.toString() === parts[1]) === undefined) {
				throw new ForbiddenError();
			}
		}

		res.set('Content-Type', 'text/plain');
		// Don't cache anything by default
		res.setHeader('Cache-Control', 'no-cache');
		res.setHeader('Vary', 'Origin, Cache-Control');

		res.send(await this.metrics.readAll());
	}
}
