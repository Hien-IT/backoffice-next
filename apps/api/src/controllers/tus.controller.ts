// Ported from directus/api/src/controllers/tus.ts
// Backoffice: one Nest handler per DR route, in the same order (research R5 of spec 007). checkFileAccess is the
// DR middleware unchanged, run through runMiddleware; @tus/server writes the response itself, like in
// DR. The controller lives in TusModule, imported only when TUS_ENABLED is true (app.module.ts), like the
// `app.use('/files/tus', tusRouter)` of directus/api/src/app.ts.
import { createError } from '@backoffice/errors';
import type { PermissionsAction } from '@backoffice/types';
import { Controller, Delete, Head, Options, Patch, Post, Req, Res } from '@nestjs/common';
import { ERRORS, Metadata } from '@tus/utils';
import type { Request, Response } from 'express';
import getDatabase from '../database/index.js';
import { validateAccess, type ValidateAccessOptions } from '../permissions/modules/validate-access/validate-access.js';
import { createTusServer } from '../services/tus/index.js';
import asyncHandler from '../utils/async-handler.js';
import { runMiddleware } from '../utils/run-middleware.js';

const mapAction = (method: string): PermissionsAction => {
	switch (method) {
		case 'POST':
			return 'create';
		case 'PATCH':
			return 'update';
		case 'DELETE':
			return 'delete';
		default:
			return 'read';
	}
};

export const checkFileAccess = asyncHandler(async (req, _res, next) => {
	if (req.accountability) {
		const action = mapAction(req.method);

		const validateAccessOptions: ValidateAccessOptions = {
			action,
			collection: 'directus_files',
			accountability: req.accountability,
		};

		if (req.method === 'POST' && req.header('upload-metadata')) {
			let metadata: Record<string, string | null>;

			try {
				metadata = Metadata.parse(req.header('upload-metadata'));
			} catch {
				throw new (createError(
					'INVALID_METADATA',
					ERRORS.INVALID_METADATA.body,
					ERRORS.INVALID_METADATA.status_code,
				))();
			}

			// On replacement ensure update for that record
			if (metadata['id']) {
				validateAccessOptions.action = 'update';
				validateAccessOptions.primaryKeys = [metadata['id']];
			}

			// Validate permissions for any payload fields
			const fields = [];

			for (const field of Object.keys(req.schema.collections['directus_files']!.fields)) {
				// PK is not mutable, access to record is already checked via `primaryKeys` for updates
				if (field === 'id') {
					continue;
				}

				if (field in metadata) {
					fields.push(field);
				}
			}

			if (fields.length > 0) {
				validateAccessOptions.fields = fields;
			}
		}

		await validateAccess(validateAccessOptions, {
			schema: req.schema,
			knex: getDatabase(),
		});
	}

	return next();
});

@Controller('files/tus')
export class TusController {
	private async handler(req: Request, res: Response): Promise<void> {
		await runMiddleware(checkFileAccess, req, res);

		const [tusServer, cleanupServer] = await createTusServer({
			schema: req.schema,
			accountability: req.accountability,
		});

		await tusServer.handle(req, res);

		cleanupServer();
	}

	@Post()
	create(@Req() req: Request, @Res() res: Response): Promise<void> {
		return this.handler(req, res);
	}

	@Patch(':id')
	patch(@Req() req: Request, @Res() res: Response): Promise<void> {
		return this.handler(req, res);
	}

	@Delete(':id')
	delete(@Req() req: Request, @Res() res: Response): Promise<void> {
		return this.handler(req, res);
	}

	@Options(':id')
	options(@Req() req: Request, @Res() res: Response): Promise<void> {
		return this.handler(req, res);
	}

	@Head(':id')
	head(@Req() req: Request, @Res() res: Response): Promise<void> {
		return this.handler(req, res);
	}
}
