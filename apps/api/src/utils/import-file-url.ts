// Ported from directus/api/src/utils/import-file-url.ts
// Backoffice: the specifier is resolved against this file, so it is made relative to this file's folder (DR
// passes the caller's URL as `root`; both sit one folder under src, so the result is the same).
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToRelativeUrl } from '@backoffice/utils/node';

interface ImportOptions {
	fresh?: boolean;
}

export function importFileUrl(url: string, _root: string, options: ImportOptions = {}): Promise<any> {
	return import(
		/* @vite-ignore */
		`./${pathToRelativeUrl(url, dirname(fileURLToPath(import.meta.url)))}${options.fresh ? `?t=${Date.now()}` : ''}`
	);
}
