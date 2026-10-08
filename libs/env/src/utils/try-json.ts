// Ported from directus/packages/env/src/utils/try-json.ts
import { parseJSON } from '@backoffice/utils';

export const tryJson = (value: unknown): unknown => {
	try {
		return parseJSON(String(value)) as unknown;
	} catch {
		return value;
	}
};
