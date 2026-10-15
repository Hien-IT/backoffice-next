// Ported from directus/app/src/utils/extract-error-code.ts
// Backoffice: errors come from @directus/sdk (an `errors` list) or are API error objects; no axios response.
type ErrorList = { extensions?: { code?: string } }[];

export function extractErrorCode(error: unknown): string {
	return (
		(error as { errors?: ErrorList } | null)?.errors?.[0]?.extensions?.code ||
		(error as { response?: { data?: { errors?: ErrorList } } } | null)?.response?.data?.errors?.[0]?.extensions?.code ||
		(error as { extensions?: { code?: string } } | null)?.extensions?.code ||
		'UNKNOWN'
	);
}
