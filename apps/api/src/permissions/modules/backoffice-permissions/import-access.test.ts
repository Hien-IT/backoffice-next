// Backoffice (spec 025, FR-007, FR-016, research T002): the import permission of /utils/import.
import type { Accountability } from '@backoffice/types';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Context } from '../../types.js';
import { validateAccess } from '../validate-access/validate-access.js';
import { assertBackofficeAction } from './assert-backoffice-action.js';
import type { BackofficeAccess } from './fetch-backoffice-access.js';
import { assertImport, importRowGuard } from './import-access.js';

vi.mock('../validate-access/validate-access.js');
vi.mock('./assert-backoffice-action.js');

const context = {} as Context;
const user = { user: 'u1', admin: false } as Accountability;
const forbidden = 'You don\'t have permission to access collection "articles" or it does not exist. Queried in root.';

const access = (over: Partial<BackofficeAccess>): BackofficeAccess => ({
	allowed: true,
	filter: null,
	fields: ['*'],
	formats: ['csv', 'json'],
	...over,
});

beforeEach(() => {
	vi.clearAllMocks();
});

test('admin, a system collection or no accountability: nothing checked (DR rules apply)', async () => {
	expect(await assertImport({ ...user, admin: true }, 'articles', context)).toBeNull();
	expect(await assertImport(user, 'directus_dashboards', context)).toBeNull();
	expect(await assertImport(null, 'articles', context)).toBeNull();
	expect(validateAccess).not.toHaveBeenCalled();
});

test('a user: create, then update, as ImportService, then the import permission', async () => {
	vi.mocked(assertBackofficeAction).mockResolvedValue(access({}));

	await assertImport(user, 'articles', context);

	expect(vi.mocked(validateAccess).mock.calls.map(([options]) => options.action)).toEqual(['create', 'update']);
	expect(assertBackofficeAction).toHaveBeenCalledWith(
		{ accountability: user, collection: 'articles', action: 'import' },
		context,
	);
});

test('no create: the error of DR, the import permission is not read', async () => {
	vi.mocked(validateAccess).mockRejectedValueOnce(new Error('You don\'t have permission to perform "create"'));

	await expect(assertImport(user, 'articles', context)).rejects.toThrow('perform "create"');
	expect(assertBackofficeAction).not.toHaveBeenCalled();
});

test('a format outside the allowed ones refuses the file; an unsupported type is left to ImportService', () => {
	expect(() => importRowGuard(access({ formats: ['csv'] }), 'articles', 'application/json')).toThrow(forbidden);
	expect(importRowGuard(access({ formats: ['csv'] }), 'articles', 'text/plain')).toBeUndefined();
	expect(importRowGuard(access({}), 'articles', 'text/csv')).toBeUndefined();
});

test('the row guard: a column outside the allowed fields or a row outside the filter refuses the file', () => {
	const guard = importRowGuard(
		access({ fields: ['title', 'status'], filter: { status: { _eq: 'draft' } } }),
		'articles',
		'text/csv',
	)!;

	expect(() => guard({ title: 'a', status: 'draft' })).not.toThrow();
	expect(() => guard({ title: 'a', status: 'published' })).toThrow(forbidden);
	expect(() => guard({ title: 'a', status: 'draft', body: 'x' })).toThrow(forbidden);
});
