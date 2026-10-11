// Ported from directus/packages/utils/shared/get-endpoint.ts
import { isSystemCollection } from '@backoffice/system-data';

export function getEndpoint(collection: string): string {
	if (isSystemCollection(collection)) {
		return `/${collection.substring(9)}`;
	}

	return `/items/${collection}`;
}
