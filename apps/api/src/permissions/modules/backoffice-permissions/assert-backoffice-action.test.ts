// Backoffice (spec 025, FR-008, FR-011): the collection permission error for a refused import or export; only the
// rules of the requested format take part.
import type { Accountability } from '@backoffice/types';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Context } from '../../types.js';
import { fetchAllowedFields } from '../fetch-allowed-fields/fetch-allowed-fields.js';
import { assertBackofficeAction, assertExport } from './assert-backoffice-action.js';
import { exportRulesOf } from './export-rules.js';
import { type BackofficeRule, fetchBackofficeAccess } from './fetch-backoffice-access.js';

vi.mock('./fetch-backoffice-access.js', async (importOriginal) => ({
	...(await importOriginal<object>()),
	fetchBackofficeAccess: vi.fn(),
}));

vi.mock('../fetch-allowed-fields/fetch-allowed-fields.js');

const context = {} as Context;
const accountability = { user: 'u1', admin: false } as Accountability;
const forbidden = 'You don\'t have permission to access collection "articles" or it does not exist. Queried in root.';

const csvRule: BackofficeRule = { filter: { status: { _eq: 'published' } }, fields: ['id', 'title'], formats: ['csv'] };
const jsonRule: BackofficeRule = { filter: { owner: { _eq: 'u1' } }, fields: ['*'], formats: ['csv', 'json'] };

const accessOf = (rules: BackofficeRule[]) => ({
	allowed: rules.length > 0,
	filter: null,
	fields: [],
	formats: [],
	rules,
});

beforeEach(() => {
	vi.clearAllMocks();
});

test('not allowed: the collection permission error', async () => {
	vi.mocked(fetchBackofficeAccess).mockResolvedValue(accessOf([]));

	await expect(
		assertBackofficeAction({ accountability, collection: 'articles', action: 'export' }, context),
	).rejects.toMatchObject({
		code: 'FORBIDDEN',
		message: forbidden,
	});
});

test('a format: only the rules that allow it; none → the same error; no format: every rule', async () => {
	vi.mocked(fetchBackofficeAccess).mockResolvedValue(accessOf([csvRule, jsonRule]));

	await expect(
		assertBackofficeAction({ accountability, collection: 'articles', action: 'export', format: 'json' }, context),
	).resolves.toMatchObject({ allowed: true, filter: { owner: { _eq: 'u1' } }, fields: ['*'], rules: [jsonRule] });

	await expect(
		assertBackofficeAction({ accountability, collection: 'articles', action: 'export', format: 'xml' }, context),
	).rejects.toMatchObject({ code: 'FORBIDDEN', message: forbidden });

	await expect(
		assertBackofficeAction({ accountability, collection: 'articles', action: 'export' }, context),
	).resolves.toMatchObject({ rules: [csvRule, jsonRule] });
});

test('no accountability (internal call): not checked', async () => {
	await expect(
		assertBackofficeAction({ accountability: null, collection: 'articles', action: 'import' }, context),
	).resolves.toMatchObject({
		allowed: true,
	});
	expect(fetchBackofficeAccess).not.toHaveBeenCalled();
});

test('assertExport: a rule without restriction leaves the query; otherwise the rules of the format go with it', async () => {
	const query = { fields: ['*'] };

	vi.mocked(fetchBackofficeAccess).mockResolvedValue(accessOf([{ filter: null, fields: ['*'], formats: ['csv'] }]));
	expect(await assertExport({ accountability, collection: 'articles', query, format: 'csv' }, context)).toBe(query);
	expect(fetchAllowedFields).not.toHaveBeenCalled();

	vi.mocked(fetchBackofficeAccess).mockResolvedValue(accessOf([csvRule, jsonRule]));
	vi.mocked(fetchAllowedFields).mockResolvedValue(['id']);

	// csv: both rules, fields * → the read fields are not needed.
	const both = await assertExport({ accountability, collection: 'articles', query, format: 'csv' }, context);
	expect(JSON.stringify(both)).toBe('{"fields":["*"]}');
	expect(exportRulesOf(both)).toEqual([csvRule, jsonRule]);
	expect(fetchAllowedFields).not.toHaveBeenCalled();

	// A csv rule alone: `*` becomes its fields the caller may read.
	vi.mocked(fetchBackofficeAccess).mockResolvedValue(accessOf([csvRule]));
	const csv = await assertExport({ accountability, collection: 'articles', query, format: 'csv' }, context);
	expect(JSON.stringify(csv)).toBe('{"fields":["id"]}');
	expect(exportRulesOf(csv)).toEqual([csvRule]);
	expect(fetchAllowedFields).toHaveBeenCalledWith({ accountability, action: 'read', collection: 'articles' }, context);
});
