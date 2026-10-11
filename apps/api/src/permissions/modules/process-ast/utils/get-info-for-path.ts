// Ported from directus/api/src/permissions/modules/process-ast/utils/get-info-for-path.ts
import type { CollectionKey, FieldMap, QueryPath } from '../types.js';

export function getInfoForPath(fieldMap: FieldMap, group: keyof FieldMap, path: QueryPath, collection: CollectionKey) {
	const pathStr = path.join('.');

	if (fieldMap[group].has(pathStr) === false) {
		fieldMap[group].set(pathStr, { collection, fields: new Set() });
	}

	return fieldMap[group].get(pathStr)!;
}
