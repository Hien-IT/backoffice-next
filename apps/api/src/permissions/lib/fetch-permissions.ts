// Ported from directus/api/src/permissions/lib/fetch-permissions.ts. The raw read and its cache are in
// utils/fetch-raw-permissions.ts like in Directus (feature 002). Dynamic variables ($CURRENT_USER...) and shares are
// not resolved yet: every request is public until features 003 and 004.
import type { Accountability, PermissionsAction } from '@backoffice/types';
import type { Context } from '../types.js';
import { fetchRawPermissions } from '../utils/fetch-raw-permissions.js';

export interface FetchPermissionsOptions {
	action?: PermissionsAction;
	policies: string[];
	collections?: string[];
	accountability?: Pick<Accountability, 'user' | 'role' | 'roles' | 'app' | 'share' | 'ip'>;
	bypassDynamicVariableProcessing?: boolean;
}

export async function fetchPermissions(options: FetchPermissionsOptions, context: Context) {
	return await fetchRawPermissions(
		{ ...options, bypassMinimalAppPermissions: options.bypassDynamicVariableProcessing ?? false },
		context,
	);
}
