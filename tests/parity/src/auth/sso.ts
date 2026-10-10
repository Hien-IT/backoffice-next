// Feature 003 (US7, research R10): SSO flows against the test identity provider of the `sso` profile. The apps reach
// it as http://idp:9000; the tests, on the host, as http://127.0.0.1:6110.
import { capture, type Captured } from '../parity.js';
import { cookiePair } from './flows.js';

export const IDP = 'http://127.0.0.1:6110';

export async function idpUser(sub: string, claims: Record<string, unknown>): Promise<void> {
	// nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request -- the test IdP of the sso profile, local HTTP only
	const res = await fetch(`${IDP}/__users`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ sub, claims }),
	});

	if (res.status !== 204) throw new Error(`IdP /__users: ${res.status}`);
}

/** The next refresh at the IdP answers invalid_grant. */
export async function idpRefreshError(): Promise<void> {
	// nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request -- the test IdP of the sso profile, local HTTP only
	await fetch(`${IDP}/__refresh-error`, { method: 'POST' });
}

export interface SsoFlow {
	begin: Captured;
	/** `name=value` of the state cookie (openid.<provider> or oauth2.<provider>). */
	cookie: string;
	/** Path and query of the callback the IdP redirects to. */
	callbackPath: string;
}

/** GET /auth/login/<provider> at `url`, then the IdP authorize step as `sub` (auto-approved). */
export async function startSso(url: string, host: string, provider: string, sub: string, query = ''): Promise<SsoFlow> {
	const begin = await capture(url, { path: `/auth/login/${provider}${query}`, headers: { host } });
	if (begin.status !== 302) throw new Error(`GET /auth/login/${provider}: ${begin.status} ${begin.text}`);

	const authorize = new URL(begin.headers['location']!);
	const idp = new URL(IDP);
	authorize.protocol = idp.protocol;
	authorize.host = idp.host;
	authorize.searchParams.set('user', sub);

	const approved = await fetch(authorize, { redirect: 'manual' });
	const location = approved.headers.get('location');
	if (approved.status !== 302 || !location)
		throw new Error(`IdP authorize: ${approved.status} ${await approved.text()}`);

	const back = new URL(location);
	return { begin, cookie: cookiePair(begin), callbackPath: back.pathname + back.search };
}

/** GET of the callback at `url` with the state cookie of the flow. */
export function finishSso(url: string, host: string, flow: SsoFlow, cookie = flow.cookie): Promise<Captured> {
	return capture(url, { path: flow.callbackPath, headers: { host, cookie } });
}
