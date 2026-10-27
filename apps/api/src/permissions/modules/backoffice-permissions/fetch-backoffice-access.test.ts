// Backoffice (spec 025, FR-010, FR-011, FR-017): what a caller's policies allow, dynamic variables resolved.
import type { Accountability, BackofficePermission } from '@backoffice/types';
import { beforeEach, expect, test, vi } from 'vitest';
import { fetchPolicies } from '../../lib/fetch-policies.js';
import type { Context } from '../../types.js';
import { fetchDynamicVariableData } from '../../utils/fetch-dynamic-variable-data.js';
import { combine, fetchBackofficeAccess } from './fetch-backoffice-access.js';
import { fetchBackofficePermissions } from './fetch-backoffice-permissions.js';

vi.mock('../../lib/fetch-policies.js');
vi.mock('../../utils/fetch-dynamic-variable-data.js');
vi.mock('./fetch-backoffice-permissions.js');

const ALL = ['csv', 'csv_utf8', 'json', 'xml', 'yaml'];
const context = {} as Context;
const user = { user: 'u1', role: 'r1', roles: ['r1'], ip: null, admin: false } as unknown as Accountability;

const row = (over: Partial<BackofficePermission>): BackofficePermission => ({
	policy: 'p1',
	collection: 'articles',
	action: 'export',
	permissions: null,
	validation: null,
	presets: null,
	fields: null,
	options: null,
	...over,
});

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(fetchPolicies).mockResolvedValue(['p1', 'p2']);
	vi.mocked(fetchDynamicVariableData).mockResolvedValue({});
});

test('admin: everything, without reading policies or rows', async () => {
	const access = await fetchBackofficeAccess(
		{ accountability: { ...user, admin: true }, collection: 'articles', action: 'export' },
		context,
	);

	expect(access).toEqual({ allowed: true, filter: null, fields: ['*'], formats: ALL });
	expect(fetchPolicies).not.toHaveBeenCalled();
});

test('no row: not allowed', async () => {
	vi.mocked(fetchBackofficePermissions).mockResolvedValue([]);

	const access = await fetchBackofficeAccess(
		{ accountability: user, collection: 'articles', action: 'import' },
		context,
	);

	expect(access.allowed).toBe(false);
	expect(fetchBackofficePermissions).toHaveBeenCalledWith(
		{ policies: ['p1', 'p2'], collection: 'articles', action: 'import' },
		context,
	);
});

test('one full row: every row, field and format of the action', async () => {
	vi.mocked(fetchBackofficePermissions).mockResolvedValue([row({ action: 'import' })]);

	expect(
		await fetchBackofficeAccess({ accountability: user, collection: 'articles', action: 'import' }, context),
	).toEqual({
		allowed: true,
		filter: null,
		fields: ['*'],
		formats: ['csv', 'json'],
	});
});

test('$CURRENT_USER in a filter is replaced by the user id', async () => {
	vi.mocked(fetchBackofficePermissions).mockResolvedValue([
		row({ permissions: { owner: { _eq: '$CURRENT_USER' } }, fields: ['id'] }),
	]);

	const access = await fetchBackofficeAccess(
		{ accountability: user, collection: 'articles', action: 'export' },
		context,
	);

	expect(access.filter).toEqual({ owner: { _eq: 'u1' } });
	expect(access.fields).toEqual(['id']);
});

test('combine: filters _or, fields and formats united; a row without filter, fields or formats opens that part', () => {
	const a = row({ permissions: { status: { _eq: 'a' } }, fields: ['id', 'title'], options: { formats: ['csv'] } });
	const b = row({
		permissions: { status: { _eq: 'b' } },
		fields: ['id', 'body'],
		options: { formats: ['json', 'csv'] },
	});

	expect(combine([a, b], ALL)).toEqual({
		filter: { _or: [{ status: { _eq: 'a' } }, { status: { _eq: 'b' } }] },
		fields: ['id', 'title', 'body'],
		formats: ['csv', 'json'],
	});

	expect(combine([a, row({ permissions: {}, fields: ['*'] })], ALL)).toEqual({
		filter: null,
		fields: ['*'],
		formats: ALL,
	});
	expect(combine([a], ALL)).toEqual({ filter: { status: { _eq: 'a' } }, fields: ['id', 'title'], formats: ['csv'] });
});
