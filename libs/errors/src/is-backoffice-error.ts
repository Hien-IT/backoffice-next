// Ported from directus/packages/errors/src/is-directus-error.ts
import type { BackofficeError } from './create-error.js';
import type { ExtensionsMap } from './types.js';

/**
 * Check whether or not a passed value is a valid Backoffice error.
 *
 * @param value - Any value
 * @param code - Error code to check for
 */
export const isBackofficeError = <T = never, C extends string = string>(
	value: unknown,
	code?: C,
): value is BackofficeError<[T] extends [never] ? (C extends keyof ExtensionsMap ? ExtensionsMap[C] : unknown) : T> => {
	const isBackofficeError =
		typeof value === 'object' &&
		value !== null &&
		Array.isArray(value) === false &&
		'name' in value &&
		value.name === 'DirectusError';

	if (code) {
		return isBackofficeError && 'code' in value && value.code === code.toUpperCase();
	}

	return isBackofficeError;
};
