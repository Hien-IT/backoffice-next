// Ported from directus/api/src/utils/get-cache-key.ts
// Backoffice: the flow trigger part (cacheQueryParams of /flows/trigger/<uuid>, feature 009) and the GraphQL part
// (getGraphqlQueryAndVariables for /graphql, feature 011) come with those routes; the key of every other path is the
// same as Directus (spec FR-010): `version` is DIRECTUS_COMPAT_VERSION, not Backoffice's own version.
import url from 'url';
import { ipInNetworks } from '@backoffice/utils/node';
import type { Request } from 'express';
import hash from 'object-hash';
import { DIRECTUS_COMPAT_VERSION as version } from '../constants.js';
import getDatabase from '../database/index.js';
import { fetchPoliciesIpAccess } from '../permissions/modules/fetch-policies-ip-access/fetch-policies-ip-access.js';

export async function getCacheKey(req: Request) {
	const path = url.parse(req.originalUrl).pathname;

	let includeIp = false;

	if (req.accountability && req.accountability.ip) {
		// Check if the IP influences the result of the request, that can be the case if some policies have an ip_access
		// filter and the request IP matches any of those filters
		const ipFilters = await fetchPoliciesIpAccess(req.accountability, getDatabase());
		includeIp = ipFilters.length > 0 && ipFilters.some((networks) => ipInNetworks(req.accountability!.ip!, networks));
	}

	const info = {
		version,
		user: req.accountability?.user || null,
		path,
		query: req.sanitizedQuery,
		...(includeIp && { ip: req.accountability!.ip }),
	};

	const key = hash(info);
	return key;
}
