// Ported from directus/api/src/middleware/collection-exists.ts
/**
 * Check if requested collection exists, and save it to req.collection
 */

import { systemCollectionRows } from '@backoffice/system-data';
import type { RequestHandler } from 'express';
import { createCollectionForbiddenError } from '../permissions/modules/process-ast/utils/validate-path/create-error.js';
import asyncHandler from '../utils/async-handler.js';

const collectionExists: RequestHandler = asyncHandler(async (req, _res, next) => {
	// Backoffice: Express 5 types a route param as string | string[] (wildcards); `:collection` is always a string.
	const collection = req.params['collection'] as string | undefined;

	if (!collection) return next();

	if (collection in req.schema.collections === false) {
		throw createCollectionForbiddenError('', collection);
	}

	req.collection = collection;

	const systemCollectionRow = systemCollectionRows.find((collection) => {
		return collection?.collection === req.collection;
	});

	if (systemCollectionRow !== undefined) {
		req.singleton = !!systemCollectionRow?.singleton;
	} else {
		req.singleton = req.schema.collections[req.collection]?.singleton ?? false;
	}

	return next();
});

export default collectionExists;
