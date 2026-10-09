import type { ParityRequest } from './parity.js';

/**
 * Fixed set of requests covering every endpoint of feature 001, with and without credentials (FR-024, SC-003).
 * Endpoints not built yet answer 404, so the set is valid in every phase and grows as US2 and US5 land.
 */
export function requestSet(options: { metrics?: boolean } = {}): ParityRequest[] {
	const paths = ['/server/ping', '/server/health', '/server/info', '/server/specs/oas', '/', '/robots.txt', '/nope'];
	if (options.metrics) paths.push('/metrics');

	return paths.flatMap((path) => [
		{ path },
		{ path, headers: { authorization: 'Bearer invalid-token' } },
		{ path: `${path}${path.includes('?') ? '&' : '?'}access_token=invalid-token` },
	]);
}
