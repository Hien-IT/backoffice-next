// Ported from directus/app/src/utils/fetch-all.ts
// Backoffice: requests go through the SDK (FR-001) instead of axios; the SDK serializes `params` with queryToParams
// (filter as JSON, fields joined by commas), which the API reads the same way as axios' bracket notation.
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { useServerStore } from '../stores/server.ts';

export interface FetchAllConfig {
	params?: Record<string, unknown>;
}

export const fetchAll = async <T = unknown>(
	path: string,
	config: FetchAllConfig = {},
	limit = Infinity,
): Promise<T[]> => {
	let page = 1;
	let hasMore = true;

	const { info } = useServerStore();

	const get = (params: Record<string, unknown>) =>
		sdk.request(requestEndpoint<T[]>(path, { method: 'GET', params: { ...config.params, ...params } }));

	if (!info.queryLimit || info.queryLimit?.max === -1) {
		// do a single request if possible
		return get({ limit: -1 });
	}

	const pageSize = info.queryLimit.max;
	const result = [] as T[];

	while (result.length < limit && hasMore === true) {
		const data = await get({ page, limit: pageSize });

		if (data.length === 0) {
			hasMore = false;
		} else {
			result.push(...data);
		}

		page++;
	}

	if (Number.isFinite(limit)) {
		return result.slice(0, limit);
	}

	return result;
};
