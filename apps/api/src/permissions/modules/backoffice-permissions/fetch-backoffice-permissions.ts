// Backoffice (spec 025, D-189): the rows of backoffice_permissions of a list of policies. Cached in the permissions
// cache shared with DR (`clearSystemCache` of either app clears it); rows of deleted policies are never asked for.
import type { BackofficePermission } from '@backoffice/types';
import { parseJSON } from '@backoffice/utils';
import { sortBy } from 'lodash-es';
import type { Context } from '../../types.js';
import { withCache } from '../../utils/with-cache.js';

export const TABLE = 'backoffice_permissions';

export interface FetchBackofficePermissionsOptions {
	policies: string[];
	collection?: string;
	action?: string;
}

const fetchCached = withCache(
	'backoffice-permissions',
	_fetchBackofficePermissions,
	({ policies, collection, action }) => ({ policies, ...(collection && { collection }), ...(action && { action }) }),
);

/**
 * The policies that have rows, one key for every caller: it is read on every GET /permissions/me, so it stays in the
 * local layer of the permissions cache (100 keys). A caller none of whose policies has rows (most users) adds no key per
 * policy list, which would push the DR keys of other users out of that layer (benchmark-permissions, CPU +12%,
 * 2026-11-02).
 */
export const fetchPoliciesWithRows = withCache(
	'backoffice-permissions-policies',
	async (context: Pick<Context, 'knex'>): Promise<string[]> =>
		(await context.knex.distinct('policy').from(TABLE)).map((row: { policy: unknown }) => String(row['policy'])),
	() => ({}),
);

export async function fetchBackofficePermissions(
	options: FetchBackofficePermissionsOptions,
	context: Pick<Context, 'knex'>,
): Promise<BackofficePermission[]> {
	if (options.policies.length === 0) return [];

	const withRows = new Set(await fetchPoliciesWithRows(context));
	const policies = options.policies.filter((policy) => withRows.has(policy));

	return policies.length === 0 ? [] : fetchCached({ ...options, policies }, context);
}

export async function _fetchBackofficePermissions(
	{ policies, collection, action }: FetchBackofficePermissionsOptions,
	context: Pick<Context, 'knex'>,
): Promise<BackofficePermission[]> {
	if (policies.length === 0) return [];

	const query = context.knex.select('*').from(TABLE).whereIn('policy', policies);
	if (collection) query.where('collection', collection);
	if (action) query.where('action', action);

	const rows = (await query) as Record<string, unknown>[];

	// In the order of the policies, as fetchRawPermissions does.
	return sortBy(rows.map(toPermission), (row) => policies.indexOf(row.policy));
}

/** JSON columns come back as strings on SQLite and MySQL; `fields` is a csv column like directus_permissions.fields. */
export function toPermission(row: Record<string, unknown>): BackofficePermission {
	return {
		id: row['id'] as number,
		policy: String(row['policy']),
		collection: (row['collection'] as string | null) ?? null,
		action: String(row['action']),
		permissions: json(row['permissions']),
		validation: json(row['validation']),
		presets: json(row['presets']),
		fields: typeof row['fields'] === 'string' ? (row['fields'] as string).split(',').filter(Boolean) : null,
		options: json(row['options']),
	};
}

function json(value: unknown) {
	if (value === null || value === undefined) return null;
	return typeof value === 'string' ? parseJSON(value) : value;
}
