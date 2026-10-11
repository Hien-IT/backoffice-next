// Ported from directus/api/src/utils/get-string-byte-size.ts
/**
 * Returns the byte size for a given input string
 */
export function stringByteSize(string: string): number {
	return Buffer.byteLength(string, 'utf-8');
}
