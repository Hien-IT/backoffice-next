import { describe, expect, test } from 'vitest';
import { jwtPayload } from './jwt-payload.ts';

function base64Url(value: string) {
	const bytes = new TextEncoder().encode(value);
	return btoa(String.fromCharCode(...bytes))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
}

describe('jwtPayload', () => {
	test('decodes the payload, base64url and UTF-8 included', () => {
		const payload = { email: 'a@b.c', name: 'Nguyễn Văn Ạ ~~~???>>>', scope: 'invite' };
		const token = `x.${base64Url(JSON.stringify(payload))}.y`;

		expect(token).toMatch(/[-_]/);
		expect(jwtPayload(token)).toEqual(payload);
	});

	test('throws on a token without payload', () => {
		expect(() => jwtPayload('abc')).toThrow('Invalid JWT token');
	});
});
