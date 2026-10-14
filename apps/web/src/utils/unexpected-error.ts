// Ported from directus/app/src/utils/unexpected-error.ts
// Backoffice: no notifications store before feature 018 (D-45): the console warning is kept and the error is
// returned, so the caller can show it in place (FR-046: danger notice with translateAPIError).
export function unexpectedError<T>(error: T): T {
	// eslint-disable-next-line no-console
	console.warn(error);
	return error;
}
