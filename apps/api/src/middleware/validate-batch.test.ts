// Ported from directus/api/src/middleware/validate-batch.test.ts
import { InvalidPayloadError } from '@backoffice/errors';
import type { Request, Response } from 'express';
import { beforeEach, expect, test, vi } from 'vitest';
import { fetchBackofficeAccess } from '../permissions/modules/backoffice-permissions/fetch-backoffice-access.js';
import { validateBatch } from './validate-batch.js';
import '../types/express.d.ts';

// Spec 025 (CHK015): the export permission of a SEARCH body query.
vi.mock('../permissions/modules/backoffice-permissions/fetch-backoffice-access.js', async (importOriginal) => ({
	...(await importOriginal<object>()),
	fetchBackofficeAccess: vi.fn(),
}));
vi.mock('../database/index.js', () => ({ default: () => ({}) }));

let mockRequest: Partial<Request & { token?: string }>;
let mockResponse: Partial<Response>;
const nextFunction = vi.fn();

beforeEach(() => {
	mockRequest = {};
	mockResponse = {};
	vi.clearAllMocks();
});

test('Sets body to empty, calls next on GET requests', async () => {
	mockRequest.method = 'GET';

	await validateBatch('read')(mockRequest as Request, mockResponse as Response, nextFunction);

	expect(mockRequest.body).toEqual({});
	expect(nextFunction).toHaveBeenCalledTimes(1);
});

test(`Short circuits on singletons that aren't queried through SEARCH`, async () => {
	mockRequest.method = 'PATCH';
	mockRequest.singleton = true;
	mockRequest.body = { title: 'test' };

	await validateBatch('update')(mockRequest as Request, mockResponse as Response, nextFunction);

	expect(nextFunction).toHaveBeenCalledTimes(1);
});

test('Throws InvalidPayloadError on missing body', async () => {
	mockRequest.method = 'SEARCH';

	await validateBatch('read')(mockRequest as Request, mockResponse as Response, nextFunction);

	expect(nextFunction).toHaveBeenCalledTimes(1);
	expect(vi.mocked(nextFunction)?.mock?.calls?.[0]?.[0]).toBeInstanceOf(InvalidPayloadError);
});

test(`Short circuits on Array body in update/delete use`, async () => {
	mockRequest.method = 'PATCH';
	mockRequest.body = [1, 2, 3];

	await validateBatch('update')(mockRequest as Request, mockResponse as Response, nextFunction);

	expect(mockRequest.sanitizedQuery).toBe(undefined);
	expect(nextFunction).toHaveBeenCalled();
});

test(`Sets sanitizedQuery based on body.query in read operations`, async () => {
	mockRequest.method = 'SEARCH';

	mockRequest.body = {
		query: {
			sort: 'id',
		},
	};

	await validateBatch('read')(mockRequest as Request, mockResponse as Response, nextFunction);

	expect(mockRequest.sanitizedQuery).toEqual({
		sort: ['id'],
	});
});

test(`Doesn't allow both query and keys in a batch delete`, async () => {
	mockRequest.method = 'DELETE';

	mockRequest.body = {
		keys: [1, 2, 3],
		query: { filter: {} },
	};

	await validateBatch('delete')(mockRequest as Request, mockResponse as Response, nextFunction);

	expect(nextFunction).toHaveBeenCalledTimes(1);
	expect(vi.mocked(nextFunction)?.mock?.calls?.[0]?.[0]).toBeInstanceOf(InvalidPayloadError);
});

test(`Requires 'data' on batch update`, async () => {
	mockRequest.method = 'PATCH';

	mockRequest.body = {
		keys: [1, 2, 3],
		query: { filter: {} },
	};

	await validateBatch('update')(mockRequest as Request, mockResponse as Response, nextFunction);

	expect(nextFunction).toHaveBeenCalledTimes(1);
	expect(vi.mocked(nextFunction)?.mock?.calls?.[0]?.[0]).toBeInstanceOf(InvalidPayloadError);
});

test(`Calls next when all is well`, async () => {
	mockRequest.method = 'PATCH';

	mockRequest.body = {
		query: { filter: {} },
		data: {},
	};

	await validateBatch('update')(mockRequest as Request, mockResponse as Response, nextFunction);

	expect(nextFunction).toHaveBeenCalledTimes(1);
	expect(vi.mocked(nextFunction)?.mock?.calls?.[0]?.[0]).toBeUndefined();
});

// Spec 025 (FR-006, CHK015): SEARCH of items and of every system route checks the export of its body query.
test('SEARCH with export in the body query: the export permission of the route collection', async () => {
	vi.mocked(fetchBackofficeAccess).mockResolvedValue({
		allowed: false,
		filter: null,
		fields: [],
		formats: [],
		rules: [],
	});

	for (const collection of ['articles', 'directus_users']) {
		mockRequest = {
			method: 'SEARCH',
			body: { query: { export: 'csv' } },
			collection,
			accountability: { user: 'u1', admin: false } as any,
		};
		const next = vi.fn();

		await validateBatch('read')(mockRequest as Request, mockResponse as Response, next);

		expect(next.mock.calls[0]![0]).toMatchObject({ code: 'FORBIDDEN' });
	}

	expect(vi.mocked(fetchBackofficeAccess).mock.calls.map(([options]) => options.collection)).toEqual([
		'articles',
		'directus_users',
	]);
});

test('SEARCH without export, or another method: no permission read', async () => {
	vi.mocked(fetchBackofficeAccess).mockReset();
	mockRequest = { method: 'SEARCH', body: { query: { limit: 1 } }, collection: 'articles', accountability: {} as any };

	await validateBatch('read')(mockRequest as Request, mockResponse as Response, nextFunction);
	expect(fetchBackofficeAccess).not.toHaveBeenCalled();
});
