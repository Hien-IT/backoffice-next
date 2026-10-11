// Ported from directus/api/src/permissions/modules/process-ast/utils/collections-in-field-map.ts
import type { CollectionKey, FieldMap } from '../types.js';

export function collectionsInFieldMap(fieldMap: FieldMap): CollectionKey[] {
	const collections: Set<CollectionKey> = new Set();

	for (const { collection } of [...fieldMap.other.values(), ...fieldMap.read.values()]) {
		collections.add(collection);
	}

	return Array.from(collections);
}
