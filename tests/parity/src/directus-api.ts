// Writes test data through the REST API of an app (admin from env/<vendor>.env), so the app purges its own cache like
// for any real change. Until feature 004 only Directus wrote; from feature 004 fixtures of write flows are made through
// the API of the app under test (appRequest), read-only fixtures still through Directus (spec 004 Assumptions).
export type AppName = 'directus' | 'backoffice';

const tokens = new Map<AppName, { token: string; at: number }>();

// Both apps issue the admin token for ACCESS_TOKEN_TTL (15 min by default): a run longer than that (a matrix shard took
// 905 s on CI run 38889659846) logs in again before it expires.
const TOKEN_REUSE_MS = 10 * 60_000;

async function login(app: AppName): Promise<string> {
	const cached = tokens.get(app);
	if (cached && Date.now() - cached.at < TOKEN_REUSE_MS) return cached.token;

	const res = await fetch(new URL('/auth/login', appUrl(app)), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email: 'admin@example.com', password: 'password' }),
	});

	if (!res.ok) throw new Error(`${app} login failed: ${res.status} ${await res.text()}`);
	const token = ((await res.json()) as { data: { access_token: string } }).data.access_token;
	tokens.set(app, { token, at: Date.now() });
	return token;
}

/** Access token of the admin of `app`, issued by that app (cached per process). */
export const adminToken = login;

/** Base URL of the main pair for an app (set by global-setup). */
export function appUrl(app: AppName): string {
	const url = process.env[app === 'directus' ? 'DIRECTUS_URL' : 'BACKOFFICE_URL'];
	if (!url) throw new Error(`${app === 'directus' ? 'DIRECTUS_URL' : 'BACKOFFICE_URL'} must be set`);
	return url;
}

/** Sends a request as the admin of `app` (token issued by that app) and returns the parsed body; throws on 4xx/5xx. */
export async function appRequest(
	app: AppName,
	method: string,
	path: string,
	body?: unknown,
	baseUrl = appUrl(app),
): Promise<any> {
	const res = await fetch(new URL(path, baseUrl), {
		method,
		headers: {
			authorization: `Bearer ${await login(app)}`,
			...(body !== undefined && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
		},
		...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
	});

	const text = await res.text();
	if (!res.ok) throw new Error(`${app} ${method} ${path}: ${res.status} ${text}`);
	return text ? JSON.parse(text) : undefined;
}

/** Admin request to Directus; `baseUrl` targets a profile pair (same DB and SECRET, so the main-pair token works). */
export function directusRequest(method: string, path: string, body?: unknown, baseUrl?: string): Promise<any> {
	return appRequest('directus', method, path, body, baseUrl);
}
