// Unit tests of the feature 003 helpers in src/auth/ (no Docker).
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import { describe, expect, test } from 'vitest';
import { normalizeEffects } from './auth/db-effects.js';
import { alias, assertSameTranscripts, compareTranscripts, snapshotOf } from './auth/scenario.js';
import { getSimpleHash, sharedSecret, signAccessToken, signResetToken, totp } from './auth/tokens.js';

describe('scenario helpers', () => {
	test('alias replaces per-app ids and emails everywhere, keys included', () => {
		expect(alias({ user: 'u-1', list: ['a@x.io'], 'u-1': 1 }, { 'u-1': '<user>', 'a@x.io': '<email>' })).toEqual({
			user: '<user>',
			list: ['<email>'],
			'<user>': 1,
		});
	});

	test('compares transcripts and reports the differences', () => {
		expect(compareTranscripts({ directus: { a: 1 }, backoffice: { a: 1 } })).toEqual([]);
		expect(() => assertSameTranscripts({ directus: { a: 1 }, backoffice: { a: 2 } }, 'login')).toThrow(
			/login: 1 difference/,
		);
	});

	test('snapshots status, compared headers and the normalized body', () => {
		const snapshot = snapshotOf('/auth/login', {
			status: 200,
			headers: { 'content-type': 'application/json', etag: 'W/"1"', 'x-powered-by': 'Directus', 'x-other': 'x' },
			text: '',
			json: { data: { refresh_token: 'x'.repeat(64) } },
			isJson: true,
		});

		expect(snapshot).toEqual({
			status: 200,
			headers: { 'content-type': 'application/json' },
			body: { data: { refresh_token: '<token64>' } },
		});
	});
});

describe('db effects', () => {
	test('drops ids, links revisions to their activity, marks dates, tokens and hashes', () => {
		const effects = normalizeEffects({
			sessions: [{ token: 'y'.repeat(64), user: 'u', expires: '2026-10-17T00:00:00Z', next_token: null }],
			activity: [{ id: 7, action: 'update', timestamp: new Date(), item: 'u' }],
			revisions: [{ id: 3, activity: 7, data: '{"status":"active"}', delta: '{"status":"suspended"}' }],
			user: { id: 'u', password: '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA', last_access: new Date() },
		});

		expect(effects).toEqual({
			sessions: [{ token: '<token64>', user: 'u', expires: '<date>', next_token: null }],
			activity: [{ action: 'update', timestamp: '<date>', item: 'u' }],
			revisions: [{ data: { status: 'active' }, delta: { status: 'suspended' }, activity: 0 }],
			user: { id: 'u', password: '$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>', last_access: '<date>' },
		});
	});
});

describe('tokens', () => {
	test('reads the shared SECRET of the vendor env file', () => {
		expect(sharedSecret('postgres')).toBe('parity-test-secret-0123456789abcdef');
	});

	test('signs a password reset token in the Directus format', () => {
		const token = signResetToken('a@example.com', '$argon2id$hash', { secret: 's' });
		expect(jwt.verify(token, 's', { issuer: 'directus' })).toMatchObject({
			email: 'a@example.com',
			scope: 'password-reset',
			hash: getSimpleHash('$argon2id$hash'),
		});
	});

	test('signs access tokens with the Directus claims', () => {
		const token = signAccessToken({ id: 'u', role: null, app_access: true, admin_access: false }, { secret: 's' });
		expect(jwt.verify(token, 's')).toMatchObject({ id: 'u', iss: 'directus', app_access: true });
	});

	test('generates OTPs that otplib accepts', () => {
		const secret = authenticator.generateSecret();
		expect(authenticator.check(totp(secret), secret)).toBe(true);
	});
});
