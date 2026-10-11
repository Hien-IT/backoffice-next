import type { ParityRequest } from './parity.js';

/** Tokens made before the database snapshot (feature 004): a signed admin JWT and the static token of a user. */
export interface RequestSetAccounts {
	adminJwt: string;
	adminId: string;
	userToken: string;
	userId: string;
}

/**
 * Fixed set of requests covering every endpoint of feature 001, with and without credentials (FR-024, SC-003), plus
 * the auth requests of feature 003 that write nothing (FR-081).
 * Endpoints not built yet answer 404, so the set is valid in every phase and grows as US2 and US5 land.
 */
export function requestSet(options: { metrics?: boolean; accounts?: RequestSetAccounts } = {}): ParityRequest[] {
	const paths = ['/server/ping', '/server/health', '/server/info', '/server/specs/oas', '/', '/robots.txt', '/nope'];
	if (options.metrics) paths.push('/metrics');

	return [
		...paths.flatMap((path) => [
			{ path },
			{ path, headers: { authorization: 'Bearer invalid-token' } },
			{ path: `${path}${path.includes('?') ? '&' : '?'}access_token=invalid-token` },
		]),
		// Feature 003 (FR-081): auth requests that write nothing. Unknown emails, so no failed-login counter either.
		{
			method: 'POST',
			path: '/users/me/tfa/generate',
			headers: { authorization: 'Bearer invalid-token' },
			body: { password: 'x' },
		},
		{ path: '/auth' },
		{ method: 'POST', path: '/auth/login', body: { email: 'nobody-request-set@example.com', password: 'x' } },
		{ method: 'POST', path: '/auth/refresh', body: { refresh_token: 'x'.repeat(64) } },
		{ method: 'POST', path: '/auth/password/request', body: { email: 'nobody-request-set@example.com' } },
		...(options.accounts ? permissionRequests(options.accounts) : []),
	];
}

/**
 * Feature 004 (FR-091, contracts/db-writes.md §7): reads of the five endpoints and of the `me` routes, OPTIONS, and
 * requests refused before any write, as the admin, a user without permissions and the public.
 */
function permissionRequests(accounts: RequestSetAccounts): ParityRequest[] {
	const admin = { authorization: `Bearer ${accounts.adminJwt}` };
	const user = { authorization: `Bearer ${accounts.userToken}` };
	const endpoints = ['/users', '/roles', '/policies', '/access', '/permissions'];
	const me = [
		'/users/me',
		'/roles/me',
		'/policies/me/globals',
		'/permissions/me',
		`/permissions/me/directus_users/${accounts.userId}`,
	];

	return [
		...[admin, user, {}].flatMap((headers) => [
			...endpoints.flatMap((path) => [
				{ path: `${path}?limit=2&meta=*`, headers },
				{ method: 'SEARCH', path, headers, body: { query: { limit: 1, fields: ['id'] } } },
			]),
			...me.map((path) => ({ path, headers })),
		]),
		...endpoints.map((path) => ({ method: 'OPTIONS', path })),
		{ path: '/users/some', headers: admin },
		// Refused before the write: no permission, the last admin, invalid ip_access, a role cycle, Joi errors.
		{ method: 'POST', path: '/roles', headers: user, body: { name: 'request-set' } },
		{ method: 'PATCH', path: `/users/${accounts.userId}`, headers: user, body: { first_name: 'x' } },
		{ method: 'DELETE', path: `/users/${accounts.adminId}`, headers: admin },
		{ method: 'POST', path: '/policies', headers: admin, body: { name: 'request-set', ip_access: ['*'] } },
		{ method: 'POST', path: '/users/invite', headers: admin, body: { email: 'not-an-email' } },
		{ method: 'POST', path: '/users/invite/accept', body: { token: 'x', password: 'x' } },
		{ method: 'POST', path: '/users/register', body: { email: 'nobody-request-set@example.com', password: 'x' } },
		{ path: '/users/register/verify-email?token=' },
		{ method: 'POST', path: '/users/me/tfa/enable', headers: user, body: { secret: 'x' } },
		{ method: 'POST', path: '/users/me/tfa/disable', headers: user, body: { otp: '000000' } },
		{ method: 'PATCH', path: '/users/me/track/page', headers: user, body: {} },
	];
}
