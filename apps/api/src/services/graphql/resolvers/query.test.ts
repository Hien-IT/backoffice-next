// Ported from directus/api/src/services/graphql/resolvers/query.test.ts
import { ForbiddenError } from '@backoffice/errors';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { assertCollectionToggles } from '../../../utils/collection-toggles.js';
import { parseArgs } from '../schema/parse-args.js';
import { getQuery } from '../schema/parse-query.js';
import { getAggregateQuery } from '../utils/aggregate-query.js';
import { replaceFragmentsInSelections } from '../utils/replace-fragments.js';
import { resolveQuery } from './query.js';

vi.mock('../utils/replace-fragments.js');
vi.mock('../schema/parse-args.js');
vi.mock('../utils/aggregate-query.js');
vi.mock('../schema/parse-query.js');
vi.mock('../../../utils/collection-toggles.js');

describe('resolveQuery', () => {
	const mockReplaceFragments = vi.fn();
	const mockParseArgs = vi.fn();
	const mockGetAggregateQuery = vi.fn();
	const mockGetQuery = vi.fn();

	beforeEach(() => {
		vi.mocked(replaceFragmentsInSelections).mockImplementation(mockReplaceFragments);
		vi.mocked(parseArgs).mockImplementation(mockParseArgs);
		vi.mocked(getAggregateQuery).mockImplementation(mockGetAggregateQuery);
		vi.mocked(getQuery).mockImplementation(mockGetQuery);
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.resetAllMocks();
		vi.restoreAllMocks();
	});

	test('system scope prefixes collection with directus_', async () => {
		mockReplaceFragments.mockReturnValue([{}]);
		mockParseArgs.mockReturnValue({});

		mockGetQuery.mockResolvedValue({
			fields: [],
		});

		const gql: any = {
			scope: 'system',
			schema: { collections: {} },
			accountability: {},
			read: vi.fn(() => []),
		};

		const info: any = {
			fieldName: 'users',
			fieldNodes: [{ selectionSet: { selections: [{}] }, arguments: [] }],
			fragments: {},
			variableValues: {},
		};

		await resolveQuery(gql, info);

		expect(mockGetQuery).toHaveBeenCalled();
		const lastCallArgs = mockGetQuery.mock.calls[mockGetQuery.mock.calls.length - 1];
		const collectionArg = lastCallArgs?.[lastCallArgs.length - 1];
		expect(collectionArg).toBe('directus_users');
	});

	test('returns null when selections are missing', async () => {
		mockReplaceFragments.mockReturnValue(null);

		const gql: any = {
			scope: 'app',
			schema: { collections: {} },
			accountability: {},
			read: vi.fn(),
		};

		const info: any = {
			fieldName: 'posts',
			fieldNodes: [{ selectionSet: undefined }],
			fragments: {},
			variableValues: {},
		};

		const res = await resolveQuery(gql, info);

		expect(res).toBeNull();
		expect(mockParseArgs).not.toHaveBeenCalled();
	});

	test('aggregate branch calls getAggregateQuery with correct collection name', async () => {
		mockReplaceFragments.mockReturnValue([{}]);
		mockParseArgs.mockReturnValue({ id: 'id' });

		mockGetAggregateQuery.mockReturnValue({
			fields: [],
		});

		const gql: any = {
			scope: 'app',
			schema: {
				collections: {},
			},
			accountability: {},
			read: vi.fn(),
		};

		const info: any = {
			fieldName: 'posts_aggregated',
			fieldNodes: [{ selectionSet: { selections: [{}] }, arguments: [] }],
			fragments: {},
			variableValues: {},
		};

		await resolveQuery(gql, info);

		const lastCallArgs = mockGetAggregateQuery.mock.calls[mockGetAggregateQuery.mock.calls.length - 1];
		const collectionArg = lastCallArgs?.[lastCallArgs.length - 1];
		expect(collectionArg).toBe('posts');
	});

	test('query by id calls getQuery with correct collection name', async () => {
		mockReplaceFragments.mockReturnValue([{}]);
		mockParseArgs.mockReturnValue({ id: 'abc' });

		mockGetQuery.mockReturnValue({
			fields: [],
		});

		const gql: any = {
			scope: 'app',
			schema: {
				collections: {},
			},
			accountability: {},
			read: vi.fn(),
		};

		const info: any = {
			fieldName: 'posts_by_id',
			fieldNodes: [{ selectionSet: { selections: [{}] }, arguments: [] }],
			fragments: {},
			variableValues: {},
		};

		await resolveQuery(gql, info);

		expect(mockGetQuery).toHaveBeenCalled();
		const lastCallArgs = mockGetQuery.mock.calls[mockGetQuery.mock.calls.length - 1];
		const collectionArg = lastCallArgs?.[lastCallArgs.length - 1];
		expect(collectionArg).toBe('posts');
	});

	test('query by version injects versionRaw to query', async () => {
		mockReplaceFragments.mockReturnValue([{}]);
		mockParseArgs.mockReturnValue({ id: 'abc' });

		mockGetQuery.mockReturnValue({
			fields: [],
		});

		const gql: any = {
			scope: 'app',
			schema: {
				collections: {},
			},
			accountability: {},
			read: vi.fn(),
		};

		const info: any = {
			fieldName: 'posts_by_version',
			fieldNodes: [{ selectionSet: { selections: [{}] }, arguments: [] }],
			fragments: {},
			variableValues: {},
		};

		await resolveQuery(gql, info);

		expect(gql.read).toHaveBeenCalled();
		const lastCallArgs = gql.read.mock.calls[gql.read.mock.calls.length - 1];
		const queryArg = lastCallArgs?.[1];
		expect(queryArg).toEqual(expect.objectContaining({ versionRaw: true }));
	});

	test('properly resolves fields to correct path for each nested function field', async () => {
		mockReplaceFragments.mockReturnValue([{}]);
		mockParseArgs.mockReturnValue({ id: 'abc' });

		mockGetAggregateQuery.mockResolvedValue({
			fields: ['count(a)', 'sum(b.c)', 'max(c.d.e)'],
		});

		const gql: any = {
			scope: 'app',
			schema: { collections: {} },
			accountability: {},
			read: vi.fn(() => []),
		};

		const info: any = {
			fieldName: 'col_aggregated',
			fieldNodes: [{ selectionSet: { selections: [{}] }, arguments: [] }],
			fragments: {},
			variableValues: {},
		};

		await resolveQuery(gql, info);

		expect(gql.read).toHaveBeenCalled();
		const lastCallArgs = gql.read.mock.calls[gql.read.mock.calls.length - 1];
		const queryArg = lastCallArgs?.[1];
		expect(queryArg).toEqual(expect.objectContaining({ fields: ['count(a)', 'b.sum(c)', 'c.d.max(e)'] }));
	});

	test('groupBy field named "group"', async () => {
		mockReplaceFragments.mockReturnValue([{}]);
		mockParseArgs.mockReturnValue({});

		mockGetAggregateQuery.mockResolvedValue({
			group: ['group'],
			aggregate: { count: ['id'] },
		});

		const gql: any = {
			scope: 'app',
			schema: { collections: {} },
			accountability: {},
			read: vi.fn(() => [
				{ group: 'admin', count: { id: 3 } },
				{ group: 'user', count: { id: 7 } },
			]),
		};

		const info: any = {
			fieldName: 'items_aggregated',
			fieldNodes: [{ selectionSet: { selections: [{}] }, arguments: [] }],
			fragments: {},
			variableValues: {},
		};

		const res = await resolveQuery(gql, info);

		expect(res).toEqual([
			{ group: { group: 'admin' }, count: { id: 3 } },
			{ group: { group: 'user' }, count: { id: 7 } },
		]);
	});

	test('groupBy function field', async () => {
		mockReplaceFragments.mockReturnValue([{}]);
		mockParseArgs.mockReturnValue({});

		mockGetAggregateQuery.mockResolvedValue({
			group: ['year(date_published)'],
			aggregate: { count: ['id'] },
		});

		const gql: any = {
			scope: 'app',
			schema: { collections: {} },
			accountability: {},
			read: vi.fn(() => [
				{ date_published_year: 2026, count: { id: 3 } },
				{ date_published_year: 2025, count: { id: 7 } },
			]),
		};

		const info: any = {
			fieldName: 'items_aggregated',
			fieldNodes: [{ selectionSet: { selections: [{}] }, arguments: [] }],
			fragments: {},
			variableValues: {},
		};

		const res = await resolveQuery(gql, info);

		expect(res).toEqual([
			expect.objectContaining({ group: { date_published_year: 2026 }, count: { id: 3 } }),
			expect.objectContaining({ group: { date_published_year: 2025 }, count: { id: 7 } }),
		]);
	});

	test('inject group field for each item when grouping', async () => {
		mockReplaceFragments.mockReturnValue([{}]);
		mockParseArgs.mockReturnValue({});

		mockGetAggregateQuery.mockResolvedValue({
			group: ['category'],
			aggregate: { count: ['id'] },
		});

		const gql: any = {
			scope: 'app',
			schema: { collections: {} },
			accountability: {},
			read: vi.fn(() => [
				{ category: 'A', count: { id: 5 } },
				{ category: 'B', count: { id: 10 } },
			]),
		};

		const info: any = {
			fieldName: 'items_aggregated',
			fieldNodes: [{ selectionSet: { selections: [{}] }, arguments: [] }],
			fragments: {},
			variableValues: {},
		};

		const res = await resolveQuery(gql, info);

		expect(res).toEqual([
			{ category: 'A', count: { id: 5 }, group: { category: 'A' } },
			{ category: 'B', count: { id: 10 }, group: { category: 'B' } },
		]);
	});
});

// Backoffice (spec 024, D-188): the toggles checked on the query of the field, after the suffix is stripped and
// before the read; the deep levels of nested fields are in that query (getQuery).
describe('collection toggles', () => {
	const gql = (scope = 'items') =>
		({ scope, schema: { collections: {} }, accountability: {}, read: vi.fn(async () => []) }) as any;

	const info = (fieldName: string) =>
		({
			fieldName,
			fieldNodes: [{ selectionSet: { selections: [{}] }, arguments: [] }],
			fragments: {},
			variableValues: {},
		}) as any;

	beforeEach(() => {
		vi.mocked(replaceFragmentsInSelections).mockReturnValue([{}] as any);
		vi.mocked(parseArgs).mockReturnValue({});
	});

	test.each([
		['posts', 'posts'],
		['posts_by_id', 'posts'],
		['posts_aggregated', 'posts'],
	])('%s: checked on %s with the query and schema', async (fieldName, collection) => {
		const query = { search: 'x', deep: { author: { _search: 'y' } } };
		vi.mocked(getQuery).mockResolvedValue(query as any);
		vi.mocked(getAggregateQuery).mockResolvedValue(query as any);
		const g = gql();

		await resolveQuery(g, info(fieldName));

		expect(assertCollectionToggles).toHaveBeenCalledWith(collection, query, g.schema);
	});

	test('system scope: the directus_ name, so the root is never blocked but deep still is checked', async () => {
		vi.mocked(getQuery).mockResolvedValue({ fields: [] } as any);
		const g = gql('system');

		await resolveQuery(g, info('users'));

		expect(assertCollectionToggles).toHaveBeenCalledWith('directus_users', { fields: [] }, g.schema);
	});

	test('a refused search: the error of the field, nothing read', async () => {
		vi.mocked(getQuery).mockResolvedValue({ search: 'x' } as any);
		vi.mocked(assertCollectionToggles).mockRejectedValue(new ForbiddenError());
		const g = gql();

		await expect(resolveQuery(g, info('posts'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
		expect(g.read).not.toHaveBeenCalled();
	});
});
