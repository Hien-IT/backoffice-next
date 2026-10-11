// Ported from directus/api/src/middleware/respond.ts (headers and the export of files; feature 005). The response cache
// part (CACHE_ENABLED, CACHE_TTL, CACHE_VALUE_MAX_SIZE, custom cache instances) comes with T036.
// Backoffice: `return void` keeps the early returns of the Express handler while the Nest handlers return nothing.
import { getDateTimeFormatted } from '@backoffice/utils';
import type { Request, Response } from 'express';
import { ExportService } from '../services/import-export.service.js';

export async function respond(req: Request, res: Response): Promise<void> {
	// Don't cache anything by default
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Vary', 'Origin, Cache-Control');

	if (req.sanitizedQuery.export) {
		const exportService = new ExportService({ accountability: req.accountability ?? null, schema: req.schema });

		let filename = '';

		if (req.collection) {
			filename += req.collection;
		} else {
			filename += 'Export';
		}

		filename += ' ' + getDateTimeFormatted();

		if (req.sanitizedQuery.export === 'json') {
			res.attachment(`${filename}.json`);
			res.set('Content-Type', 'application/json');
			return void res.status(200).send(exportService.transform(res.locals['payload']?.data, 'json'));
		}

		if (req.sanitizedQuery.export === 'xml') {
			res.attachment(`${filename}.xml`);
			res.set('Content-Type', 'text/xml');
			return void res.status(200).send(exportService.transform(res.locals['payload']?.data, 'xml'));
		}

		if (req.sanitizedQuery.export === 'csv') {
			res.attachment(`${filename}.csv`);
			res.set('Content-Type', 'text/csv');
			return void res.status(200).send(exportService.transform(res.locals['payload']?.data, 'csv'));
		}

		if (req.sanitizedQuery.export === 'csv_utf8') {
			res.attachment(`${filename}.csv`);
			res.set('Content-Type', 'text/csv; charset=utf-8');
			return void res.status(200).send(exportService.transform(res.locals['payload']?.data, 'csv_utf8'));
		}

		if (req.sanitizedQuery.export === 'yaml') {
			res.attachment(`${filename}.yaml`);
			res.set('Content-Type', 'text/yaml');
			return void res.status(200).send(exportService.transform(res.locals['payload']?.data, 'yaml'));
		}
	}

	if (Buffer.isBuffer(res.locals['payload'])) {
		return void res.end(res.locals['payload']);
	} else if (res.locals['payload']) {
		return void res.json(res.locals['payload']);
	} else {
		return void res.status(204).end();
	}
}
