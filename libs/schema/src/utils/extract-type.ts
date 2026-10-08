// Ported from directus/packages/schema/src/utils/extract-type.ts
/**
 * Extracts the type out of a given datatype
 * For example: `varchar(32)` => varchar
 */
export default function extractType(type: string): string {
	return type.replace(/[^a-zA-Z]/g, '').toLowerCase();
}
