import { useEnv } from '@backoffice/env';
import { describe, expect, test, vi } from 'vitest';
import {
	ASSET_TRANSFORM_QUERY_KEYS,
	DEFAULT_AUTH_PROVIDER,
	refreshCookieOptions,
	RESUMABLE_UPLOADS,
	sessionCookieOptions,
	SUPPORTED_IMAGE_METADATA_FORMATS,
	SUPPORTED_IMAGE_TRANSFORM_FORMATS,
	SYSTEM_ASSET_ALLOW_LIST,
} from './constants.js';

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

describe('file and asset constants (directus/api/src/constants.ts)', () => {
	test('system presets match Directus', () => {
		expect(SYSTEM_ASSET_ALLOW_LIST.map((preset) => preset.key)).toEqual([
			'system-small-cover',
			'system-small-contain',
			'system-medium-cover',
			'system-medium-contain',
			'system-large-cover',
			'system-large-contain',
		]);

		expect(SYSTEM_ASSET_ALLOW_LIST[2]).toEqual({
			key: 'system-medium-cover',
			format: 'auto',
			transforms: [['resize', { width: 300, height: 300, fit: 'cover' }]],
		});
	});

	test('query keys and supported formats match Directus', () => {
		expect(ASSET_TRANSFORM_QUERY_KEYS).toEqual([
			'key',
			'transforms',
			'width',
			'height',
			'format',
			'fit',
			'quality',
			'withoutEnlargement',
			'focal_point_x',
			'focal_point_y',
		]);

		expect(SUPPORTED_IMAGE_TRANSFORM_FORMATS).toEqual([
			'image/jpeg',
			'image/png',
			'image/webp',
			'image/tiff',
			'image/avif',
		]);

		expect(SUPPORTED_IMAGE_METADATA_FORMATS).toEqual([
			...SUPPORTED_IMAGE_TRANSFORM_FORMATS.slice(0, 3),
			'image/gif',
			'image/tiff',
			'image/avif',
		]);
	});

	test('RESUMABLE_UPLOADS reads the TUS variables on use, with the Directus fallback', () => {
		vi.mocked(useEnv).mockReturnValue({
			TUS_ENABLED: 'true',
			TUS_CHUNK_SIZE: '8mb',
			TUS_UPLOAD_EXPIRATION: '2s',
			TUS_CLEANUP_SCHEDULE: '0 * * * *',
		});

		expect(RESUMABLE_UPLOADS.ENABLED).toBe(true);
		expect(RESUMABLE_UPLOADS.CHUNK_SIZE).toBe(8388608);
		expect(RESUMABLE_UPLOADS.EXPIRATION_TIME).toBe(2000);
		expect(RESUMABLE_UPLOADS.SCHEDULE).toBe('0 * * * *');

		vi.mocked(useEnv).mockReturnValue({ TUS_UPLOAD_EXPIRATION: 'not-a-duration' });
		expect(RESUMABLE_UPLOADS.EXPIRATION_TIME).toBe(600_000);
	});
});
