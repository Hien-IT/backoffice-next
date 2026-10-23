// Ported from directus/packages/composables/src/use-items.ts
import type { Filter, Item, Query } from '@directus/types';
import { getEndpoint, moveInArray } from '@directus/utils';
import { useMemoize } from '@vueuse/core';
import { isEmpty, isEqual, throttle } from 'lodash-es';
import type { ComputedRef, Ref, WritableComputedRef } from 'vue';
import { computed, ref, toRef, unref, watch } from 'vue';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { useCollection } from './use-collection.ts';

// Backoffice: axios/useApi -> sdk (FR-001); a canceled request is a fetch AbortError instead of an axios Cancel.
function isCancel(err: any): boolean {
	return err?.name === 'AbortError';
}

export type ManualSortData = {
	item: string | number;
	to: string | number;
};

export type UsableItems = {
	itemCount: Ref<number | null>;
	totalCount: Ref<number | null>;
	items: Ref<Item[]>;
	totalPages: ComputedRef<number>;
	loading: Ref<boolean>;
	loadingItemCount: Ref<boolean>;
	error: Ref<any>;
	changeManualSort: (data: ManualSortData) => Promise<void>;
	getItems: () => Promise<void>;
	getTotalCount: () => Promise<void>;
	clearCountCache: () => void;
	getItemCount: () => Promise<void>;
};

export type ComputedQuery = {
	fields: Ref<Query['fields']> | ComputedRef<Query['fields']> | WritableComputedRef<Query['fields']>;
	limit: Ref<Query['limit']> | ComputedRef<Query['limit']> | WritableComputedRef<Query['limit']>;
	sort: Ref<Query['sort']> | ComputedRef<Query['sort']> | WritableComputedRef<Query['sort']>;
	search: Ref<Query['search']> | ComputedRef<Query['search']> | WritableComputedRef<Query['search']>;
	filter: Ref<Query['filter']> | ComputedRef<Query['filter']> | WritableComputedRef<Query['filter']>;
	page: Ref<Query['page']> | WritableComputedRef<Query['page']>;
	/** System filter applied to total item count. */
	filterSystem?: Ref<Query['filter']> | ComputedRef<Query['filter']> | WritableComputedRef<Query['filter']>;
	alias?: Ref<Query['alias']> | ComputedRef<Query['alias']> | WritableComputedRef<Query['alias']>;
	deep?: Ref<Query['deep']> | ComputedRef<Query['deep']> | WritableComputedRef<Query['deep']>;
};

export function useItems(collection: Ref<string | null>, query: ComputedQuery): UsableItems {
	const { primaryKeyField } = useCollection(collection);

	const { fields, limit, sort, search, filter, page, filterSystem, alias, deep } = query;

	const endpoint = computed(() => {
		if (!collection.value) return null;
		return getEndpoint(collection.value);
	});

	const items = ref<Item[]>([]);
	const loading = ref(false);
	const loadingItemCount = ref(false);
	const error = ref<any>(null);

	const itemCount = ref<number | null>(null);
	const totalCount = ref<number | null>(null);

	const totalPages = computed(() => {
		if (itemCount.value === null) return 1;
		if (itemCount.value < (unref(limit) ?? 100)) return 1;
		return Math.ceil(itemCount.value / (unref(limit) ?? 100));
	});

	let itemsAbort: AbortController | null = null;
	let totalCountGeneration = 0;
	let itemCountGeneration = 0;

	let loadingTimeout: ReturnType<typeof setTimeout> | null = null;

	const fetchAggregate = useMemoize(
		async (url: string, filter: Query['filter'], search: Query['search']) => {
			const aggregate = primaryKeyField.value
				? {
						countDistinct: primaryKeyField.value.field,
					}
				: {
						count: '*',
					};

			const response = await sdk.request<any>(
				requestEndpoint(url, {
					params: {
						aggregate,
						...(filter ? { filter } : {}),
						...(search ? { search } : {}),
					},
				}),
			);

			return primaryKeyField.value
				? Number(response[0].countDistinct[primaryKeyField.value.field])
				: Number(response[0].count);
		},
		{
			getKey(url, filter, search) {
				const key: { url: string; filter?: Filter; search?: string } = { url };

				if (!isEmpty(filter)) key.filter = filter;
				if (!isEmpty(search)) key.search = search!;

				return JSON.stringify(key);
			},
		},
	);

	// Throttle is used to ensure we send the first trigger instantly, debounce will not.
	const fetchItems = throttle((shouldUpdateCount: boolean) => {
		Promise.all([getItems(), shouldUpdateCount ? getItemCount() : Promise.resolve()]);
	}, 500);

	watch(
		[collection, limit, sort, search, filter, fields, page, toRef(alias), toRef(deep)],
		async (after, before) => {
			if (isEqual(after, before)) return;

			const [newCollection, newLimit, newSort, newSearch, newFilter] = after;
			const [oldCollection, oldLimit, oldSort, oldSearch, oldFilter] = before;

			if (!newCollection || !query) return;

			if (newCollection !== oldCollection) {
				reset();
			}

			if (
				!isEqual(newFilter, oldFilter) ||
				!isEqual(newSort, oldSort) ||
				newLimit !== oldLimit ||
				newSearch !== oldSearch
			) {
				if (oldCollection) {
					page.value = 1;
				}
			}

			// determine if the count needs to be updated based on changes to a collection, filter, or search
			const shouldUpdateCount =
				newCollection !== oldCollection || !isEqual(newFilter, oldFilter) || newSearch !== oldSearch;

			fetchItems(shouldUpdateCount);
		},
		{ deep: true, immediate: true },
	);

	watch(
		[collection, toRef(filterSystem)],
		async (after, before) => {
			if (isEqual(after, before)) return;

			getTotalCount();
		},
		{ deep: true, immediate: true },
	);

	return {
		itemCount,
		totalCount,
		items,
		totalPages,
		loading,
		loadingItemCount,
		error,
		changeManualSort,
		getItems,
		getItemCount,
		getTotalCount,
		// Backoffice (018 D-115): the counts are memoized by their query; a caller that writes clears them before counting.
		clearCountCache: () => fetchAggregate.clear(),
	};

	async function getItems() {
		if (!endpoint.value) return;

		let isCurrentRequestCanceled = false;

		if (itemsAbort) itemsAbort.abort();
		itemsAbort = new AbortController();

		error.value = null;

		if (loadingTimeout) {
			clearTimeout(loadingTimeout);
		}

		loadingTimeout = setTimeout(() => {
			loading.value = true;
		}, 150);

		let fieldsToFetch = [...(unref(fields) ?? [])];

		// Make sure the primary key is always fetched
		if (
			!unref(fields)?.includes('*') &&
			primaryKeyField.value &&
			fieldsToFetch.includes(primaryKeyField.value.field) === false
		) {
			fieldsToFetch.push(primaryKeyField.value.field);
		}

		// Filter out fake internal columns. This is (among other things) for a fake $thumbnail m2o field
		// on directus_files
		fieldsToFetch = fieldsToFetch.filter((field) => field.startsWith('$') === false);

		try {
			const signal = itemsAbort.signal;

			const response = await sdk.request<any>(
				requestEndpoint(endpoint.value, {
					params: {
						limit: unref(limit),
						fields: fieldsToFetch.join(','),
						...(alias ? { alias: unref(alias) } : {}),
						sort: unref(sort),
						page: unref(page),
						search: unref(search),
						filter: unref(filter),
						deep: unref(deep),
					},
					onRequest: (options) => ({ ...options, signal }),
				}),
			);

			let fetchedItems = response;
			itemsAbort = null;

			/**
			 * @NOTE
			 *
			 * This is used in conjunction with the fake field in /src/stores/fields/fields.ts to be
			 * able to render out the directus_files collection (file library) using regular layouts
			 *
			 * Layouts expect the file to be a m2o of a `file` type, however, directus_files is the
			 * only collection that doesn't have this (obviously). This fake $thumbnail field is used to
			 * pretend there is a file m2o, so we can use the regular layout logic for files as well
			 */
			if (collection.value === 'directus_files') {
				fetchedItems = fetchedItems.map((file: any) => ({
					...file,
					$thumbnail: file,
				}));
			}

			items.value = fetchedItems;

			if (page && fetchedItems.length === 0 && page?.value !== 1) {
				page.value = 1;
			}
		} catch (err: any) {
			if (isCancel(err)) {
				isCurrentRequestCanceled = true;
			} else {
				error.value = err;
			}
		} finally {
			if (loadingTimeout && !isCurrentRequestCanceled) {
				clearTimeout(loadingTimeout);
				loadingTimeout = null;
			}

			if (!loadingTimeout) loading.value = false;
		}
	}

	function reset() {
		items.value = [];
		totalCount.value = null;
		itemCount.value = null;
	}

	async function changeManualSort({ item, to }: ManualSortData) {
		const pk = primaryKeyField.value?.field;
		if (!pk) return;

		const fromIndex = items.value.findIndex((existing: Record<string, any>) => existing[pk] === item);
		const toIndex = items.value.findIndex((existing: Record<string, any>) => existing[pk] === to);

		items.value = moveInArray(items.value, fromIndex, toIndex);

		const endpoint = computed(() => `/utils/sort/${collection.value}`);
		await sdk.request(requestEndpoint(endpoint.value, { method: 'POST', body: { item, to } }));
	}

	async function getTotalCount() {
		if (!endpoint.value) return;

		const currentGeneration = ++totalCountGeneration;

		try {
			const count = await fetchAggregate(endpoint.value, filterSystem?.value, undefined);

			// Discard the result if a newer request has been initiated (prevents race conditions
			// when navigating between collections quickly)
			if (currentGeneration !== totalCountGeneration) return;

			totalCount.value = count;
		} catch (err: any) {
			// Backoffice (D-77): the counts run from watchers nobody awaits; DR rethrows here, which ends as an unhandled
			// rejection (a 403 on an unreadable collection, a request aborted by a navigation). The list request reports
			// its own error to the layout, so a failed count only keeps the previous value.
			if (!isCancel(err)) {
				// eslint-disable-next-line no-console
				console.warn(err);
			}
		}
	}

	async function getItemCount() {
		if (!endpoint.value) return;

		const currentGeneration = ++itemCountGeneration;

		loadingItemCount.value = true;

		try {
			const count = await fetchAggregate(endpoint.value, filter.value, search.value);

			// Discard the result if a newer request has been initiated (prevents race conditions
			// when rapidly changing filters or search terms)
			if (currentGeneration !== itemCountGeneration) return;

			itemCount.value = count;
		} catch (err: any) {
			// Backoffice: see getTotalCount.
			if (!isCancel(err)) {
				// eslint-disable-next-line no-console
				console.warn(err);
			}
		} finally {
			if (currentGeneration === itemCountGeneration) {
				loadingItemCount.value = false;
			}
		}
	}
}
