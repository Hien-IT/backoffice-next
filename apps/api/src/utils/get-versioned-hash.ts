// Ported from directus/api/src/utils/get-versioned-hash.ts
// Backoffice: the Directus version the shared database runs, instead of directus/package.json (same value, 11.17.4).
import { DIRECTUS_COMPAT_VERSION as version } from '../constants.js';
import hash from 'object-hash';

export function getVersionedHash(item: Record<string, any>): string {
	return hash({ item, version });
}
