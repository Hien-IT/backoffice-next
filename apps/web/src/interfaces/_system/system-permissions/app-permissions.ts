// Ported from directus/app/src/app-permissions.ts
// Backoffice (spec 016 FR-055): the rows come from src/permissions/app-permissions-data.json, rendered from the
// Directus 11.17.4 sources by scripts/sync-permissions-data.mjs. `appAccessMinimalPermissions` is the export of
// @directus/system-data (not a dependency of apps/web) with the same rows.
import type { Permission, PermissionsAction } from '@directus/types';
import data from '../../../permissions/app-permissions-data.json';

export const appAccessMinimalPermissions = data.minimal as unknown as Partial<Permission>[];

export const appRecommendedPermissions = data.recommended as unknown as Partial<Permission>[];

export const editablePermissionActions = ['create', 'read', 'update', 'delete', 'share'] as const;
export type EditablePermissionsAction = (typeof editablePermissionActions)[number] & PermissionsAction;

export const disabledActions: Record<string, EditablePermissionsAction[]> = data.disabledActions as Record<
	string,
	EditablePermissionsAction[]
>;
