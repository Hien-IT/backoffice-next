// Ported from directus/app/src/app-permissions.ts
// Backoffice (spec 016 FR-055): the rows come from src/permissions/app-permissions-data.json, rendered from the
// DR 11.17.4 sources by scripts/sync-permissions-data.mjs. `appAccessMinimalPermissions` is the export of
// @directus/system-data (not a dependency of apps/web) with the same rows.
import type { Permission, PermissionsAction } from '@directus/types';
import data from '../../../permissions/app-permissions-data.json';

export const appAccessMinimalPermissions = data.minimal as unknown as Partial<Permission>[];

export const appRecommendedPermissions = data.recommended as unknown as Partial<Permission>[];

// Backoffice (spec 025, D-189.3): no share column; import and export from backoffice_permissions. The actions of DR
// are unchanged at the API (PERMISSION_ACTIONS of @directus/constants).
export const editablePermissionActions = ['create', 'read', 'update', 'delete', 'import', 'export'] as const;
export type EditablePermissionsAction = (typeof editablePermissionActions)[number];

/**
 * Backoffice (spec 025, FR-003): a copy of BACKOFFICE_PERMISSION_ACTIONS of @backoffice/constants (apps/web has no
 * @backoffice/* dependency, research T001 a): the formats each action supports.
 */
export const backofficeActions = {
	import: { formats: ['csv', 'json'] },
	export: { formats: ['csv', 'csv_utf8', 'json', 'xml', 'yaml'] },
} as const;

export type BackofficeAction = keyof typeof backofficeActions;

/** An action of a matrix cell: one of DR (directus_permissions) or of Backoffice (backoffice_permissions). */
export type MatrixAction = PermissionsAction | BackofficeAction;

export function isBackofficeAction(action: string): action is BackofficeAction {
	return action in backofficeActions;
}

export const disabledActions: Record<string, EditablePermissionsAction[]> = data.disabledActions as Record<
	string,
	EditablePermissionsAction[]
>;
