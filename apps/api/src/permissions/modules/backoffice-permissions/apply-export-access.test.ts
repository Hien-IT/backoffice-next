// Backoffice (spec 025, FR-011, FR-015, CHK024): the Use custom rules of an export put into the query.
import type { Query } from '@backoffice/types';
import { expect, test } from 'vitest';
import { applyExportAccess } from './apply-export-access.js';
import { exportRulesOf } from './export-rules.js';
import type { BackofficeAccess } from './fetch-backoffice-access.js';

// The keys a JSON body or a hash sees (the rules are a symbol key).
const plain = (query: Query) => JSON.parse(JSON.stringify(query));

const access = (over: Partial<BackofficeAccess>): BackofficeAccess => {
	const rule = { filter: over.filter ?? null, fields: over.fields ?? ['*'], formats: ['csv'] };
	return { allowed: true, ...rule, rules: [rule], ...over };
};

test('the rules go with the query, the filter is left to the read engine; a new query is returned', () => {
	const rule = { status: { _eq: 'published' } };
	const allowed = access({ filter: rule });

	// The sanitized query of a request is frozen.
	const frozen = Object.freeze({ fields: ['*'], filter: { id: { _gt: 1 } } }) as Query;
	const query = applyExportAccess(frozen, allowed, 'articles', ['*']);

	expect(plain(query)).toEqual({ fields: ['*'], filter: { id: { _gt: 1 } } });
	expect(query).not.toBe(frozen);
	expect(exportRulesOf(query)).toBe(allowed.rules);
	expect(exportRulesOf(frozen)).toBeUndefined();
});

test('* or no fields: the allowed fields the caller may read; allowed paths and aliases are kept', () => {
	const allowed = access({ fields: ['id', 'title', 'author'] });

	expect(applyExportAccess({}, allowed, 'articles', ['*']).fields).toEqual(['id', 'title', 'author']);
	expect(applyExportAccess({}, allowed, 'articles', ['id', 'author', 'body']).fields).toEqual(['id', 'author']);
	expect(applyExportAccess({ fields: ['*', 'author.name'] }, allowed, 'articles', ['*']).fields).toEqual([
		'id',
		'title',
		'author',
		'author.name',
	]);
	expect(
		applyExportAccess({ fields: ['writer'], alias: { writer: 'author' } }, allowed, 'articles', ['*']).fields,
	).toEqual(['writer']);
	expect(applyExportAccess({ fields: ['year(id)'] }, allowed, 'articles', ['*']).fields).toEqual(['year(id)']);
});

test('a field outside the allowed ones, as a relation path, a group or an aggregate: the field permission error', () => {
	const allowed = access({ fields: ['id', 'title'] });

	expect(() => applyExportAccess({ fields: ['id', 'body'] }, allowed, 'articles', ['*'])).toThrow(
		'You don\'t have permission to access field "body" in collection "articles" or it does not exist. Queried in root.',
	);
	expect(() => applyExportAccess({ fields: ['author.name'] }, allowed, 'articles', ['*'])).toThrow(
		/field "author.name"/,
	);
	expect(() => applyExportAccess({ group: ['status'] }, allowed, 'articles', ['*'])).toThrow(/field "status"/);
	expect(() => applyExportAccess({ aggregate: { sum: ['price'] } }, allowed, 'articles', ['*'])).toThrow(
		/field "price"/,
	);
	expect(
		plain(applyExportAccess({ aggregate: { count: ['*'] }, group: ['title'] }, allowed, 'articles', ['*'])),
	).toEqual({
		aggregate: { count: ['*'] },
		group: ['title'],
		fields: ['id', 'title'],
	});
});
