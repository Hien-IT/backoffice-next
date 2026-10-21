// Backoffice (recipes Q-42, Q-43): the text of a failed registry request, the message of the API error (the reason
// of handleRegistryError for a 503), else the translated error code.
import { type APIError, translateAPIError } from '../../../../../lang/index.ts';

export function registryError(error: unknown): string {
	const message = (error as { errors?: { message?: unknown }[] } | null)?.errors?.[0]?.message;
	return typeof message === 'string' && message ? message : translateAPIError(error as APIError);
}
