// Ported from directus/api/src/permissions/modules/process-ast/utils/has-item-permissions.ts
import type { Permission } from '@backoffice/types';

export function hasItemPermissions(permission: Permission) {
	return permission.permissions !== null && Object.keys(permission.permissions).length > 0;
}
