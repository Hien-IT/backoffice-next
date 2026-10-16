<!-- Ported from directus/app/src/interfaces/_system/system-collection/system-collection.vue -->
<script setup lang="ts">
// Backoffice: VSelect is BoSelect (`showDeselect` row when allowNone), linked to the form label by the FormField ids.
import { computed, inject } from 'vue';
import BoSelect from '../../../components/BoSelect.vue';
import { FORM_FIELD_A11Y } from '../../../components/form/types.ts';
import { useCollectionsStore } from '../../../stores/collections.ts';

const props = withDefaults(
	defineProps<{
		value: string | null;
		disabled?: boolean;
		includeSystem?: boolean;
		includeSingleton?: boolean;
		allowNone?: boolean;
	}>(),
	{ includeSingleton: true },
);

const emit = defineEmits<{
	(e: 'input', value: string | null): void;
}>();

const a11y = inject(FORM_FIELD_A11Y, null);
const collectionsStore = useCollectionsStore();

const collections = computed(() => {
	let collections = collectionsStore.allCollections;

	if (!props.includeSingleton) {
		collections = collections.filter((collection) => collection?.meta?.singleton === false);
	}

	return [...collections, ...(props.includeSystem ? collectionsStore.crudSafeSystemCollections : [])];
});

const items = computed(() => {
	return collections.value.reduce<{ text: string; value: string }[]>((acc, collection) => {
		if (collection.type !== 'alias') {
			acc.push({
				text: collection.name,
				value: collection.collection,
			});
		}

		return acc;
	}, []);
});
</script>

<template>
	<BoSelect
		:id="a11y?.inputId"
		:model-value="value"
		:disabled="!!disabled"
		:show-deselect="!!allowNone"
		:items="items"
		:placeholder="$t('select_a_collection')"
		@update:model-value="emit('input', $event)"
		@deselect="emit('input', null)"
	/>
</template>
