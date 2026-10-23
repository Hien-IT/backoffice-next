<!-- Ported from directus/app/src/modules/settings/routes/data-model/field-detail/shared/related-collection-select.vue -->
<script setup lang="ts">
// Backoffice: VInput with an append menu is a db-safe BoInput next to a BoMenu button (`list_alt`, `select_existing`):
// the configured collections (singletons disabled), a divider, then the CRUD-safe system collections (DR puts
// them in a collapsed list group). An existing collection shows the key in the brand color (DR `.matches`).
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../../../../../components/BoIcon.vue';
import BoInput from '../../../../../../components/BoInput.vue';
import type { BoMenuItem } from '../../../../../../components/BoMenu.vue';
import BoMenu from '../../../../../../components/BoMenu.vue';
import { useCollectionsStore } from '../../../../../../stores/collections.ts';

const props = defineProps<{
	modelValue?: string | undefined;
	disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const { t } = useI18n();
const collectionsStore = useCollectionsStore();

const collectionExists = computed(() => {
	return !!collectionsStore.getCollection(props.modelValue ?? '');
});

const availableCollections = collectionsStore.databaseCollections.filter((collection) => collection.meta);
const systemCollections = collectionsStore.crudSafeSystemCollections;

const items = computed<BoMenuItem[]>(() => [
	...availableCollections.map((collection, index) => ({
		text: collection.collection,
		active: props.modelValue === collection.collection,
		disabled: !!collection.meta?.singleton,
		divider: index === availableCollections.length - 1,
		onSelect: () => emit('update:modelValue', collection.collection),
	})),
	...systemCollections.map((collection) => ({
		text: collection.collection,
		active: props.modelValue === collection.collection,
		onSelect: () => emit('update:modelValue', collection.collection),
	})),
]);

const ICON_BTN =
	'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div class="flex items-center gap-2">
		<div class="min-w-0 flex-1">
			<BoInput
				:model-value="modelValue ?? ''"
				class="font-mono"
				:class="{ '[&_input]:text-brand-500': collectionExists }"
				db-safe
				:disabled="!!disabled"
				:aria-label="t('collection')"
				:placeholder="t('collection') + '...'"
				@update:model-value="emit('update:modelValue', String($event ?? ''))"
			/>
		</div>
		<BoMenu v-if="!disabled" :items="items" align="end">
			<template #trigger>
				<button type="button" :class="ICON_BTN" :aria-label="t('select_existing')" :title="t('select_existing')">
					<BoIcon name="list_alt" size="sm" />
				</button>
			</template>
		</BoMenu>
	</div>
</template>
