// Ported from directus/api/src/types/collection.ts
import type { Table } from '@backoffice/schema';
import type { BaseCollectionMeta } from '@backoffice/system-data';
import type { Field } from '@backoffice/types';

export type Collection = {
	collection: string;
	fields?: Field[];
	meta: BaseCollectionMeta | null;
	schema: Table | null;
};
