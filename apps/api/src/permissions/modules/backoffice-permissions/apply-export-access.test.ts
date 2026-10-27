// Backoffice (spec 025, FR-015, CHK024): the Use custom rules of an export put into the query.
import type { Query } from '@backoffice/types';
import { expect, test } from 'vitest';
import { applyExportAccess } from './apply-export-access.js';
import type { BackofficeAccess } from './fetch-backoffice-access.js';

const access = (over: Partial<BackofficeAccess>): BackofficeAccess => ({
	allowed: true,
	filter: null,
	fields: ['*'],
	formats: ['csv'],
	...over,
});

test('full access leaves the query as it is', () => {
	const query: Query = { fields: ['*'], filter: { id: { _gt: 1 } } };
	expect(applyExportAccess(query, access({}), 'articles')).toEqual({ fields: ['*'], filter: { id: { _gt: 1 } } });
});

test('the row filter is ANDed with the query filter, or becomes it', () => {
	const rule = { status: { _eq: 'published' } };

	expect(applyExportAccess({ filter: { id: { _gt: 1 } } }, access({ filter: rule }), 'articles').filter).toEqual({
		_and: [{ id: { _gt: 1 } }, rule],
	});
	expect(applyExportAccess({}, access({ filter: rule }), 'articles').filter).toEqual(rule);

	// The sanitized query of a request is frozen: a new query is returned.
	const frozen = Object.freeze({ fields: ['*'] }) as Query;
	expect(applyExportAccess(frozen, access({ filter: rule, fields: ['id'] }), 'articles')).toEqual({
		fields: ['id'],
		filter: rule,
	});
});

test('* or no fields: the allowed fields; allowed paths and aliases are kept', () => {
	const allowed = access({ fields: ['id', 'title', 'author'] });

	expect(applyExportAccess({}, allowed, 'articles').fields).toEqual(['id', 'title', 'author']);
	expect(applyExportAccess({ fields: ['*', 'author.name'] }, allowed, 'articles').fields).toEqual([
		'id',
		'title',
		'author',
		'author.name',
	]);
	expect(applyExportAccess({ fields: ['writer'], alias: { writer: 'author' } }, allowed, 'articles').fields).toEqual([
		'writer',
	]);
	expect(applyExportAccess({ fields: ['year(id)'] }, allowed, 'articles').fields).toEqual(['year(id)']);
});

test('a field outside the allowed ones, also as a relation path: the field permission error (CHK024)', () => {
	const allowed = access({ fields: ['id', 'title'] });

	expect(() => applyExportAccess({ fields: ['id', 'body'] }, allowed, 'articles')).toThrow(
		'You don\'t have permission to access field "body" in collection "articles" or it does not exist. Queried in root.',
	);
	expect(() => applyExportAccess({ fields: ['author.name'] }, allowed, 'articles')).toThrow(/field "author.name"/);
});
