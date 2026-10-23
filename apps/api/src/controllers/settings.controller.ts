// Ported from directus/api/src/controllers/settings.ts
// Backoffice: one Nest handler per DR route, in the same order (research R16 of spec 010);
// useCollection('directus_settings') is applied in app.module.ts, `next()` to `respond` is respond().
import { ErrorCode, isBackofficeError } from '@backoffice/errors';
import { Controller, Get, HttpCode, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { respond } from '../middleware/respond.js';
import type { ServiceFactory } from '../providers.js';
import { SettingsService } from '../services/settings.service.js';

@Controller('settings')
export class SettingsController {
	constructor(@Inject(SettingsService) private readonly settingsService: ServiceFactory<SettingsService>) {}

	private service(req: Request): SettingsService {
		return this.settingsService({
			accountability: req.accountability,
			schema: req.schema,
		});
	}

	@Get()
	async read(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.service(req);

		const records = await service.readSingleton(req.sanitizedQuery);
		res.locals['payload'] = { data: records || null };
		return respond(req, res);
	}

	@Post('owner')
	@HttpCode(200)
	async owner(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.service(req);

		await service.setOwner(req.body);

		return respond(req, res);
	}

	@Patch()
	async update(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.service(req);

		await service.upsertSingleton(req.body);

		try {
			const record = await service.readSingleton(req.sanitizedQuery);
			res.locals['payload'] = { data: record || null };
		} catch (error: any) {
			if (isBackofficeError(error, ErrorCode.Forbidden)) {
				return respond(req, res);
			}

			throw error;
		}

		return respond(req, res);
	}
}
