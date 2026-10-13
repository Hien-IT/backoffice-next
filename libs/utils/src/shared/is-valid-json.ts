// Ported from directus/packages/utils/shared/is-valid-json.ts
import { parseJSON } from './parse-json.js';

export function isValidJSON(input: string): boolean {
	try {
		parseJSON(input);
		return true;
	} catch {
		return false;
	}
}
