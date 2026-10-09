import { useEnv } from '@backoffice/env';
import { toBoolean } from '@backoffice/utils';
import bytes from 'bytes';

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

export const ALIAS_TYPES = ['alias', 'o2m', 'm2m', 'm2a', 'o2a', 'files', 'translations'];
