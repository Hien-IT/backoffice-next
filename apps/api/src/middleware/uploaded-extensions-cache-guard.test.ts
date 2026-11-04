// Backoffice (spec 031, D-212.2): the shared response cache is skipped for the reads of /extensions only while this node
// has an uploaded package loaded.
import type { Request, Response } from 'express';
import { beforeEach, expect, test, vi } from 'vitest';
import { getExtensionManager } from '../extensions/index.js';
import uploadedExtensionsCacheGuard from './uploaded-extensions-cache-guard.js';

vi.mock('../extensions/index.js', () => ({ getExtensionManager: vi.fn() }));

const hasUploadedExtensions = vi.fn();

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(getExtensionManager).mockReturnValue({ hasUploadedExtensions } as any);
});

function run(req: Partial<Request>) {
	const res = { locals: {} } as Response;
	const next = vi.fn();
	uploadedExtensionsCacheGuard({ query: {}, method: 'GET', ...req } as Request, res, next);
	expect(next).toHaveBeenCalledOnce();
	return res.locals;
}

const SKIP = { skipCacheRead: true, cache: false };

test('an uploaded package loaded: GET /extensions, GET /extensions/:pk, GraphQL system extensions skip the cache', () => {
	hasUploadedExtensions.mockReturnValue(true);

	expect(run({ originalUrl: '/extensions' })).toEqual(SKIP);
	expect(run({ originalUrl: '/extensions?x=1' })).toEqual(SKIP);
	expect(run({ originalUrl: '/extensions/5c1f6c80-0000-4000-8000-000000000031' })).toEqual(SKIP);
	expect(
		run({ originalUrl: '/graphql/system', method: 'POST', body: { query: '{ extensions { id } }' } } as any),
	).toEqual(SKIP);
});

test('other requests keep the cache, uploads or not', () => {
	hasUploadedExtensions.mockReturnValue(true);

	expect(run({ originalUrl: '/extensions/registry' })).toEqual({});
	expect(run({ originalUrl: '/extensions/sources/index.js' })).toEqual({});
	expect(run({ originalUrl: '/items/articles' })).toEqual({});
	expect(run({ originalUrl: '/graphql/system', method: 'POST', body: { query: '{ users { id } }' } } as any)).toEqual({});
});

test('no uploaded package: GET /extensions keeps the DR caching', () => {
	hasUploadedExtensions.mockReturnValue(false);

	expect(run({ originalUrl: '/extensions' })).toEqual({});
});
