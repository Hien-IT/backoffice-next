// Ported from directus/packages/env/src/utils/get-file-extension.ts
import { extname } from 'node:path';

/**
 * Returns the file extension of a given file path
 */
export const getFileExtension = (path: string): string => {
	return extname(path).toLowerCase().substring(1);
};
