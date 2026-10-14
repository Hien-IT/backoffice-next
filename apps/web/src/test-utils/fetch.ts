import { vi } from 'vitest';
import { createSdk } from '../api/sdk.ts';

export const API = 'http://api.test/';

type Answer = unknown | ((request: { url: URL; init: RequestInit }) => Response | Promise<Response>);

export function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/**
 * Stubs the global fetch and creates the SDK on http://api.test/. `answers` maps "METHOD /path" (query ignored) to
 * a `data` value or a function returning a Response; anything else answers 404. Returns the fetch mock.
 */
export function mockApi(answers: Record<string, Answer>) {
	const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		const answer = answers[`${init.method ?? 'GET'} ${url.pathname}`];

		if (answer === undefined)
			return json({ errors: [{ message: 'Not found', extensions: { code: 'ROUTE_NOT_FOUND' } }] }, 404);
		if (typeof answer === 'function') return answer({ url, init });
		return json({ data: answer });
	});

	vi.stubGlobal('fetch', fetch);
	createSdk(API);

	return fetch;
}

/** "METHOD /path?query" of every call of a fetch mock, in order. */
export function calls(fetch: ReturnType<typeof mockApi>): string[] {
	return fetch.mock.calls.map(([input, init]) => {
		const url = new URL(String(input));
		return `${init?.method ?? 'GET'} ${decodeURIComponent(url.pathname + url.search)}`;
	});
}
