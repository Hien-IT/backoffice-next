// Backoffice (spec 031, D-212, contracts/api.md): install an extension from an uploaded npm-pack tarball, under
// /backoffice/ (D-189.6). DR has no such route (404). Admin only. GET answers the upload size limit and is the probe of
// the web app (the button is hidden when it 404s).
import { useEnv } from '@backoffice/env';
import {
	ContentTooLargeError,
	ForbiddenError,
	InvalidCredentialsError,
	InvalidPayloadError,
} from '@backoffice/errors';
import { Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import Busboy from 'busboy';
import bytes from 'bytes';
import type { Request, Response } from 'express';
import type { Readable } from 'node:stream';
import { respond } from '../middleware/respond.js';
import type { ServiceFactory } from '../providers.js';
import { ExtensionsService } from '../services/extensions.service.js';

/** FILES_MAX_UPLOAD_SIZE in bytes, null when unset (no limit, as /files; clarify 2026-11-04). */
export function maxUploadSize(): number | null {
	const value = useEnv()['FILES_MAX_UPLOAD_SIZE'];
	return value === undefined || value === null || value === '' ? null : (bytes.parse(value as string) ?? null);
}

@Controller('backoffice/extensions')
export class BackofficeExtensionsController {
	constructor(@Inject(ExtensionsService) private readonly extensionsService: ServiceFactory<ExtensionsService>) {}

	private service(req: Request, res: Response): ExtensionsService {
		if (!req.accountability?.user) throw new InvalidCredentialsError();
		if (!req.accountability.admin) throw new ForbiddenError();
		res.locals['cache'] = false;
		return this.extensionsService({ accountability: req.accountability, schema: req.schema });
	}

	@Get('upload')
	async limits(@Req() req: Request, @Res() res: Response): Promise<void> {
		this.service(req, res);
		res.locals['payload'] = { data: { max_upload_size: maxUploadSize() } };
		return respond(req, res);
	}

	@Post('upload')
	@HttpCode(200)
	async upload(@Req() req: Request, @Res() res: Response): Promise<void> {
		const service = this.service(req, res);

		if (!req.is('multipart/form-data')) {
			throw new InvalidPayloadError({ reason: 'Request must be multipart/form-data' });
		}

		const data = await receiveOne(req, (stream) => service.installUpload(stream));

		res.locals['payload'] = { data };
		return respond(req, res);
	}
}

/**
 * Runs `install` on the first file of the multipart request and settles with its result. Busboy cuts a file at
 * `fileSize` and ends it as if complete, so the stream is destroyed with a 413 instead: a cut package is never
 * extracted. Fields and further files are ignored. Without any file part: 400.
 */
function receiveOne<T>(req: Request, install: (stream: Readable) => Promise<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const fileSize = maxUploadSize() ?? undefined;
		const busboy = Busboy({ headers: req.headers, limits: { files: 1, ...(fileSize ? { fileSize } : {}) } });
		let started = false;

		busboy.on('file', (_name, stream) => {
			started = true;
			stream.on('limit', () => stream.destroy(new ContentTooLargeError()));
			install(stream).then(resolve, (error: unknown) => {
				stream.resume();
				reject(error);
			});
		});

		busboy.on('error', (error) => reject(error));

		busboy.on('close', () => {
			if (!started) reject(new InvalidPayloadError({ reason: 'No file was uploaded' }));
		});

		req.pipe(busboy);
	});
}
