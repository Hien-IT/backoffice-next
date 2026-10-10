import { useEnv } from '@backoffice/env';
import { describe, expect, test, vi } from 'vitest';
import { DEFAULT_AUTH_PROVIDER, refreshCookieOptions, sessionCookieOptions } from './constants.js';

vi.mock('@backoffice/env');

describe('cookie options (directus/api/src/constants.ts)', () => {
	test('use the TTL, domain, secure and same-site variables', () => {
		vi.mocked(useEnv).mockReturnValue({
			REFRESH_TOKEN_TTL: '7d',
			REFRESH_TOKEN_COOKIE_DOMAIN: 'example.com',
			REFRESH_TOKEN_COOKIE_SECURE: true,
			REFRESH_TOKEN_COOKIE_SAME_SITE: 'lax',
			SESSION_COOKIE_TTL: '1d',
			SESSION_COOKIE_SECURE: false,
			SESSION_COOKIE_SAME_SITE: 'none',
		});

		expect(refreshCookieOptions()).toEqual({
			httpOnly: true,
			domain: 'example.com',
			maxAge: 604800000,
			secure: true,
			sameSite: 'lax',
		});

		expect(sessionCookieOptions()).toEqual({
			httpOnly: true,
			domain: undefined,
			maxAge: 86400000,
			secure: false,
			sameSite: 'none',
		});
	});

	test('fall back to SameSite=strict when the variable is empty', () => {
		vi.mocked(useEnv).mockReturnValue({ REFRESH_TOKEN_COOKIE_SAME_SITE: '', SESSION_COOKIE_SAME_SITE: '' });
		expect(refreshCookieOptions().sameSite).toBe('strict');
		expect(sessionCookieOptions().sameSite).toBe('strict');
	});

	test('names the default provider like Directus', () => {
		expect(DEFAULT_AUTH_PROVIDER).toBe('default');
	});
});
