// Ported from directus/api/src/middleware/schema.ts
import type { RequestHandler } from 'express';
import { getSchema } from '../schema/get-database-schema.js';
import asyncHandler from '../utils/async-handler.js';

// Backoffice: /server/health skips this step so probes report the database state (D-13, FR-022). Matched like the
// Express router matches the route: any method, case-insensitive, one optional trailing slash.
const HEALTH = /^\/server\/health\/?$/i;

const schema: RequestHandler = asyncHandler(async (req, _res, next) => {
	if (HEALTH.test(req.path)) return next();

	req.schema = await getSchema();
	return next();
});

export default schema;
