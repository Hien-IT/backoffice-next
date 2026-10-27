// Backoffice (spec 024, D-188): DR has no test for resolvers/mutation.ts; these cases cover the collection toggles
// check, which runs on the collection without its suffix and before anything is written (clarify 2026-10-27).
import { ForbiddenError } from '@backoffice/errors';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { assertCollectionToggles } from '../../../utils/collection-toggles.js';
import { getService } from '../../../utils/get-service.js';
import { getQuery } from '../schema/parse-query.js';
import { replaceFragmentsInSelections } from '../utils/replace-fragments.js';
import { resolveMutation } from './mutation.js';

vi.mock('../../../utils/collection-toggles.js');
vi.mock('../../../utils/get-service.js');
vi.mock('../schema/parse-query.js');
vi.mock('../utils/replace-fragments.js');

const service = {
	createOne: vi.fn(async () => 1),
	createMany: vi.fn(async () => [1]),
	updateOne: vi.fn(async () => 1),
	updateMany: vi.fn(async () => [1]),
	updateBatch: vi.fn(async () => [1]),
	readOne: vi.fn(async () => ({ id: 1 })),
	readMany: vi.fn(async () => [{ id: 1 }]),
};

const gql = () =>
	({
		scope: 'items',
		schema: { collections: { posts: {}, home: { singleton: true } } },
		accountability: {},
		upsertSingleton: vi.fn(async () => ({})),
	}) as any;

const info = (fieldName: string) =>
	({ fieldName, fieldNodes: [{ selectionSet: { selections: [{}] } }], fragments: {}, variableValues: {} }) as any;

const query = { fields: ['id'], search: 'x' };

beforeEach(() => {
	vi.mocked(replaceFragmentsInSelections).mockReturnValue([{}] as any);
	vi.mocked(getQuery).mockResolvedValue(query as any);
	vi.mocked(getService).mockReturnValue(service as any);
});

afterEach(() => {
	vi.clearAllMocks();
	vi.resetAllMocks();
});

describe('checked on the collection without its suffix', () => {
	test.each([
		['create_posts_item', 'posts'],
		['create_posts_items', 'posts'],
		['update_posts_item', 'posts'],
		['update_posts_items', 'posts'],
		['update_posts_batch', 'posts'],
		['update_home', 'home'],
	])('%s → %s', async (fieldName, collection) => {
		const g = gql();
		await resolveMutation(g, { data: {}, ids: [1], id: 1 }, info(fieldName));
		expect(assertCollectionToggles).toHaveBeenCalledWith(collection, query, g.schema);
	});
});

describe('a refused search writes nothing', () => {
	beforeEach(() => vi.mocked(assertCollectionToggles).mockRejectedValue(new ForbiddenError()));

	test.each(['create_posts_item', 'create_posts_items', 'update_posts_items', 'update_posts_batch'])(
		'%s',
		async (fieldName) => {
			await expect(resolveMutation(gql(), { data: [{}], ids: [1] }, info(fieldName))).rejects.toMatchObject({
				code: 'FORBIDDEN',
			});

			for (const write of [service.createOne, service.createMany, service.updateMany, service.updateBatch]) {
				expect(write).not.toHaveBeenCalled();
			}
		},
	);

	test('a singleton update', async () => {
		const g = gql();
		await expect(resolveMutation(g, { data: {} }, info('update_home'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
		expect(g.upsertSingleton).not.toHaveBeenCalled();
	});
});

test('without a refusal the mutation runs as before', async () => {
	const g = gql();
	expect(await resolveMutation(g, { data: [{}] }, info('create_posts_items'))).toEqual([{ id: 1 }]);
	expect(service.createMany).toHaveBeenCalledWith([{}]);
});
