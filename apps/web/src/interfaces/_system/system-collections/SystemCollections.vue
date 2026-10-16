<!-- Ported from directus/app/src/interfaces/_system/system-collections/system-collections.vue -->
<script setup lang="ts">
// Backoffice: VNotice is BoNotice; isSystemCollection is the `directus_` prefix (as stores/collections.ts).
import { computed } from 'vue';
import BoNotice from '../../../components/BoNotice.vue';
import { useCollectionsStore } from '../../../stores/collections.ts';
import InterfaceSelectMultipleCheckbox from '../../select-multiple-checkbox/SelectMultipleCheckbox.vue';

const props = withDefaults(
	defineProps<{
		value: string[] | null;
		disabled?: boolean;
		includeSystem?: boolean;
		includeSingleton?: boolean;
	}>(),
	{ includeSingleton: true },
);

const emit = defineEmits<{
	(e: 'input', value: string[] | null): void;
}>();

const collectionsStore = useCollectionsStore();

const collections = computed(() => {
	let collections = collectionsStore.sortedCollections.filter((collection) => collection.type === 'table');

	if (!props.includeSingleton) {
		collections = collections.filter((collection) => collection?.meta?.singleton === false);
	}

	if (!props.includeSystem) {
		collections = collections.filter((collection) => collection.collection.startsWith('directus_') === false);
	}

	return collections;
});

const items = computed(() => {
	return collections.value.map((collection) => ({
		text: collection.name,
		value: collection.collection,
	}));
});
</script>

<template>
	<BoNotice v-if="items.length === 0">
		{{ $t('no_collections') }}
	</BoNotice>
	<InterfaceSelectMultipleCheckbox
		v-else
		:choices="items"
		:value="value"
		:disabled="!!disabled"
		@input="emit('input', $event)"
	/>
</template>
