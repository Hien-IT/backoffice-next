// Ported from directus/api/src/permissions/modules/process-payload/lib/is-field-nullable.ts
import { GENERATE_SPECIAL } from '@backoffice/constants';
import type { FieldOverview } from '@backoffice/types';

/**
 * Checks if a given field is allowed to be set to `null`.
 */
export function isFieldNullable(field: FieldOverview) {
	if (field.nullable) return true;
	if (field.generated) return true;

	const hasGenerateSpecial = GENERATE_SPECIAL.some((name) => field.special.includes(name));

	return hasGenerateSpecial;
}
