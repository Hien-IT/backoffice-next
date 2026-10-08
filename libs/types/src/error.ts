// Ported from directus/packages/types/src/error.ts
export interface BackofficeError<Extensions = void> extends Error {
	extensions: Extensions;
	code: string;
	status: number;
}
