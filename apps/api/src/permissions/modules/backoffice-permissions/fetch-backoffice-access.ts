// Backoffice (spec 025, FR-010, FR-011, FR-017): what the policies of a caller allow for one Backoffice action on one
// collection: admin everything; otherwise at least one row; the row filters (with $CURRENT_USER... resolved as for
// directus_permissions), fields and formats of every row added up.
import { BACKOFFICE_PERMISSION_ACTIONS, type BackofficePermissionsAction } from '@backoffice/constants';
import type { Accountability, BackofficePermission, Filter, Permission } from '@backoffice/types';
import { isEmpty, uniq } from 'lodash-es';
import { fetchPolicies } from '../../lib/fetch-policies.js';
import type { Context } from '../../types.js';
import { extractRequiredDynamicVariableContextForPermissions } from '../../utils/extract-required-dynamic-variable-context.js';
import { fetchDynamicVariableData } from '../../utils/fetch-dynamic-variable-data.js';
import { processPermissions } from '../../utils/process-permissions.js';
import { fetchBackofficePermissions } from './fetch-backoffice-permissions.js';

export interface BackofficeAccess {
	allowed: boolean;
	/** Rows the action may touch; null = every row. */
	filter: Filter | null;
	/** Fields the action may touch; ['*'] = every field. */
	fields: string[];
	formats: string[];
}

export interface FetchBackofficeAccessOptions {
	accountability: Pick<Accountability, 'user' | 'role' | 'roles' | 'ip' | 'admin'>;
	collection: string;
	action: BackofficePermissionsAction;
}

export async function fetchBackofficeAccess(
	{ accountability, collection, action }: FetchBackofficeAccessOptions,
	context: Context,
): Promise<BackofficeAccess> {
	const allFormats = [...BACKOFFICE_PERMISSION_ACTIONS[action].formats];

	if (accountability.admin) return { allowed: true, filter: null, fields: ['*'], formats: allFormats };

	const policies = await fetchPolicies(accountability, context);
	const rows = await fetchBackofficePermissions({ policies, collection, action }, context);

	if (rows.length === 0) return { allowed: false, filter: null, fields: [], formats: [] };

	const resolved = await resolveDynamicVariables(rows, accountability, policies, context);

	return { allowed: true, ...combine(resolved, allFormats) };
}

/**
 * ponytail: rows of several policies are added up (filters `_or`, fields and formats united) instead of pairing each
 * policy's fields with its own filter as DR does for read: the engine has no hook for that on export. The result
 * still goes through the caller's read permissions, so it never exceeds them (spec FR-011, research T001 d).
 */
export function combine(
	rows: Pick<BackofficePermission, 'permissions' | 'fields' | 'options'>[],
	allFormats: string[],
) {
	const filter = rows.some((row) => !row.permissions || isEmpty(row.permissions))
		? null
		: rows.length === 1
			? rows[0]!.permissions
			: ({ _or: rows.map((row) => row.permissions) } as Filter);

	const fields = rows.some((row) => !row.fields || row.fields.includes('*'))
		? ['*']
		: uniq(rows.flatMap((row) => row.fields ?? []));

	const formats = rows.some((row) => !row.options?.formats?.length)
		? allFormats
		: allFormats.filter((format) => rows.some((row) => row.options!.formats!.includes(format)));

	return { filter, fields, formats };
}

async function resolveDynamicVariables(
	rows: BackofficePermission[],
	accountability: FetchBackofficeAccessOptions['accountability'],
	policies: string[],
	context: Context,
): Promise<BackofficePermission[]> {
	// The rows have the shape of directus_permissions rows where processPermissions looks (permissions, validation, presets).
	const permissions = rows as unknown as Permission[];
	const dynamicVariableContext = extractRequiredDynamicVariableContextForPermissions(permissions);

	const permissionsContext = await fetchDynamicVariableData(
		{ accountability, policies, dynamicVariableContext },
		context,
	);

	return processPermissions({ permissions, accountability, permissionsContext }) as unknown as BackofficePermission[];
}
