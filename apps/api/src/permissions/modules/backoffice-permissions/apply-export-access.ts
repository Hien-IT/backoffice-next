// Backoffice (spec 025, FR-015, D-189.1): put the Use custom rules of an export into the query: the row filter is
// ANDed with the query filter (the engine then ANDs both with the caller's read permissions), `*` becomes the allowed
// fields, and an explicitly requested field outside them is refused like a read of a field the caller may not read.
import type { Query } from '@backoffice/types';
import { uniq } from 'lodash-es';
import { createFieldsForbiddenError } from '../process-ast/utils/validate-path/create-error.js';
import type { BackofficeAccess } from './fetch-backoffice-access.js';

/** Returns a new query: the sanitized query of a request is frozen. */
export function applyExportAccess(source: Query, access: BackofficeAccess, collection: string): Query {
	const query: Query = { ...source };

	if (access.filter) query.filter = query.filter ? { _and: [query.filter, access.filter] } : access.filter;

	if (access.fields.includes('*')) return query;

	const outside: string[] = [];
	const fields: string[] = [];

	for (const field of query.fields ?? ['*']) {
		const root = rootField(field, query);

		if (root === '*') fields.push(...access.fields);
		else if (access.fields.includes(root)) fields.push(field);
		else outside.push(field);
	}

	if (outside.length > 0) throw createFieldsForbiddenError('', collection, outside);

	query.fields = uniq(fields);
	return query;
}

/** The field a requested path starts from: `a` of `a.b` (CHK024), the alias target, the argument of `year(a)`. */
function rootField(field: string, query: Query): string {
	const first = field.split('.')[0]!;
	const fn = /^\w+\((\w+)\)$/.exec(first);
	const name = fn ? fn[1]! : first;
	return query.alias?.[name] ?? name;
}
