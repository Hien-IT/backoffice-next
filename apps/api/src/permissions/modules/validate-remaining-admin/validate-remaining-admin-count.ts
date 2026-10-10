// Ported from directus/api/src/permissions/modules/validate-remaining-admin/validate-remaining-admin-count.ts
import { UnprocessableContentError } from '@backoffice/errors';

export function validateRemainingAdminCount(count: number) {
	if (count <= 0) {
		throw new UnprocessableContentError({
			reason: `Cannot remove the last admin user from the system`,
		});
	}
}
