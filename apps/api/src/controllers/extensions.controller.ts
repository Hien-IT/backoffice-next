// Ported from directus/api/src/controllers/extensions.ts
// Backoffice: one Nest handler per Directus route, in the same order (research R6, R16 of spec 010);
// useCollection('directus_extensions') is applied in app.module.ts, `next()` to `respond` is respond(), the uuid route
// params are checked by uuidParam. Spec 020 wave 1 (D-37 narrowed): install, reinstall and
// uninstall answer 503 after the checks of Directus (until spec 020 wave 3), and the only app chunk is the empty bundle
// (until spec 020 wave 2), sent as a stream like the file stream of Directus (chunked, no Content-Length).
import { Readable } from 'node:stream';
import { EXTENSION_TYPES } from '@backoffice/constants';
import { useEnv } from '@backoffice/env';
import {
	ErrorCode,
	ForbiddenError,
	isBackofficeError,
	RouteNotFoundError,
	ServiceUnavailableError,
} from '@backoffice/errors';
import type { FieldFilter } from '@backoffice/types';
import { isIn, toBoolean } from '@backoffice/utils';
import { Controller, Delete, Get, HttpCode, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { isNil } from 'lodash-es';
import {
	account,
	type AccountOptions,
	describe,
	type DescribeOptions,
	list,
	type ListOptions,
	type ListQuery,
} from '../extensions/registry/index.js';
import { respond } from '../middleware/respond.js';
import type { ServiceFactory } from '../providers.js';
import { EMPTY_APP_EXTENSION_BUNDLE, ExtensionReadError, ExtensionsService } from '../services/extensions.service.js';
import { getCacheControlHeader } from '../utils/get-cache-headers.js';
import { getMilliseconds } from '../utils/get-milliseconds.js';
import { uuidParam } from '../utils/uuid-param.js';
import { handleRegistryError } from './utils/handle-registry-error.js';

const NO_INSTALL = { service: 'marketplace', reason: 'Backoffice does not install extensions' };

function assertAdmin(req: Request) {
	if (req.accountability && req.accountability.admin !== true) {
		throw new ForbiddenError();
	}
}

function registryOptions(): ListOptions & AccountOptions & DescribeOptions {
	const env = useEnv();
	const options: ListOptions = {};

	if (env['MARKETPLACE_REGISTRY'] && typeof env['MARKETPLACE_REGISTRY'] === 'string') {
		options.registry = env['MARKETPLACE_REGISTRY'];
	}

	return options;
}

@Controller('extensions')
export class ExtensionsController {
	constructor(@Inject(ExtensionsService) private readonly extensionsService: ServiceFactory<ExtensionsService>) {}

	@Get()
	async readAll(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.extensionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const extensions = await service.readAll();
		res.locals['payload'] = { data: extensions || null };
		return respond(req, res);
	}

	@Get('registry')
	async registry(@Req() req: Request, @Res() res: Response): Promise<void> {
		assertAdmin(req);

		const { search, limit, offset, sort, filter } = req.sanitizedQuery;

		const query: ListQuery = {};

		if (!isNil(search)) {
			query.search = search;
		}

		if (!isNil(limit)) {
			query.limit = limit;
		}

		if (!isNil(offset)) {
			query.offset = offset;
		}

		if (filter) {
			const getFilterValue = (key: string) => {
				const field = (filter as FieldFilter)[key];
				if (!field || !('_eq' in field) || typeof field._eq !== 'string') return;
				return field._eq;
			};

			const by = getFilterValue('by');
			const type = getFilterValue('type');

			if (by) {
				query.by = by;
			}

			if (type) {
				if (isIn(type, EXTENSION_TYPES) === false) {
					throw new ForbiddenError();
				}

				query.type = type;
			}
		}

		if (!isNil(sort) && sort[0] && isIn(sort[0], ['popular', 'recent', 'downloads'] as const)) {
			query.sort = sort[0];
		}

		if (useEnv()['MARKETPLACE_TRUST'] === 'sandbox') {
			query.sandbox = true;
		}

		let payload;

		try {
			payload = await list(query, registryOptions());
		} catch (error) {
			handleRegistryError(error);
		}

		res.locals['payload'] = payload;
		return respond(req, res);
	}

	@Get('registry/account/:pk')
	async registryAccount(@Req() req: Request, @Res() res: Response): Promise<void> {
		const pk = uuidParam(req);
		assertAdmin(req);

		let payload;

		try {
			payload = await account(pk, registryOptions());
		} catch (error) {
			handleRegistryError(error);
		}

		res.locals['payload'] = payload;
		return respond(req, res);
	}

	@Get('registry/extension/:pk')
	async registryExtension(@Req() req: Request, @Res() res: Response): Promise<void> {
		const pk = uuidParam(req);
		assertAdmin(req);

		let payload;

		try {
			payload = await describe(pk, registryOptions());
		} catch (error) {
			handleRegistryError(error);
		}

		res.locals['payload'] = payload;
		return respond(req, res);
	}

	@Post('registry/install')
	@HttpCode(200)
	async install(@Req() req: Request): Promise<void> {
		assertAdmin(req);

		const { version, extension } = req.body ?? {};

		if (!version || !extension) {
			throw new ForbiddenError();
		}

		throw new ServiceUnavailableError(NO_INSTALL);
	}

	@Post('registry/reinstall')
	@HttpCode(200)
	async reinstall(@Req() req: Request): Promise<void> {
		assertAdmin(req);

		const { extension } = req.body ?? {};

		if (!extension) {
			throw new ForbiddenError();
		}

		throw new ServiceUnavailableError(NO_INSTALL);
	}

	@Delete('registry/uninstall/:pk')
	async uninstall(@Req() req: Request): Promise<void> {
		uuidParam(req);
		assertAdmin(req);

		throw new ServiceUnavailableError(NO_INSTALL);
	}

	@Patch(':pk')
	async updateOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		const pk = uuidParam(req);
		assertAdmin(req);

		const service = this.extensionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		try {
			const result = await service.updateOne(pk, req.body);
			res.locals['payload'] = { data: result || null };
		} catch (error) {
			let finalError = error;

			if (error instanceof ExtensionReadError) {
				finalError = error.originalError;

				if (isBackofficeError(finalError, ErrorCode.Forbidden)) {
					return respond(req, res);
				}
			}

			throw finalError;
		}

		return respond(req, res);
	}

	@Delete(':pk')
	async deleteOne(@Req() req: Request, @Res() res: Response): Promise<void> {
		const pk = uuidParam(req);
		assertAdmin(req);

		const service = this.extensionsService({
			accountability: req.accountability,
			schema: req.schema,
		});

		await service.deleteOne(pk);

		return respond(req, res);
	}

	@Get('sources/:chunk')
	async sources(@Req() req: Request, @Res() res: Response): Promise<void> {
		const env = useEnv();

		// Directus builds the app bundle only when SERVE_APP is on and has no other chunk without extensions.
		if (req.params['chunk'] !== 'index.js' || !toBoolean(env['SERVE_APP'])) {
			// req.path inside the Directus router: without the /extensions mount path.
			throw new RouteNotFoundError({ path: req.path.slice('/extensions'.length) });
		}

		res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');

		res.setHeader(
			'Cache-Control',
			getCacheControlHeader(req, getMilliseconds(env['EXTENSIONS_CACHE_TTL']), false, false),
		);

		res.setHeader('Vary', 'Origin, Cache-Control');
		Readable.from([EMPTY_APP_EXTENSION_BUNDLE]).pipe(res);
	}
}
