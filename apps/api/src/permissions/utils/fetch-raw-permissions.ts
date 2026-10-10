// Ported from directus/api/src/permissions/utils/fetch-raw-permissions.ts (PermissionsService replaced by knex as in
// feature 001, research R16.4). withAppMinimalPermissions is not ported yet: every request is public (`app: false`)
// until features 003 and 004, and it returns the permissions unchanged for `app: false` (research R5).
import type { Accountability, Permission, PermissionsAction } from '@backoffice/types';
import { sortBy } from 'lodash-es';
import { castCsv, castJson } from '../../utils/cast-on-read.js';
import type { Context } from '../types.js';
import { withCache } from './with-cache.js';

export const fetchRawPermissions = withCache(
	'raw-permissions',
	_fetchRawPermissions,
	({ action, policies, collections, accountability, bypassMinimalAppPermissions }) => ({
		policies, // we assume that policies always come from the same source, so they should be in the same order
		...(action && { action }),
		...(collections && { collections: sortBy(collections) }),
		...(accountability && { accountability: { app: accountability.app } }),
		...(bypassMinimalAppPermissions && { bypassMinimalAppPermissions }),
	}),
);

export interface FetchRawPermissionsOptions {
	action?: PermissionsAction;
	policies: string[];
	collections?: string[];
	accountability?: Pick<Accountability, 'app'>;
	bypassMinimalAppPermissions?: boolean;
}

export async function _fetchRawPermissions(options: FetchRawPermissionsOptions, { knex }: Context) {
	if (options.policies.length === 0) return [];

	const query = knex.select('*').from('directus_permissions').whereIn('policy', options.policies);

	if (options.action) query.where('action', options.action);
	if (options.collections) query.whereIn('collection', options.collections);

	const rows: Record<string, unknown>[] = await query.orderBy('id');

	let permissions = rows.map(
		(row) =>
			({
				...row,
				fields: castCsv(row['fields']),
				permissions: castJson(row['permissions']),
				validation: castJson(row['validation']),
				presets: castJson(row['presets']),
			}) as Permission,
	);

	// Sort permissions by their order in the policies array
	// This ensures that if a sorted array of policies is passed in the permissions are returned in the same order
	// which is necessary for correctly applying the presets in order
	permissions = sortBy(permissions, (permission) => options.policies.indexOf(permission.policy!));

	return permissions;
}
