// Ported from directus/packages/composables/src/use-items.test.ts
import type { Filter, Query } from '@directus/types';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { type Ref, ref, unref } from 'vue';
import { sdk } from '../api/sdk.ts';
import { calls, json, mockApi } from '../test-utils/fetch.ts';
import { useItems } from './use-items.ts';

// Backoffice: useApi (axios) -> sdk. sdk.request is a spy; the Directus assertions run on `mockApiGet(path, { params })`
// called with the path and params of each GET command, so they stay as in Directus.
vi.mock('../api/sdk.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../api/sdk.ts')>();
	return { ...actual, sdk: { request: vi.fn() } };
});

vi.mock('./use-collection.ts', () => ({
	useCollection: vi.fn(() => ({
		primaryKeyField: ref({ field: 'id' }),
	})),
}));

describe('useItems', () => {
	let mockApiGet: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockApiGet = vi.fn();

		vi.mocked(sdk.request).mockImplementation(async (command: any) => {
			const { path, params } = command();
			const response = await mockApiGet(path, { params });
			return response?.data.data;
		});

		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		vi.clearAllMocks();
		vi.resetAllMocks();
	});

	test('should call fetchItems immediately on first invocation', async () => {
		const collection = ref('test_collection');

		vi.mocked(mockApiGet).mockResolvedValue({
			data: {
				data: [
					{
						count: 1,
						countDistinct: { id: 1 },
					},
				],
			},
		});

		const query = {
			fields: ref(['id', 'name']),
			limit: ref(25),
			sort: ref(['id']),
			search: ref(''),
			filter: ref({}),
			page: ref(1),
		};

		await useItems(collection, query);

		// Should only call twice immediately (items + total); itemCount reuses totalCount when no filters
		expect(mockApiGet).toHaveBeenCalledTimes(2);
	});

	test('should throttle multiple rapid changes to query parameters', async () => {
		const collection = ref('test_collection');

		vi.mocked(mockApiGet).mockResolvedValue({
			data: {
				data: [
					{
						count: 1,
						countDistinct: { id: 1 },
					},
				],
			},
		});

		const query = {
			fields: ref(['id', 'name']),
			limit: ref(25),
			sort: ref(['id']),
			search: ref(''),
			filter: ref({}),
			page: ref(1),
		};

		await useItems(collection, query);

		// Should only call twice immediately (items + total); itemCount reuses totalCount when no filters
		expect(mockApiGet).toHaveBeenCalledTimes(2);

		// Trigger multiple rapid changes
		query.search.value = 'test1';
		query.search.value = 'test2';
		query.search.value = 'test3';

		// Fast-forward past throttle delay (500ms)
		await vi.advanceTimersByTimeAsync(500);

		// Should have been called: items(2) + total(1) + count(1) — memoize deduplicates totalCount on init
		expect(mockApiGet).toHaveBeenCalledTimes(4);
	});

	test('should allow subsequent calls after throttle period expires', async () => {
		const collection = ref('test_collection');

		vi.mocked(mockApiGet).mockResolvedValue({
			data: {
				data: [
					{
						count: 1,
						countDistinct: { id: 1 },
					},
				],
			},
		});

		const query = {
			fields: ref(['id', 'name']),
			limit: ref(25),
			sort: ref(['id']),
			search: ref(''),
			filter: ref({}),
			page: ref(1),
		};

		await useItems(collection, query);

		// Should only call twice immediately (items + total); itemCount reuses totalCount when no filters
		expect(mockApiGet).toHaveBeenCalledTimes(2);

		// First change (search is now non-empty, so getItemCount makes its own request)
		query.search.value = 'first';
		await vi.advanceTimersByTimeAsync(500);
		expect(mockApiGet).toHaveBeenCalledTimes(4);

		// Wait for throttle to reset
		await vi.advanceTimersByTimeAsync(100);

		// Second change after throttle period
		query.search.value = 'second';
		await vi.advanceTimersByTimeAsync(500);
		expect(mockApiGet).toHaveBeenCalledTimes(6);
	});

	test('should NOT call getItemCount if only limit changes', async () => {
		const collection = ref('test_collection');

		vi.mocked(mockApiGet).mockResolvedValue({
			data: {
				data: [
					{
						count: 1,
						countDistinct: { id: 1 },
					},
				],
			},
		});

		const limit = ref(1);

		const query = {
			fields: ref(['id', 'name']),
			limit,
			sort: ref(['id']),
			search: ref(''),
			filter: ref({}),
			page: ref(1),
		};

		await useItems(collection, query);

		// Should only call twice immediately (items + total); itemCount reuses totalCount when no filters
		expect(mockApiGet).toHaveBeenCalledTimes(2);

		limit.value = 5;

		// Fast-forward past throttle delay (500ms)
		await vi.advanceTimersByTimeAsync(500);

		// Should have been called once due to throttle (items(2), count(1), total(1))
		expect(mockApiGet).toHaveBeenCalledTimes(3);
	});

	test('should reset limit to 1 if filter changes', async () => {
		const collection = ref('test_collection');

		vi.mocked(mockApiGet).mockResolvedValue({
			data: {
				data: [
					{
						count: 1,
						countDistinct: { id: 1 },
					},
				],
			},
		});

		const filter: Ref<null | Filter> = ref(null);

		useItems(collection, {
			fields: ref(['*']),
			limit: ref(1),
			sort: ref(null),
			search: ref(null),
			filter,
			page: ref(5),
		});

		filter.value = { id: { _eq: 1 } };

		// advance throttle
		await vi.advanceTimersByTimeAsync(500);

		expect(mockApiGet).toHaveBeenCalledWith(
			'/items/test_collection',
			expect.objectContaining({
				params: expect.objectContaining({
					page: 1,
				}),
			}),
		);
	});

	test('should reset when collection changes', async () => {
		const collection = ref('old_collection');

		vi.mocked(mockApiGet).mockResolvedValue({
			data: {
				data: [
					{
						count: 1,
						countDistinct: { id: 1 },
					},
				],
			},
		});

		useItems(collection, {
			fields: ref(['*']),
			limit: ref(1),
			sort: ref(null),
			search: ref(null),
			filter: ref(null),
			page: ref(1),
		});

		expect(mockApiGet).toHaveBeenCalledWith('/items/old_collection', expect.any(Object));

		// update collection ref
		collection.value = 'new_collection';

		// advance throttle
		await vi.advanceTimersByTimeAsync(500);

		expect(mockApiGet).toHaveBeenCalledWith('/items/new_collection', expect.any(Object));
	});

	test('should reuse totalCount for itemCount when no filters or search are active', async () => {
		const collection = ref('test_collection');

		vi.mocked(mockApiGet).mockResolvedValue({
			data: {
				data: [
					{
						count: 42,
						countDistinct: { id: 42 },
					},
				],
			},
		});

		const query = {
			fields: ref(['id', 'name']),
			limit: ref(25),
			sort: ref(['id']),
			search: ref<string | null>(null),
			filter: ref<Filter | null>(null),
			page: ref(1),
		};

		const { itemCount, totalCount } = useItems(collection, query);

		await flushPromises();

		// Only 2 API calls: getItems + getTotalCount (getItemCount reuses totalCount)
		expect(mockApiGet).toHaveBeenCalledTimes(2);
		expect(totalCount.value).toBe(42);
		expect(itemCount.value).toBe(42);
	});

	test('should make separate itemCount request when search is active', async () => {
		const collection = ref('test_collection');

		vi.mocked(mockApiGet).mockResolvedValue({
			data: {
				data: [
					{
						count: 10,
						countDistinct: { id: 10 },
					},
				],
			},
		});

		const query = {
			fields: ref(['id', 'name']),
			limit: ref(25),
			sort: ref(['id']),
			search: ref('active search'),
			filter: ref<Filter | null>(null),
			page: ref(1),
		};

		useItems(collection, query);

		await flushPromises();

		// 3 API calls: getItems + getTotalCount + getItemCount (search is active, can't reuse)
		expect(mockApiGet).toHaveBeenCalledTimes(3);
	});

	test('should reuse totalCount when user filter matches system filter', async () => {
		const collection = ref('test_collection');
		const systemFilter = ref<Query['filter']>({ status: { _eq: 'published' } });

		vi.mocked(mockApiGet).mockResolvedValue({
			data: {
				data: [
					{
						count: 15,
						countDistinct: { id: 15 },
					},
				],
			},
		});

		const query = {
			fields: ref(['id', 'name']),
			limit: ref(25),
			sort: ref(['id']),
			search: ref<string | null>(null),
			filter: ref<Filter | null>({ status: { _eq: 'published' } }),
			page: ref(1),
			filterSystem: systemFilter,
		};

		const { itemCount, totalCount } = useItems(collection, query);

		await flushPromises();

		// Only 2 API calls: getItems + getTotalCount (filter matches systemFilter, so itemCount reuses)
		expect(mockApiGet).toHaveBeenCalledTimes(2);
		expect(totalCount.value).toBe(15);
		expect(itemCount.value).toBe(15);
	});

	test('should append $thumbnail to fetched items when collection is directus_files', async () => {
		vi.mocked(mockApiGet).mockResolvedValue({
			data: {
				data: [
					{
						count: 1,
						countDistinct: { id: 1 },
					},
				],
			},
		});

		const collection = ref('directus_files');

		const { items } = useItems(collection, {
			fields: ref(['*']),
			limit: ref(1),
			sort: ref(null),
			search: ref(null),
			filter: ref(null),
			page: ref(1),
		});

		await flushPromises();

		expect(unref(items.value[0]?.['$thumbnail'])).toBeOneOf([expect.any(Object)]);
	});
});

// Backoffice: extra cases (query string sent through the sdk, contracts/api-calls #34 and #35; errors; manual sort).
describe('useItems through the sdk', () => {
	beforeEach(() => setActivePinia(createPinia()));

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetAllMocks();
	});

	test('sends fields, sort, limit, page, search, filter and the aggregate counts', async () => {
		const actual = await vi.importActual<typeof import('../api/sdk.ts')>('../api/sdk.ts');
		vi.mocked(sdk.request).mockImplementation((command) => actual.sdk.request(command));

		const fetch = mockApi({
			'GET /items/articles': ({ url }: { url: URL }) =>
				json({ data: url.searchParams.has('aggregate') ? [{ countDistinct: { id: 3 } }] : [{ id: 1 }] }),
		});

		const { items, itemCount, totalCount } = useItems(ref('articles'), {
			fields: ref(['name', '$thumbnail']),
			limit: ref(25),
			sort: ref(['-name', 'id']),
			search: ref('x'),
			filter: ref({ status: { _eq: 'a' } }),
			page: ref(2),
			filterSystem: ref({ archived: { _eq: false } }),
		});

		await vi.waitFor(() => expect(totalCount.value).toBe(3));
		await vi.waitFor(() => expect(itemCount.value).toBe(3));

		expect(items.value).toEqual([{ id: 1 }]);

		expect(calls(fetch).sort()).toEqual([
			'GET /items/articles?fields=name,id&filter={"status":{"_eq":"a"}}&search=x&sort=-name,id&limit=25&page=2',
			'GET /items/articles?filter={"archived":{"_eq":false}}&aggregate={"countDistinct":"id"}',
			'GET /items/articles?filter={"status":{"_eq":"a"}}&search=x&aggregate={"countDistinct":"id"}',
		]);
	});

	test('keeps the error of the items request and ignores an aborted request', async () => {
		vi.mocked(sdk.request).mockImplementation(async (command: any) => {
			if (command().params.aggregate) return [{ countDistinct: { id: 0 } }];
			throw { message: 'Forbidden' };
		});

		const { error, getItems, loading } = useItems(ref('articles'), {
			fields: ref(['*']),
			limit: ref(1),
			sort: ref(null),
			search: ref(null),
			filter: ref(null),
			page: ref(1),
		});

		await flushPromises();
		expect(error.value).toEqual({ message: 'Forbidden' });
		expect(loading.value).toBe(false);

		vi.mocked(sdk.request).mockRejectedValue(new DOMException('aborted', 'AbortError'));
		await getItems();
		expect(error.value).toBeNull();
	});

	test('changeManualSort moves the item and posts to /utils/sort', async () => {
		vi.mocked(sdk.request).mockImplementation(async (command: any) =>
			command().params?.aggregate ? [{ countDistinct: { id: 2 } }] : [{ id: 1 }, { id: 2 }],
		);

		const { items, changeManualSort } = useItems(ref('articles'), {
			fields: ref(['*']),
			limit: ref(25),
			sort: ref(null),
			search: ref(null),
			filter: ref(null),
			page: ref(1),
		});

		await flushPromises();
		await changeManualSort({ item: 1, to: 2 });

		expect(items.value).toEqual([{ id: 2 }, { id: 1 }]);

		const command = vi.mocked(sdk.request).mock.calls.at(-1)![0] as any;
		expect(command()).toMatchObject({ method: 'POST', path: '/utils/sort/articles', body: '{"item":1,"to":2}' });
	});
});
