// Ported from directus/api/src/permissions/modules/process-ast/utils/stringify-query-path.ts
import type { QueryPath } from '../types.js';

export function stringifyQueryPath(queryPath: QueryPath): string {
	return queryPath.join('.');
}
