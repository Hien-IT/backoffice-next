// Ported from directus/packages/utils/shared/get-output-type-for-function.ts
import type { FieldFunction, Type } from '@backoffice/types';

export function getOutputTypeForFunction(fn: FieldFunction): Type {
	// Backoffice: same missing `json` entry as Directus; the cast keeps strict typecheck green with the same runtime map.
	const typeMap = {
		year: 'integer',
		month: 'integer',
		week: 'integer',
		day: 'integer',
		weekday: 'integer',
		hour: 'integer',
		minute: 'integer',
		second: 'integer',
		count: 'integer',
	} as Record<FieldFunction, Type>;

	return typeMap[fn];
}
