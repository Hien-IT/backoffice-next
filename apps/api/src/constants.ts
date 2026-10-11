import { useEnv } from '@backoffice/env';
import { toBoolean } from '@backoffice/utils';
import bytes from 'bytes';
import type { CookieOptions } from 'express';
import { getMilliseconds } from './utils/get-milliseconds.js';

/** Version reported to clients (`/server/info`, `/server/health` releaseId), FR-047. */
export const DIRECTUS_COMPAT_VERSION = '11.17.4';

/** Component schemas the OpenAPI generator always keeps (directus/api/src/services/specifications.ts). */
export const OAS_REQUIRED_SCHEMAS = ['Query', 'x-metadata'];

/**
 * RESUMABLE_UPLOADS of directus/api/src/constants.ts (part used by the storage drivers). Getters instead of values
 * read at import, so loading this module never reads the configuration before the startup checks.
 */
export const RESUMABLE_UPLOADS = {
	get ENABLED(): boolean {
		return toBoolean(useEnv()['TUS_ENABLED']);
	},
	get CHUNK_SIZE(): number | null {
		return bytes.parse(useEnv()['TUS_CHUNK_SIZE'] as string);
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
