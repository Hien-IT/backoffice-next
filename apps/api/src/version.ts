import { createRequire } from 'node:module';
/** Backoffice's own version: only logged at startup; clients see DIRECTUS_COMPAT_VERSION (FR-047). */
export const BACKOFFICE_VERSION: string = (createRequire(import.meta.url)('../package.json') as { version: string })
	.version;

// Owner 2026-10-22: no "DR" in the startup log (D-18).
export const VERSION_LOG_LINE = `Backoffice ${BACKOFFICE_VERSION}`;
