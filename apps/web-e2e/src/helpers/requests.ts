// The `test` of every spec (FR-002, SC-001, CHK083): records each request the page sends to the API and, after the test,
// fails when one is outside contracts/api-calls.md (helpers/allowed-paths.ts), carries an Authorization header (session
// mode only, FR-073), or when the page threw, logged an error or a missing translation key. Outside hosts are stubbed or
// aborted (helpers/external-hosts.ts, feature 014).
import { test as base, expect } from '@playwright/test';
import { isAllowedCall } from './allowed-paths.js';
import { apiUrl } from './config.js';
import { stubExternalHosts } from './external-hosts.js';

export interface ApiRequest {
	method: string;
	/** Path relative to apiUrl, without the query. */
	path: string;
	url: string;
	authorization: boolean;
}

// Chromium and WebKit log every 4xx/5xx answer (e.g. the expected 401 of /auth/refresh before login) as a console error.
const NETWORK_ERROR = /^Failed to load resource/;
// webkit also reports an aborted cross-origin fetch as "... due to access control checks."
const NAVIGATION_ABORT =
	/^(TypeError: )?(Load failed|NetworkError when attempting to fetch resource\.|Failed to fetch)$|due to access control checks\.$/;
// The app's missingWarn (`[i18n] missing key ...`) and the vue-i18n default (`[intlify] Not found 'x' key ...`).
const MISSING_KEY = /^\[i18n\] missing key|^\[intlify\] Not found '.*' key/;

/** `path` of a request to the API, or undefined for any other URL (the app's own files under /admin/ included). */
export function apiPath(url: string, api: string): string | undefined {
	const base = new URL(api);
	const target = new URL(url);
	const prefix = base.pathname.replace(/\/$/, '');
	if (target.origin !== base.origin || !target.pathname.startsWith(`${prefix}/`)) return undefined;
	const path = target.pathname.slice(prefix.length);
	return path === '/admin' || path.startsWith('/admin/') ? undefined : path;
}

export const test = base.extend<{ apiUrl: string; apiRequests: ApiRequest[] }>({
	// Specs that point config.json at another API (sso, setup pairs, research R13) override it with test.use().
	apiUrl: [apiUrl, { option: true }],
	apiRequests: [
		async ({ page, apiUrl }, use) => {
			const requests: ApiRequest[] = [];
			const problems: string[] = [];
			// Registered first: routes a spec adds later take precedence (Playwright runs the newest matching route first).
			await stubExternalHosts(page);

			page.on('request', (request) => {
				const path = apiPath(request.url(), apiUrl);
				if (path === undefined) return;
				const authorization = 'authorization' in request.headers();
				requests.push({ method: request.method(), path, url: request.url(), authorization });
			});

			page.on('pageerror', (error) => {
				// A request the next page.goto aborts rejects its promise (Directus app code does not catch these either):
				// the network error text of webkit, firefox and chromium, not an app error.
				if (NAVIGATION_ABORT.test(error.message)) return;
				problems.push(`pageerror: ${error.message}`);
			});

			page.on('console', (message) => {
				const text = message.text();
				if (message.type() === 'error' && !NETWORK_ERROR.test(text)) problems.push(`console.error: ${text}`);
				if (message.type() === 'warning' && MISSING_KEY.test(text)) problems.push(`missing key: ${text}`);
			});

			await use(requests);

			const unknown = requests.filter((r) => !isAllowedCall(r.method, r.path)).map((r) => `${r.method} ${r.url}`);
			expect(unknown, 'requests outside contracts/api-calls.md').toEqual([]);
			const withAuth = requests.filter((r) => r.authorization).map((r) => `${r.method} ${r.url}`);
			expect(withAuth, 'requests with an Authorization header').toEqual([]);
			expect(problems, 'page errors, console errors and missing translation keys').toEqual([]);
		},
		{ auto: true },
	],
});

export { expect };
