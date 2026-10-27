// Backoffice (spec 024, D-188): blocks a search or an export on a collection whose bo_show_* toggle is off before the
// response cache, so an entry written by DR with the same key never answers a blocked request (FR-012, research R2,
// R3). The items and utils controllers and the GraphQL resolvers check the queries of request bodies themselves.
import url from 'url';
import type { RequestHandler } from 'express';
import getDatabase from '../database/index.js';
import { assertExport } from '../permissions/modules/backoffice-permissions/assert-backoffice-action.js';
import asyncHandler from '../utils/async-handler.js';
import { assertCollectionToggles, hasSearchOff } from '../utils/collection-toggles.js';
import { getGraphqlQueryAndVariables } from '../utils/get-graphql-query-and-variables.js';

const collectionTogglesGuard: RequestHandler = asyncHandler(async (req, res, next) => {
	const path = url.parse(req.originalUrl).pathname ?? '';
	const [root, collection] = path.split('/').filter(Boolean);

	if (root === 'graphql') {
		// ponytail: a GraphQL document with "search" skips the shared cache read while a collection has search off
		// (D-188.4); parse the document and resolve its collections before the cache if a benchmark asks for it.
		const document = getGraphqlQueryAndVariables(req).query;

		if (typeof document === 'string' && /\bsearch\b/.test(document) && (await hasSearchOff())) {
			res.locals['skipCacheRead'] = true;
		}

		return next();
	}

	const { search, export: exportFormat, deep } = req.sanitizedQuery ?? {};
	if (!search && !exportFormat && !deep) return next();

	// /items/<collection>[/<pk>], or a system endpoint (/users...) whose deep can reach a user collection (FR-017).
	const target = root === 'items' ? collection : `directus_${root}`;

	if (target && target in req.schema.collections) {
		await assertCollectionToggles(target, req.sanitizedQuery, req.schema);

		// Spec 025 (FR-006, FR-009, D-189.1): after the toggles, check the export permission of the caller's policies
		// and put its Use custom rules into the query that the route and respond() read.
		if (exportFormat) {
			req.sanitizedQuery = await assertExport(
				{ accountability: req.accountability, collection: target, query: req.sanitizedQuery, format: exportFormat },
				{ schema: req.schema, knex: getDatabase() },
			);
		}
	}

	return next();
});

export default collectionTogglesGuard;
