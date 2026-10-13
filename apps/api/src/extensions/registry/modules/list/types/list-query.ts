// Ported from directus/packages/extensions-registry/src/modules/list/types/list-query.ts
import type { EXTENSION_TYPES } from '@backoffice/constants';

// Backoffice: @backoffice/types has no extension types; the same union as @directus/types ExtensionType.
type ExtensionType = (typeof EXTENSION_TYPES)[number];

export interface ListQuery {
	type?: ExtensionType;
	search?: string;
	limit?: number;
	offset?: number;
	by?: string;
	sort?: 'popular' | 'recent' | 'downloads';
	sandbox?: boolean;
}
