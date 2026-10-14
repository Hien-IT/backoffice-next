// Self-checks of the helpers (no browser, no API): the request filter, the route list, the token payloads.
import { expect, test } from '@playwright/test';
import jwt from 'jsonwebtoken';
import { isAllowedCall } from './helpers/allowed-paths.js';
import { parseEnv } from './helpers/config.js';
import { apiPath } from './helpers/requests.js';
import { getSimpleHash, inviteToken, passwordResetToken } from './helpers/tokens.js';

test('apiPath keeps API calls only', () => {
	expect(apiPath('http://127.0.0.1:8162/users/me?fields=id', 'http://127.0.0.1:8162')).toBe('/users/me');
	expect(apiPath('http://127.0.0.1:8162/admin/assets/index.js', 'http://127.0.0.1:8162')).toBeUndefined();
	expect(apiPath('http://localhost:8181/admin/config.json', 'http://127.0.0.1:8163')).toBeUndefined();
	expect(apiPath('http://127.0.0.1:8163/auth/refresh', 'http://127.0.0.1:8163/')).toBe('/auth/refresh');
	expect(apiPath('http://h/api/server/info', 'http://h/api')).toBe('/server/info');
	expect(apiPath('http://h/apix/server/info', 'http://h/api')).toBeUndefined();
});

test('isAllowedCall follows contracts/api-calls.md', () => {
	expect(isAllowedCall('GET', '/assets/0b1c-2d')).toBe(true);
	expect(isAllowedCall('GET', '/auth/login/oidc')).toBe(true);
	expect(isAllowedCall('PATCH', '/users/me/track/page')).toBe(true);
	expect(isAllowedCall('GET', '/items/articles')).toBe(false);
	expect(isAllowedCall('GET', '/websocket')).toBe(false);
	expect(isAllowedCall('DELETE', '/users/me')).toBe(false);
	expect(isAllowedCall('POST', '/users/me/track/page')).toBe(false);
});

test('parseEnv reads KEY=VALUE lines', () => {
	expect(parseEnv('# c\nA=1\n\nB=x=y\n')).toEqual({ A: '1', B: 'x=y' });
});

test('tokens carry the Directus payloads', () => {
	// Same as directus/packages/utils/shared/get-simple-hash.test.ts.
	expect(getSimpleHash('test')).toBe('364492');

	// nosemgrep: javascript.jsonwebtoken.security.jwt-hardcode.hardcoded-jwt-secret -- literal secret of this token helper test only
	const invite = jwt.verify(inviteToken('a@example.com', 's'), 's', { issuer: 'directus' }) as jwt.JwtPayload;
	expect(invite).toMatchObject({ email: 'a@example.com', scope: 'invite' });
	expect(invite.exp! - invite.iat!).toBe(7 * 24 * 3600);

	// nosemgrep: javascript.jsonwebtoken.security.jwt-hardcode.hardcoded-jwt-secret -- literal secret of this token helper test only
	const reset = jwt.verify(passwordResetToken('a@example.com', 'test', 's'), 's') as jwt.JwtPayload;
	expect(reset).toMatchObject({ email: 'a@example.com', scope: 'password-reset', hash: '364492', iss: 'directus' });
	expect(reset.exp! - reset.iat!).toBe(24 * 3600);
});
