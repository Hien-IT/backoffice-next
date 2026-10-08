// Ported from directus/packages/utils/shared/is-object.ts
import type { UnknownObject } from '@backoffice/types';

export function isObject(input: unknown): input is UnknownObject {
	return typeof input === 'object' && input !== null && !Array.isArray(input);
}
