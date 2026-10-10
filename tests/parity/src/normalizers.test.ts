import { describe, expect, test } from 'vitest';
import {
	normalizeBody,
	normalizeDeep,
	normalizeHeader,
	normalizeJwt,
	normalizeLocation,
	normalizeSetCookie,
	tokenKind,
} from './normalizers.js';

const jwt = (payload: Record<string, unknown>) =>
	['{"alg":"HS256","typ":"JWT"}', JSON.stringify(payload)].map((p) => Buffer.from(p).toString('base64url')).join('.') +
	'.signature';

const token64 = 'a'.repeat(32) + 'B-_9'.repeat(8);

describe('tokens', () => {
	test('classifies empty values, JWTs and 64-character tokens', () => {
		expect(tokenKind('')).toBe('<empty>');
		expect(tokenKind(jwt({ id: 'x' }))).toBe('<jwt>');
		expect(tokenKind(token64)).toBe('<token64>');
		expect(tokenKind('static-token')).toBe('static-token');
	});

	test('keeps the claims of an access token, its lifetime and the kind of the session claim', () => {
		expect(
			normalizeJwt(
				jwt({
					id: 'u',
					role: null,
					app_access: true,
					admin_access: false,
					session: token64,
					iat: 100,
					exp: 1000,
					iss: 'directus',
				}),
			),
		).toEqual({
			claims: { id: 'u', role: null, app_access: true, admin_access: false, session: '<token64>', iss: 'directus' },
			ttl: 900,
		});
	});

	test('normalizes access_token and refresh_token wherever they are in a body', () => {
		const body = { data: { expires: 900000, refresh_token: token64, access_token: jwt({ id: 'u', iat: 1, exp: 2 }) } };

		expect(normalizeBody('/auth/login', body)).toEqual({
			data: { expires: 900000, refresh_token: '<token64>', access_token: { claims: { id: 'u' }, ttl: 1 } },
		});
	});
});

describe('Set-Cookie', () => {
	const now = Date.parse('2026-10-10T00:00:00Z');

	test('keeps names and attributes, replaces values and Expires', () => {
		const header = [
			`directus_session_token=${jwt({ id: 'u' })}; Max-Age=86400; Path=/; Expires=Sun, 11 Oct 2026 00:00:00 GMT; HttpOnly; SameSite=Lax`,
			`directus_refresh_token=${token64}; Max-Age=604800; Path=/; Expires=Sat, 17 Oct 2026 00:00:00 GMT; HttpOnly; SameSite=Lax`,
		].join('\n');

		expect(normalizeSetCookie(header, now)).toBe(
			[
				'directus_refresh_token=<token64>; Max-Age=604800; Path=/; Expires=<future>; HttpOnly; SameSite=Lax',
				'directus_session_token=<jwt>; Max-Age=86400; Path=/; Expires=<future>; HttpOnly; SameSite=Lax',
			].join('\n'),
		);
	});

	test('tells an Express 4 cleared cookie (empty, Max-Age kept) from an Express 5 one (Expires 1970)', () => {
		const express4 =
			'directus_refresh_token=; Max-Age=604800; Path=/; Expires=Sat, 17 Oct 2026 00:00:00 GMT; HttpOnly; SameSite=Lax';
		const express5 = 'directus_refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax';

		expect(normalizeSetCookie(express4, now)).toBe(
			'directus_refresh_token=<empty>; Max-Age=604800; Path=/; Expires=<future>; HttpOnly; SameSite=Lax',
		);

		expect(normalizeSetCookie(express5, now)).toBe(
			'directus_refresh_token=<empty>; Path=/; Expires=<past>; HttpOnly; SameSite=Lax',
		);
	});

	test('is applied by normalizeHeader', () => {
		expect(normalizeHeader('set-cookie', `openid.oidc=${jwt({ verifier: 'v' })}; Path=/; HttpOnly; SameSite=Lax`)).toBe(
			'openid.oidc=<jwt>; Path=/; HttpOnly; SameSite=Lax',
		);
	});
});

describe('Location', () => {
	test('replaces random PKCE and state values of absolute URLs', () => {
		const location =
			'http://idp:9000/authorize?client_id=c&scope=openid&state=abc&nonce=abc&code_challenge=abc&redirect_uri=x';

		expect(normalizeLocation(location)).toBe(
			'http://idp:9000/authorize?client_id=c&scope=openid&state=%3Cstate%3E&nonce=%3Cnonce%3E&code_challenge=%3Ccode_challenge%3E&redirect_uri=x',
		);
	});

	test('keeps relative redirects relative and leaves URLs without random values unchanged', () => {
		expect(normalizeLocation('./callback?code=abc&state=def')).toBe('./callback?code=%3Ccode%3E&state=%3Cstate%3E');
		expect(normalizeLocation('/admin/content?reason=INVALID_CREDENTIALS')).toBe(
			'/admin/content?reason=INVALID_CREDENTIALS',
		);
		expect(normalizeHeader('location', './?prompt=true')).toBe('./?prompt=true');
	});
});

test('TFA secret and otpauth URL', () => {
	expect(
		normalizeDeep({
			data: { secret: 'JBSWY3DPEHPK3PXP', otpauth_url: 'otpauth://totp/P:a%40b.c?secret=JBSWY3DPEHPK3PXP&issuer=P' },
		}),
	).toEqual({ data: { secret: '<base32>', otpauth_url: 'otpauth://totp/P:a%40b.c?secret=<base32>&issuer=P' } });
});
