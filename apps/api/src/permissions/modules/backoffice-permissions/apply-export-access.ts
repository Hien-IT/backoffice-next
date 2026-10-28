// Backoffice (spec 025, FR-011, FR-015, D-189.1): put the Use custom rules of an export into the query: the rules go to
// the read engine, which pairs them with the read permissions (export-rules.ts); `*` becomes the allowed fields the
// caller may read, and an explicitly requested, grouped or aggregated field outside them is refused like a read of a
// field the caller may not read.
import type { Query } from '@backoffice/types';
import { uniq } from 'lodash-es';
import { createFieldsForbiddenError } from '../process-ast/utils/validate-path/create-error.js';
import { setExportRules } from './export-rules.js';
import type { BackofficeAccess } from './fetch-backoffice-access.js';

/** Returns a new query: the sanitized query of a request is frozen. `readable`: the read fields of the caller. */
export function applyExportAccess(
	source: Query,
	access: BackofficeAccess,
	collection: string,
	readable: string[],
): Query {
	const query: Query = { ...source };
	setExportRules(query, access.rules);

	if (access.fields.includes('*')) return query;

	const allowed = readable.includes('*') ? access.fields : access.fields.filter((field) => readable.includes(field));
	const outside: string[] = [];
	const fields: string[] = [];

	for (const field of query.fields ?? ['*']) {
		const root = rootField(field, query);

		if (root === '*') fields.push(...allowed);
		else if (access.fields.includes(root)) fields.push(field);
		else outside.push(field);
	}

	const grouped = [...(query.group ?? []), ...Object.values(query.aggregate ?? {}).flat()];
	outside.push(...grouped.filter((field) => field !== '*' && !access.fields.includes(rootField(field, query))));

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
