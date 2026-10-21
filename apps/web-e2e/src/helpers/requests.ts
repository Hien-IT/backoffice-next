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
// Firefox logs a font download cut by a navigation (NS_BINDING_ABORTED, 0x804b0002) as a console error.
const NETWORK_ERROR = /^Failed to load resource|downloadable font: download failed .*status=2152398850 /;
// webkit also reports an aborted cross-origin fetch as "... due to access control checks."
const NAVIGATION_ABORT =
	/^(TypeError: )?(Load failed|NetworkError when attempting to fetch resource\.|Failed to fetch)$|due to access control checks\.$/;
// shortcut: WebKit on the Linux CI runner (not on macOS, not with the same nginx image locally) logs this for the
// maplibre module worker of the map interface although the worker is served 200 as JavaScript; chromium and firefox
// still catch a broken worker (the .mjs MIME bug of feature 014). Revisit when the Playwright WebKit build changes.
const WEBKIT_WORKER = /^Error: Worker failed to load\. Check that the worker URL is correct\.$/;
// WebKit logs a lazy route chunk whose import a navigation cut (sign-out, a new page.goto) as this console error; a
// chunk that really fails to load still fails in chromium and firefox ("Failed to fetch dynamically imported module").
const WEBKIT_IMPORT_ABORT = /^TypeError: Importing a module script failed\.$/;
// Spec 020: specs that point config.json at another API pair (sso, setup) load its extension bundle from an origin the
// CSP of the web image does not list (the image allows the API of its PUBLIC_URL, as in a real deployment); the app
// carries on without extensions (loadExtensions warns), the browser logs the blocked script.
const CSP_EXTENSIONS =
	/^Loading the script '[^']+\/extensions\/sources\/index\.js' violates the following Content Security Policy/;
// The app's missingWarn (`[i18n] missing key ...`) and the vue-i18n default (`[intlify] Not found 'x' key ...`).
const MISSING_KEY = /^\[i18n\] missing key|^\[intlify\] Not found '.*' key/;
// Directus 11.17.4 has no strings for the notes of its deployment system collections (system-data collections.yaml
// `$t:directus_collection.directus_deployment*`): both apps show the key on the data model page (feature 016).
const DIRECTUS_MISSING_KEY = /missing key:? directus_collection\.directus_deployment(s|_projects|_runs)$/;

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
		async ({ page, apiUrl, browserName }, use) => {
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
				// A benign browser notice (WebKit), not an app error.
				if (error.message === 'ResizeObserver loop completed with undelivered notifications.') return;
				problems.push(`pageerror: ${error.message}`);
			});

			page.on('console', (message) => {
				const text = message.text();
				const ignored =
					NETWORK_ERROR.test(text) ||
					CSP_EXTENSIONS.test(text) ||
					(browserName === 'webkit' && (WEBKIT_WORKER.test(text) || WEBKIT_IMPORT_ABORT.test(text)));
				if (message.type() === 'error' && !ignored) problems.push(`console.error: ${text}`);
				if (message.type() === 'warning' && MISSING_KEY.test(text) && !DIRECTUS_MISSING_KEY.test(text))
					problems.push(`missing key: ${text}`);
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
