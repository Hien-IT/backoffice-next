import { useEnv } from '@backoffice/env';
import type { TransformationParams } from '@backoffice/types';
import { toBoolean } from '@backoffice/utils';
import bytes from 'bytes';
import type { CookieOptions } from 'express';
import { getMilliseconds } from './utils/get-milliseconds.js';

/** Version reported to clients (`/server/info`, `/server/health` releaseId), FR-047. */
export const DIRECTUS_COMPAT_VERSION = '11.17.4';

/** directus/api/src/constants.ts: presets the DR app uses for thumbnails, allowed in every transform mode. */
export const SYSTEM_ASSET_ALLOW_LIST: TransformationParams[] = [
	{
		key: 'system-small-cover',
		format: 'auto',
		transforms: [['resize', { width: 64, height: 64, fit: 'cover' }]],
	},
	{
		key: 'system-small-contain',
		format: 'auto',
		transforms: [['resize', { width: 64, fit: 'contain' }]],
	},
	{
		key: 'system-medium-cover',
		format: 'auto',
		transforms: [['resize', { width: 300, height: 300, fit: 'cover' }]],
	},
	{
		key: 'system-medium-contain',
		format: 'auto',
		transforms: [['resize', { width: 300, fit: 'contain' }]],
	},
	{
		key: 'system-large-cover',
		format: 'auto',
		transforms: [['resize', { width: 800, height: 800, fit: 'cover' }]],
	},
	{
		key: 'system-large-contain',
		format: 'auto',
		transforms: [['resize', { width: 800, fit: 'contain' }]],
	},
];

export const ASSET_TRANSFORM_QUERY_KEYS = [
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
] as const satisfies Readonly<(keyof TransformationParams)[]>;

/** Formats from which transformation is supported */
export const SUPPORTED_IMAGE_TRANSFORM_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/avif'];

/** Formats where metadata extraction is supported */
export const SUPPORTED_IMAGE_METADATA_FORMATS = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
	'image/tiff',
	'image/avif',
];

/** Component schemas the OpenAPI generator always keeps (directus/api/src/services/specifications.ts). */
export const OAS_REQUIRED_SCHEMAS = ['Query', 'x-metadata'];

/**
 * RESUMABLE_UPLOADS of directus/api/src/constants.ts. Getters instead of values read at import, so loading this
 * module never reads the configuration before the startup checks.
 */
export const RESUMABLE_UPLOADS = {
	get ENABLED(): boolean {
		return toBoolean(useEnv()['TUS_ENABLED']);
	},
	get CHUNK_SIZE(): number | null {
		return bytes.parse(useEnv()['TUS_CHUNK_SIZE'] as string);
	},
	get EXPIRATION_TIME(): number {
		return getMilliseconds(useEnv()['TUS_UPLOAD_EXPIRATION'], 600_000 /* 10min */);
	},
	get SCHEDULE(): string {
		return String(useEnv()['TUS_CLEANUP_SCHEDULE'] as string);
	},
};

/** FILE_UPLOADS of directus/api/src/constants.ts, as getters like RESUMABLE_UPLOADS. */
export const FILE_UPLOADS = {
	get MAX_SIZE(): number | null {
		return bytes.parse(useEnv()['FILES_MAX_UPLOAD_SIZE'] as string);
	},
	get MAX_CONCURRENCY(): number {
		return Number(useEnv()['FILES_MAX_UPLOAD_CONCURRENCY']);
	},
};

export const ALIAS_TYPES = ['alias', 'o2m', 'm2m', 'm2a', 'o2a', 'files', 'translations'];

/** directus/api/src/constants.ts:111: database functions a field default value may call (feature 006). */
export const ALLOWED_DB_DEFAULT_FUNCTIONS = ['gen_random_uuid()'];

/** directus/api/src/constants.ts: name of the email/password provider, never part of AUTH_PROVIDERS. */
export const DEFAULT_AUTH_PROVIDER = 'default';

/**
 * REFRESH_COOKIE_OPTIONS and SESSION_COOKIE_OPTIONS of directus/api/src/constants.ts (lines 66-80), built on use
 * instead of at import (research R15), with the same values.
 */
export function refreshCookieOptions(): CookieOptions {
	const env = useEnv();

	return {
		httpOnly: true,
		domain: env['REFRESH_TOKEN_COOKIE_DOMAIN'] as string,
		maxAge: getMilliseconds(env['REFRESH_TOKEN_TTL'] as string),
		secure: Boolean(env['REFRESH_TOKEN_COOKIE_SECURE']),
		sameSite: (env['REFRESH_TOKEN_COOKIE_SAME_SITE'] || 'strict') as 'lax' | 'strict' | 'none',
	};
}

export function sessionCookieOptions(): CookieOptions {
	const env = useEnv();

	return {
		httpOnly: true,
		domain: env['SESSION_COOKIE_DOMAIN'] as string,
		maxAge: getMilliseconds(env['SESSION_COOKIE_TTL'] as string),
		secure: Boolean(env['SESSION_COOKIE_SECURE']),
		sameSite: (env['SESSION_COOKIE_SAME_SITE'] || 'strict') as 'lax' | 'strict' | 'none',
	};
}

/** Ported from directus/api/src/constants.ts: the `:pk` pattern of `/flows/trigger/:pk` (feature 009). */
export const UUID_REGEX = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
