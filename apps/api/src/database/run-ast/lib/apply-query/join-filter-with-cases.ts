// Ported from directus/api/src/database/run-ast/lib/apply-query/join-filter-with-cases.ts
import type { Filter } from '@backoffice/types';

export function joinFilterWithCases(filter: Filter | null | undefined, cases: Filter[]) {
	if (cases.length > 0 && !filter) {
		return { _or: cases };
	} else if (filter && cases.length === 0) {
		return filter ?? null;
	} else if (filter && cases.length > 0) {
		return { _and: [filter, { _or: cases }] };
	}

	return null;
}
