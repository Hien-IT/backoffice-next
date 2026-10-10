// Feature 003: steps the stateful auth tests share (login, then refresh or logout with what the login returned).
import type { Captured, ParityRequest } from '../parity.js';
import { normalizeJwt } from '../normalizers.js';
import { PASSWORD, type User } from './fixtures.js';
import { type ScenarioContext, send } from './scenario.js';

export type Mode = 'json' | 'cookie' | 'session';
export const MODES: Mode[] = ['json', 'cookie', 'session'];

export const post = (path: string, body: Record<string, unknown> = {}, cookie?: string): ParityRequest => ({
	method: 'POST',
	path,
	body,
	...(cookie ? { headers: { cookie } } : {}),
});

/** `name=value` of the first Set-Cookie of a response. */
export function cookiePair(res: Captured): string {
	const header = res.headers['set-cookie'];
	if (!header) throw new Error(`no Set-Cookie (status ${res.status})`);
	return header.split('\n')[0]!.split(';')[0]!;
}

/** `name=value` of the Set-Cookie named `name`. */
export function cookieNamed(res: Captured, name: string): string {
	const pair = res.headers['set-cookie']
		?.split('\n')
		.map((cookie) => cookie.split(';')[0]!)
		.find((p) => p.startsWith(`${name}=`));

	if (!pair) throw new Error(`no ${name} cookie (status ${res.status})`);
	return pair;
}

/** Claims and ttl of the JWT in a Set-Cookie (normalizeSetCookie only keeps its kind). */
export const cookieJwt = (res: Captured): unknown => normalizeJwt(cookiePair(res).split('=')[1]!);

export function login(ctx: ScenarioContext, user: User, mode: Mode): Promise<Captured> {
	return send(ctx.url, post('/auth/login', { email: user.email, password: PASSWORD, mode }), ctx.host);
}

/** The request that sends back the refresh token a login (or refresh) answer carries, in its mode. */
export function withToken(path: string, res: Captured, mode: Mode): ParityRequest {
	if (mode === 'json') return post(path, { refresh_token: (res.json as any).data.refresh_token });
	return post(path, mode === 'session' ? { mode } : {}, cookiePair(res));
}
