import type { ParityRequest } from './parity.js';

/** Tokens made before the database snapshot (feature 004): a signed admin JWT and the static token of a user. */
export interface RequestSetAccounts {
	adminJwt: string;
	adminId: string;
	userToken: string;
	userId: string;
	/** Feature 005: a user collection with one item, made before the snapshot. */
	items?: { collection: string; id: string | number };
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
		...(options.accounts?.items ? itemRequests(options.accounts, options.accounts.items) : []),
		...(options.accounts ? dataModelRequests(options.accounts) : []),
	];
}

/**
 * Feature 006 (research R6): reads of the data model routes as the admin, a user without permissions and the public,
 * OPTIONS, and writes refused before any DDL (no permission, collection-exists, Joi, zod of system fields, D-32 is not
 * sent: Directus would drop the table). /schema/snapshot joins with its route (T037).
 */
function dataModelRequests(accounts: RequestSetAccounts): ParityRequest[] {
	const admin = { authorization: `Bearer ${accounts.adminJwt}` };
	const user = { authorization: `Bearer ${accounts.userToken}` };

	return [
		...[admin, user, {}].flatMap((headers) => [
			{ path: '/collections', headers },
			{ path: '/collections/directus_users', headers },
			{ path: '/fields', headers },
			{ path: '/fields/directus_users', headers },
			{ path: '/fields/directus_users/email', headers },
			{ path: '/relations', headers },
			{ path: '/relations/directus_users', headers },
		]),
		...['/collections', '/collections/x', '/fields', '/fields/x', '/fields/x/y', '/relations', '/relations/x/y'].map(
			(path) => ({
				method: 'OPTIONS',
				path,
			}),
		),
		{ method: 'SEARCH', path: '/collections', headers: admin, body: { keys: ['directus_users'] } },
		{ path: '/fields/nope', headers: admin },
		// Refused before any DDL.
		{ method: 'POST', path: '/collections', headers: user, body: { collection: 'request_set', schema: {} } },
		{ method: 'POST', path: '/collections', headers: admin, body: { collection: 'directus_request_set' } },
		{ method: 'PATCH', path: '/collections/directus_users', headers: user, body: { meta: {} } },
		{ method: 'POST', path: '/fields/nope', headers: admin, body: { field: 'x', type: 'string' } },
		{ method: 'POST', path: '/fields/directus_users', headers: admin, body: { field: 'x', type: 'nope' } },
		{ method: 'PATCH', path: '/fields/directus_users/email', headers: admin, body: { meta: { note: 'x' } } },
		{ method: 'PATCH', path: '/fields/directus_users', headers: admin, body: { field: 'email' } },
		{ method: 'DELETE', path: '/fields/directus_users/email', headers: admin },
		{ method: 'POST', path: '/relations', headers: admin, body: { collection: 'directus_users' } },
		{ method: 'POST', path: '/relations', headers: user, body: { collection: 'directus_users', field: 'role' } },
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

/**
 * Feature 005 (contracts/parity-blackbox.md §4): reads of /items as the admin, a user without permissions and the
 * public, OPTIONS, collections that do not answer, and writes refused before any write. The export requests come
 * with the export of feature 005 (T028).
 */
function itemRequests(accounts: RequestSetAccounts, items: NonNullable<RequestSetAccounts['items']>): ParityRequest[] {
	const admin = { authorization: `Bearer ${accounts.adminJwt}` };
	const user = { authorization: `Bearer ${accounts.userToken}` };
	const list = `/items/${items.collection}`;
	const one = `${list}/${items.id}`;

	return [
		...[admin, user, {}].flatMap((headers) => [
			{ path: `${list}?limit=2&meta=*`, headers },
			{ method: 'SEARCH', path: list, headers, body: { query: { limit: 1 } } },
			{ path: one, headers },
		]),
		{ method: 'OPTIONS', path: list },
		{ method: 'OPTIONS', path: one },
		// Feature 005 (D-12): the list as a file.
		{ path: `${list}?export=csv&sort=id`, headers: admin },
		{ path: `${list}?export=json&sort=id`, headers: admin },
		{ path: '/items/nope', headers: admin },
		{ path: '/items/directus_users', headers: admin },
		{ method: 'SEARCH', path: list, headers: admin },
		// Refused before the write: no permission, a system collection, an invalid batch body.
		{ method: 'POST', path: list, headers: user, body: { id: 'request-set' } },
		{ method: 'PATCH', path: one, headers: user, body: {} },
		{ method: 'DELETE', path: list, headers: user, body: [items.id] },
		{ method: 'PATCH', path: '/items/directus_users', headers: admin, body: { keys: [accounts.userId], data: {} } },
		{ method: 'PATCH', path: list, headers: admin, body: { data: {} } },
	];
}
