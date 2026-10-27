// Backoffice (spec 025, FR-008): the collection permission error for a refused import or export.
import type { Accountability } from '@backoffice/types';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Context } from '../../types.js';
import { assertBackofficeAction } from './assert-backoffice-action.js';
import { fetchBackofficeAccess } from './fetch-backoffice-access.js';

vi.mock('./fetch-backoffice-access.js');

const context = {} as Context;
const accountability = { user: 'u1', admin: false } as Accountability;
const forbidden = 'You don\'t have permission to access collection "articles" or it does not exist. Queried in root.';

beforeEach(() => {
	vi.clearAllMocks();
});

test('not allowed: the collection permission error', async () => {
	vi.mocked(fetchBackofficeAccess).mockResolvedValue({ allowed: false, filter: null, fields: [], formats: [] });

	await expect(
		assertBackofficeAction({ accountability, collection: 'articles', action: 'export' }, context),
	).rejects.toMatchObject({
		code: 'FORBIDDEN',
		message: forbidden,
	});
});

test('a format outside the allowed ones: the same error; no format: only allowed counts', async () => {
	const access = { allowed: true, filter: null, fields: ['*'], formats: ['csv'] };
	vi.mocked(fetchBackofficeAccess).mockResolvedValue(access);

	await expect(
		assertBackofficeAction({ accountability, collection: 'articles', action: 'export', format: 'json' }, context),
	).rejects.toMatchObject({ code: 'FORBIDDEN', message: forbidden });

	await expect(
		assertBackofficeAction({ accountability, collection: 'articles', action: 'export', format: 'csv' }, context),
	).resolves.toBe(access);
	await expect(
		assertBackofficeAction({ accountability, collection: 'articles', action: 'export' }, context),
	).resolves.toBe(access);
});

test('no accountability (internal call): not checked', async () => {
	await expect(
		assertBackofficeAction({ accountability: null, collection: 'articles', action: 'import' }, context),
	).resolves.toMatchObject({
		allowed: true,
	});
	expect(fetchBackofficeAccess).not.toHaveBeenCalled();
});
