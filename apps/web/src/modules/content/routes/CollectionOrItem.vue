<!-- Ported from directus/app/src/modules/content/routes/collection-or-item.vue -->
<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core';
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useCollectionsStore } from '../../../stores/collections.ts';
import { LAST_ACCESSED_COLLECTION } from '../../content.ts';
import CollectionRoute from './CollectionRoute.vue';
import ItemRoute from './ItemRoute.vue';

const props = defineProps<{
	collection: string;
	bookmark?: string | undefined;
	archive?: string | null | undefined;
}>();

const route = useRoute();

const lastAccessedCollection = useLocalStorage<string | null>(LAST_ACCESSED_COLLECTION, null);

const collectionsStore = useCollectionsStore();

const isSingleton = computed(() => {
	const collectionInfo = collectionsStore.getCollection(props.collection);
	return !!collectionInfo?.meta?.singleton === true;
});

watch(
	() => route.params,
	(newParams) => {
		if (typeof newParams['collection'] === 'string' && lastAccessedCollection.value !== newParams['collection']) {
			lastAccessedCollection.value = newParams['collection'];
		}
	},
	{ immediate: true },
);
</script>

<template>
	<ItemRoute v-if="isSingleton" :collection="collection" singleton />
	<CollectionRoute v-else :collection="collection" :bookmark="bookmark" :archive="archive" />
</template>
