// Ported from directus/api/src/permissions/modules/fetch-accountability-collection-access/fetch-accountability-collection-access.ts
import {
	BACKOFFICE_PERMISSION_ACTIONS,
	type BackofficePermissionsAction,
	PERMISSION_ACTIONS,
} from '@backoffice/constants';
import type { Accountability, BackofficePermission, CollectionAccess, CollectionPermissions } from '@backoffice/types';
import { mapValues, uniq } from 'lodash-es';
import { fetchPermissions } from '../../lib/fetch-permissions.js';
import { fetchPolicies } from '../../lib/fetch-policies.js';
import type { Context } from '../../types.js';
import { combine } from '../backoffice-permissions/fetch-backoffice-access.js';
import { fetchBackofficePermissions } from '../backoffice-permissions/fetch-backoffice-permissions.js';

/**
 * Get all permissions + minimal app permissions (if applicable) for the user + role in the current accountability.
 * The permissions will be filtered by IP access.
 */
export async function fetchAccountabilityCollectionAccess(
	accountability: Pick<Accountability, 'user' | 'roles' | 'role' | 'ip' | 'admin' | 'app'>,
	context: Context,
): Promise<CollectionAccess> {
	if (accountability.admin) {
		return mapValues(
			context.schema.collections,
			() =>
				Object.fromEntries([
					...PERMISSION_ACTIONS.map((action) => [
						action,
						{
							access: 'full',
							fields: ['*'],
						},
					]),
					// Backoffice (spec 025, D-189): plus import and export, every format.
					...ADMIN_BACKOFFICE_ACTIONS,
				]) as CollectionPermissions,
		);
	}

	const policies = await fetchPolicies(accountability, context);

	const permissions = await fetchPermissions({ policies, accountability }, context);

	const infos: CollectionAccess = {};

	for (const perm of permissions) {
		// Ensure that collection is in infos
		if (!infos[perm.collection]) {
			infos[perm.collection] = {
				read: { access: 'none' },
				create: { access: 'none' },
				update: { access: 'none' },
				delete: { access: 'none' },
				share: { access: 'none' },
			};
		}

		// Ensure that action with default values is in collection infos
		if (infos[perm.collection]![perm.action]?.access === 'none') {
			// If a permissions is iterated over it means that the user has access to it, so set access to 'full'
			// Set access to 'full' initially and refine that whenever a permission with filters is encountered
			infos[perm.collection]![perm.action]!.access = 'full';
		}

		const info = infos[perm.collection]![perm.action]!;

		// Set access to 'partial' if the permission has filters, which means that the user has conditional access
		if (info.access === 'full' && perm.permissions && Object.keys(perm.permissions).length > 0) {
			info.access = 'partial';
		}

		if (perm.fields && info.fields?.[0] !== '*') {
			info.fields = uniq([...(info.fields || []), ...(perm.fields || [])]);

			if (info.fields.includes('*')) {
				info.fields = ['*'];
			}
		}

		if (perm.presets) {
			info.presets = { ...(info.presets ?? {}), ...perm.presets };
		}
	}

	// Backoffice (spec 025, FR-018, D-189): the import and export actions of backoffice_permissions, for the collections
	// listed above only (one with rows in the new table only is left out, as DR leaves out a collection without rows;
	// analyze U1).
	await addBackofficeActions(infos, policies, context);

	// TODO Should fields by null, undefined or and empty array if no access?

	return infos;
}

const BACKOFFICE_ACTIONS = Object.keys(BACKOFFICE_PERMISSION_ACTIONS) as BackofficePermissionsAction[];

const ADMIN_BACKOFFICE_ACTIONS = BACKOFFICE_ACTIONS.map((action) => [
	action,
	{ access: 'full', fields: ['*'], formats: [...BACKOFFICE_PERMISSION_ACTIONS[action].formats] },
]);

async function addBackofficeActions(infos: CollectionAccess, policies: string[], context: Context) {
	const rows = await fetchBackofficePermissions({ policies }, context);

	for (const [collection, info] of Object.entries(infos)) {
		for (const action of BACKOFFICE_ACTIONS) {
			const own = rows.filter((row: BackofficePermission) => row.collection === collection && row.action === action);

			if (own.length === 0) {
				info[action] = { access: 'none' };
				continue;
			}

			const { filter, fields, formats } = combine(own, [...BACKOFFICE_PERMISSION_ACTIONS[action].formats]);
			info[action] = { access: filter ? 'partial' : 'full', fields, formats };
		}
	}
}
