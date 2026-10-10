import type { ParityRequest } from './parity.js';

/**
 * Fixed set of requests covering every endpoint of feature 001, with and without credentials (FR-024, SC-003), plus
 * the auth requests of feature 003 that write nothing (FR-081).
 * Endpoints not built yet answer 404, so the set is valid in every phase and grows as US2 and US5 land.
 */
export function requestSet(options: { metrics?: boolean } = {}): ParityRequest[] {
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
	];
}
