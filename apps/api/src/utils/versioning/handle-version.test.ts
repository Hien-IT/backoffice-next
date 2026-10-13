// Backoffice: no test in Directus. Reading an item with `?version=` (spec FR-036, contracts/versions.md §6): the raw
// merge, the transaction that applies the delta then rolls back, and the ids of rows created only for the read.
import { ForbiddenError } from '@backoffice/errors';
import { SchemaBuilder } from '@backoffice/schema-builder';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { handleVersion } from './handle-version.js';

const getVersionSave = vi.fn();
vi.mock('../../services/versions.service.js', () => ({
	VersionsService: vi.fn(function () {
		return { getVersionSave };
	}),
}));

const instances: { options: any; updateOne: any; readByQuery: any }[] = [];
const updateOne = vi.fn();
const readByQuery = vi.fn();
vi.mock('../../services/items.service.js', () => ({
	ItemsService: vi.fn(function (_collection: string, options: any) {
		const instance = { options, updateOne, readByQuery };
		instances.push(instance);
		return instance;
	}),
}));

const rollback = vi.fn();
vi.mock('../transaction.js', () => ({
	transaction: vi.fn(async (_knex: unknown, handler: (trx: unknown) => Promise<unknown>) => handler({ rollback })),
}));

const schema = new SchemaBuilder()
	.collection('posts', (c) => {
		c.field('id').id();
		c.field('title').string();
		c.field('author').m2o('authors');
	})
	.collection('authors', (c) => {
		c.field('id').id();
		c.field('name').string();
	})
	.build();

const accountability = { user: 'u1', role: null, roles: [], admin: false, app: true, ip: null } as any;
const self = { collection: 'posts', schema, accountability, knex: {}, readByQuery: vi.fn() } as any;

afterEach(() => {
	vi.clearAllMocks();
	instances.length = 0;
});

describe('versionRaw', () => {
	test('merges the mapped delta of the version into the item read by the caller', async () => {
		self.readByQuery.mockResolvedValueOnce([{ id: 1, title: 'a', author: 2 }]);
		getVersionSave.mockResolvedValueOnce({ delta: { title: 'b' } });

		const query = { version: 'draft', versionRaw: true, filter: { id: { _eq: 1 } } };

		await expect(handleVersion(self, 1, query)).resolves.toEqual({ id: 1, title: 'b', author: 2 });
		expect(getVersionSave).toHaveBeenCalledWith('draft', 'posts', 1);
	});

	test('an item the caller cannot read is Forbidden', async () => {
		self.readByQuery.mockResolvedValueOnce([]);

		await expect(handleVersion(self, 1, { version: 'draft', versionRaw: true })).rejects.toBeInstanceOf(ForbiddenError);
	});
});

describe('applied delta', () => {
	test('a missing version is Forbidden', async () => {
		getVersionSave.mockResolvedValueOnce(undefined);

		await expect(handleVersion(self, 1, { version: 'nope' })).rejects.toBeInstanceOf(ForbiddenError);
		expect(getVersionSave).toHaveBeenCalledWith('nope', 'posts', 1, false);
	});

	test('applies the raw delta as admin without events or tracking, reads as the caller, then rolls back', async () => {
		getVersionSave.mockResolvedValueOnce({ delta: { title: 'b', _user: 'u1', _date: 'd' } });
		readByQuery.mockResolvedValueOnce([{ id: 1, title: 'b' }]);

		await expect(handleVersion(self, 1, { version: 'draft' })).resolves.toEqual({ id: 1, title: 'b' });

		expect(instances[0]!.options.accountability).toEqual({ admin: true });
		expect(updateOne).toHaveBeenCalledWith(
			1,
			{ title: 'b' },
			expect.objectContaining({
				emitEvents: false,
				autoPurgeCache: false,
				skipTracking: true,
				overwriteDefaults: { _user: 'u1', _date: 'd' },
			}),
		);
		expect(instances[1]!.options.accountability).toBe(accountability);
		expect(rollback).toHaveBeenCalledTimes(1);
	});

	test('ids of rows created only to read the version become null', async () => {
		getVersionSave.mockResolvedValueOnce({ delta: { author: { name: 'new' } } });
		updateOne.mockImplementationOnce(async (key: number, _delta: unknown, opts: any) => {
			opts.onItemCreate('authors', 9);
			return key;
		});
		readByQuery.mockResolvedValueOnce([{ id: 1, title: 'a', author: 9 }]);

		await expect(handleVersion(self, 1, { version: 'draft' })).resolves.toEqual({ id: 1, title: 'a', author: null });
	});

	test('nothing read back is Forbidden', async () => {
		getVersionSave.mockResolvedValueOnce({ delta: null });
		readByQuery.mockResolvedValueOnce([]);

		await expect(handleVersion(self, 1, { version: 'draft' })).rejects.toBeInstanceOf(ForbiddenError);
		expect(updateOne).not.toHaveBeenCalled();
	});
});
