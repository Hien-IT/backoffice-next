// Ported from directus/api/src/database/get-ast-from-query/utils/get-related-collection.ts
import type { SchemaOverview } from '@backoffice/types';
import { getRelation } from '@backoffice/utils';

export function getRelatedCollection(schema: SchemaOverview, collection: string, field: string): string | null {
	const relation = getRelation(schema.relations, collection, field);

	if (!relation) return null;

	if (relation.collection === collection && relation.field === field) {
		return relation.related_collection || null;
	}

	if (relation.related_collection === collection && relation.meta?.one_field === field) {
		return relation.collection || null;
	}

	return null;
}
