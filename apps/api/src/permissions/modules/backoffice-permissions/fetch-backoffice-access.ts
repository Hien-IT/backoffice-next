// Backoffice (spec 025, FR-010, FR-011, FR-017): what the policies of a caller allow for one Backoffice action on one
// collection: admin everything; otherwise one rule per row (filter with $CURRENT_USER... resolved as for
// directus_permissions, fields, formats), kept apart so the checks pair each filter with its own fields and formats.
import { BACKOFFICE_PERMISSION_ACTIONS, type BackofficePermissionsAction } from '@backoffice/constants';
import type { Accountability, BackofficePermission, Filter, Permission } from '@backoffice/types';
import { isEmpty, uniq } from 'lodash-es';
import { fetchPolicies } from '../../lib/fetch-policies.js';
import type { Context } from '../../types.js';
import { extractRequiredDynamicVariableContextForPermissions } from '../../utils/extract-required-dynamic-variable-context.js';
import { fetchDynamicVariableData } from '../../utils/fetch-dynamic-variable-data.js';
import { processPermissions } from '../../utils/process-permissions.js';
import { fetchBackofficePermissions } from './fetch-backoffice-permissions.js';

export interface BackofficeRule {
	/** Rows the action may touch; null = every row. */
	filter: Filter | null;
	/** Fields the action may touch; ['*'] = every field. */
	fields: string[];
	formats: string[];
}

export interface BackofficeAccess extends BackofficeRule {
	allowed: boolean;
	/** One rule per row; filter, fields and formats above add them up (what the caller may do at most). */
	rules: BackofficeRule[];
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

	if (accountability.admin) return accessOf([{ filter: null, fields: ['*'], formats: allFormats }]);

	const policies = await fetchPolicies(accountability, context);
	const rows = await fetchBackofficePermissions({ policies, collection, action }, context);

	if (rows.length === 0) return accessOf([]);

	const resolved = await resolveDynamicVariables(rows, accountability, policies, context);

	return accessOf(resolved.map((row) => toRule(row, allFormats)));
}

/** Only the rules that allow this format take part: a format of one policy never opens the rows of another (FR-011). */
export function forFormat(access: BackofficeAccess, format: string): BackofficeAccess {
	return accessOf(access.rules.filter((rule) => rule.formats.includes(format)));
}

/** A rule with no filter and every field: nothing to restrict. */
export function isUnrestricted(access: BackofficeAccess): boolean {
	return access.rules.some((rule) => !rule.filter && rule.fields.includes('*'));
}

/** What GET /permissions/me shows for the rows of one action: the rules added up, formats in registry order. */
export function combine(
	rows: Pick<BackofficePermission, 'permissions' | 'fields' | 'options'>[],
	allFormats: string[],
): BackofficeRule {
	const { filter, fields, formats } = accessOf(rows.map((row) => toRule(row, allFormats)));
	return { filter, fields, formats: allFormats.filter((format) => formats.includes(format)) };
}

function toRule(
	row: Pick<BackofficePermission, 'permissions' | 'fields' | 'options'>,
	allFormats: string[],
): BackofficeRule {
	const formats = row.options?.formats;

	return {
		filter: !row.permissions || isEmpty(row.permissions) ? null : row.permissions,
		fields: !row.fields || row.fields.includes('*') ? ['*'] : row.fields,
		formats: formats?.length ? allFormats.filter((format) => formats.includes(format)) : allFormats,
	};
}

function accessOf(rules: BackofficeRule[]): BackofficeAccess {
	if (rules.length === 0) return { allowed: false, filter: null, fields: [], formats: [], rules };

	const filter = rules.some((rule) => !rule.filter)
		? null
		: rules.length === 1
			? rules[0]!.filter
			: ({ _or: rules.map((rule) => rule.filter) } as Filter);

	const fields = rules.some((rule) => rule.fields.includes('*')) ? ['*'] : uniq(rules.flatMap((rule) => rule.fields));

	return { allowed: true, filter, fields, formats: uniq(rules.flatMap((rule) => rule.formats)), rules };
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
