// Ported from directus/api/src/permissions/modules/process-ast/utils/format-a2o-key.ts
export function formatA2oKey(fieldKey: string, collection: string) {
	return `${fieldKey}:${collection}`;
}
