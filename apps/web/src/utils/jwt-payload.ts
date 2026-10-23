// Ported from directus/app/src/utils/jwt-payload.ts
export function jwtPayload(token: string): any {
	const payloadBase64 = token.split('.')[1];

	if (!payloadBase64) throw new Error('Invalid JWT token');

	// Backoffice: replaceAll (DR replaces only the first '-' and '_') and atob + TextDecoder instead of the
	// base-64 package, so non-ASCII claims (names) decode as UTF-8.
	const payloadBase64Clean = payloadBase64.replaceAll('-', '+').replaceAll('_', '/');
	const payloadDecoded = new TextDecoder().decode(Uint8Array.from(atob(payloadBase64Clean), (c) => c.charCodeAt(0)));
	const payloadObject = JSON.parse(payloadDecoded);

	return payloadObject;
}
