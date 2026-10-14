// Ported from directus/api/src/utils/get-cache-key.ts
// Backoffice: the key of every path is the same as Directus (spec FR-010 of 001): `version` is DIRECTUS_COMPAT_VERSION,
// not Backoffice's own version. The flow trigger part (cacheQueryParams of /flows/trigger/<uuid>) comes with feature
// 009, the GraphQL part (getGraphqlQueryAndVariables) with feature 011.
import url from 'url';
import { toArray } from '@backoffice/utils';
import { ipInNetworks } from '@backoffice/utils/node';
import type { Request } from 'express';
import { isEmpty, pick } from 'lodash-es';
import hash from 'object-hash';
import { DIRECTUS_COMPAT_VERSION as version } from '../constants.js';
import getDatabase from '../database/index.js';
import { fetchPoliciesIpAccess } from '../permissions/modules/fetch-policies-ip-access/fetch-policies-ip-access.js';
import { getGraphqlQueryAndVariables } from './get-graphql-query-and-variables.js';

// Match /flows/trigger/<uuid> and extract the UUID
const FLOW_TRIGGER_PATTERN = /^\/flows\/trigger\/([0-9a-f-]+)/i;

export async function getCacheKey(req: Request) {
	const path = url.parse(req.originalUrl).pathname;
	const isGraphQl = path?.startsWith('/graphql');

	let flowTriggerQuery: Record<string, any> | undefined = undefined;

	if (path) {
		const flowMatch = path.match(FLOW_TRIGGER_PATTERN);

		// Flow trigger endpoints accept arbitrary query params that affect their response,
		// but these are not captured in sanitizedQuery.
		if (flowMatch) {
			// Backoffice: loaded on use, so the cache middleware does not pull the flow engine and every service in.
			const { getFlowManager } = await import('../flows.js');
			const flow = getFlowManager().getFlow(flowMatch[1]!);
			const cacheQueryParams: string[] = toArray(flow?.options?.['cacheQueryParams'] ?? []);
			const picked = pick(req.query, cacheQueryParams);
			if (!isEmpty(picked)) flowTriggerQuery = picked;
		}
	}

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
		query: isGraphQl ? getGraphqlQueryAndVariables(req) : req.sanitizedQuery,
		...(flowTriggerQuery && { rawQuery: flowTriggerQuery }),
		...(includeIp && { ip: req.accountability!.ip }),
	};

	const key = hash(info);
	return key;
}
