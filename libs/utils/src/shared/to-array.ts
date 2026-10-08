// Ported from directus/packages/utils/shared/to-array.ts
export function toArray<T = any>(val: T | T[]): T[] {
	if (typeof val === 'string') {
		return val.split(',') as unknown as T[];
	}

	return Array.isArray(val) ? val : [val];
}
