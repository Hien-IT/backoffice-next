// Backoffice (spec 025, FR-011, FR-015): an export pairs the caller's read permissions on the collection with its export
// rules the way DR pairs the read permissions of several policies (process-ast cases): a row is exported when a read
// permission and an export rule both match it, and a field shows on that row only when such a pair allows it. The rules
// travel with the query from the export check to the read engine (items.service readByQuery → processAst).
import type { Filter, Permission, Query } from '@backoffice/types';
import { isEmpty } from 'lodash-es';
import type { BackofficeRule } from './fetch-backoffice-access.js';

const EXPORT_RULES = Symbol('backoffice export rules');

type WithExportRules = Query & { [EXPORT_RULES]?: BackofficeRule[] };

/** A symbol key: spreads of the query keep it, while object-hash, Joi and JSON never see it. */
export function setExportRules(query: Query, rules: BackofficeRule[]): void {
	(query as WithExportRules)[EXPORT_RULES] = rules;
}

export function exportRulesOf(query: Query): BackofficeRule[] | undefined {
	return (query as WithExportRules)[EXPORT_RULES];
}

/** Every read permission of `collection` paired with every export rule; empty pairs dropped. */
export function pairWithExportRules(
	permissions: Permission[],
	collection: string,
	rules: BackofficeRule[],
): Permission[] {
	return permissions
		.filter((read) => read.collection === collection)
		.flatMap((read) =>
			rules.flatMap((rule) => {
				const fields = intersect(read.fields ?? [], rule.fields);
				return fields.length > 0 ? [{ ...read, permissions: and(read.permissions, rule.filter), fields }] : [];
			}),
		);
}

function and(read: Filter | null, rule: Filter | null): Filter | null {
	if (!rule) return read;
	return !read || isEmpty(read) ? rule : { _and: [read, rule] };
}

function intersect(read: string[], rule: string[]): string[] {
	if (read.includes('*')) return rule;
	if (rule.includes('*')) return read;
	return read.filter((field) => rule.includes(field));
}
