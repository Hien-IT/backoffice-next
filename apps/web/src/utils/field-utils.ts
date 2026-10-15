// Ported from directus/app/src/utils/field-utils.ts
import type { DeepPartial, Field } from '@directus/types';

// Backoffice: RELATIONAL_TYPES of @directus/constants (not a dependency of apps/web).
const RELATIONAL_TYPES = ['file', 'files', 'm2o', 'o2m', 'm2m', 'm2a', 'translations'];

export function isPrimaryKey(field: DeepPartial<Field>) {
	return field.schema?.is_primary_key === true;
}

export function isHidden(field: DeepPartial<Field>) {
	return field.meta?.hidden === true;
}

export function isRelational(field: DeepPartial<Field>) {
	return field.meta?.special?.find((type) => RELATIONAL_TYPES.includes(type as string)) !== undefined;
}

export function isDateUpdated(field: DeepPartial<Field>) {
	return field.meta?.special?.some((type) => type === 'date-updated') ?? false;
}

export function isDateCreated(field: DeepPartial<Field>) {
	return field.meta?.special?.some((type) => type === 'date-created') ?? false;
}

export function isUserUpdated(field: DeepPartial<Field>) {
	return field.meta?.special?.some((type) => type === 'user-updated') ?? false;
}

export function isUserCreated(field: DeepPartial<Field>) {
	return field.meta?.special?.some((type) => type === 'user-created') ?? false;
}
