// Ported from directus/app/src/composables/use-permissions/utils/is-field-allowed.ts
import type { ActionPermission } from '../../../stores/permissions.ts';

export const isFieldAllowed = (permission: ActionPermission, field: string) => {
	if (!permission.fields) return false;

	return permission.fields.includes('*') || permission.fields.includes(field);
};
