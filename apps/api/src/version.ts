import { createRequire } from 'node:module';
import { DIRECTUS_COMPAT_VERSION } from './constants.js';

/** Backoffice's own version: only logged at startup; clients see DIRECTUS_COMPAT_VERSION (FR-047). */
export const BACKOFFICE_VERSION: string = (createRequire(import.meta.url)('../package.json') as { version: string })
	.version;

export const VERSION_LOG_LINE = `Backoffice ${BACKOFFICE_VERSION} (compatible with Directus ${DIRECTUS_COMPAT_VERSION})`;
