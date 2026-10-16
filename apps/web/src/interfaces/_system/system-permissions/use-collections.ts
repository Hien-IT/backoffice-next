// Ported from directus/app/src/interfaces/_system/system-permissions/add-collection/use-collections.ts
// Backoffice: isSystemCollection from get-item-route.ts (@directus/system-data is not a dependency of apps/web).
import { orderBy } from 'lodash-es';
import type { MaybeRefOrGetter } from 'vue';
import { computed, toValue } from 'vue';
import { type Collection, useCollectionsStore } from '../../../stores/collections.ts';
import { isSystemCollection } from '../../../utils/get-item-route.ts';

export interface UseCollectionsOptions {
	excludeCollections: MaybeRefOrGetter<string[]>;
}

export const useCollections = (options: UseCollectionsOptions) => {
	const collectionsStore = useCollectionsStore();

	const availableCollections = computed(() => {
		return orderBy(
			collectionsStore.databaseCollections.filter((collection) => collection.meta).map(disableSelectedCollection),
			['collection'],
		);
	});

	const systemCollections = computed(() =>
		orderBy(
			collectionsStore.collections
				.filter(({ collection }) => isSystemCollection(collection))
				.map(disableSelectedCollection),
			['collection'],
		),
	);

	const displayItems = computed(() => {
		const items: any[] = [...availableCollections.value];

		// Don't use a separate group for system collections, since the v-select search does not open groups,
		// so the experience is rather unpleasant

		if (availableCollections.value.length > 0 && systemCollections.value.length > 0) {
			items.push({ divider: true });
		}

		items.push(...systemCollections.value);

		return items;
	});

	function disableSelectedCollection(collection: Collection) {
		const excludeCollections = toValue(options.excludeCollections);

		return {
			...collection,
			disabled: excludeCollections.includes(collection.collection) ?? false,
		};
	}

	return { displayItems, availableCollections, systemCollections, disableSelectedCollection };
};
