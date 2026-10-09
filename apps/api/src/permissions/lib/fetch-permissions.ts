// Ported from directus/api/src/permissions/lib/fetch-permissions.ts and utils/fetch-raw-permissions.ts (no cache,
// PermissionsService replaced by knex, research R16.4). Dynamic variables ($CURRENT_USER...) are not resolved:
// feature 001 only serves public requests and only uses `collection` and `fields` (feature 004 ports the rest).
import type { Accountability, Permission, PermissionsAction } from '@backoffice/types';
import { sortBy } from 'lodash-es';
import { castCsv, castJson } from '../../utils/cast-on-read.js';
import type { Context } from '../types.js';

export interface FetchPermissionsOptions {
	action?: PermissionsAction;
	policies: string[];
	collections?: string[];
	accountability?: Pick<Accountability, 'user' | 'role' | 'roles' | 'app' | 'share' | 'ip'>;
}

export async function fetchPermissions(options: FetchPermissionsOptions, { knex }: Context): Promise<Permission[]> {
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
	permissions = sortBy(permissions, (permission) => options.policies.indexOf(permission.policy!));

	return permissions;
}
