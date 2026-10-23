<!-- Ported from directus/app/src/displays/related-values/related-values.vue -->
<script setup lang="ts">
import { get } from 'lodash-es';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import BoIcon from '../../components/BoIcon.vue';
import ItemsMenu from '../../components/render/ItemsMenu.vue';
import RenderTemplate from '../../components/render/RenderTemplate.vue';
import ValueNull from '../../components/render/ValueNull.vue';
import { useCollection } from '../../composables/use-collection.ts';
import { getItemRoute } from '../../utils/get-item-route.ts';
import { getLocalTypeForField } from '../../utils/get-local-type.ts';
import { getRelatedCollection } from '../../utils/get-related-collection.ts';

const props = defineProps<{
	collection: string;
	field: string;
	value: Record<string, any> | Record<string, any>[] | null;
	template?: string;
}>();

const { t, te } = useI18n();

const relatedCollectionData = computed(() => {
	return getRelatedCollection(props.collection, props.field);
});

// Backoffice: `?.` so a field without relation reaches ValueNull (DR throws in the computed there).
const relatedCollection = computed(() => {
	return relatedCollectionData.value?.relatedCollection ?? null;
});

const junctionCollection = computed(() => {
	return relatedCollectionData.value?.junctionCollection;
});

const localType = computed(() => {
	return getLocalTypeForField(props.collection, props.field);
});

const { primaryKeyField } = useCollection(relatedCollection);

const primaryKeyFieldPath = computed(() => {
	return relatedCollectionData.value!.path
		? [...relatedCollectionData.value!.path, primaryKeyField.value?.field].join('.')
		: primaryKeyField.value?.field;
});

const internalTemplate = computed(() => {
	return props.template || `{{ ${primaryKeyFieldPath.value!} }}`;
});

const unit = computed(() => {
	if (Array.isArray(props.value)) {
		if (props.value.length === 1) {
			if (te(`collection_names_singular.${relatedCollection.value}`)) {
				return t(`collection_names_singular.${relatedCollection.value}`);
			} else {
				return t('item');
			}
		} else {
			if (te(`collection_names_plural.${relatedCollection.value}`)) {
				return t(`collection_names_plural.${relatedCollection.value}`);
			} else {
				return t('items');
			}
		}
	}

	return null;
});

// Backoffice: typed view of the value for the list branch (only arrays reach it).
const items = computed(() => (Array.isArray(props.value) ? props.value : []));

function getLinkForItem(item: any) {
	if (!relatedCollectionData.value || !primaryKeyFieldPath.value) return null;
	const primaryKey = get(item, primaryKeyFieldPath.value);

	return getItemRoute(relatedCollection.value, primaryKey);
}
</script>

<template>
	<ValueNull v-if="!relatedCollection" />
	<!-- Backoffice: "N items" menu recipe (ItemsMenu) instead of v-menu. -->
	<ItemsMenu
		v-else-if="['o2m', 'm2m', 'm2a', 'translations', 'files'].includes(localType!.toLowerCase())"
		class="toggle"
		:disabled="items.length === 0"
	>
		<template #trigger>
			<span class="label">
				{{ items.length }}
				<template v-if="items.length >= 100">+</template>
				{{ unit }}
			</span>
		</template>

		<ul class="links space-y-1">
			<li
				v-for="item in items"
				:key="item[primaryKeyFieldPath!]"
				class="flex items-center gap-2 px-3 py-2 text-theme-sm text-gray-700 dark:text-gray-400"
			>
				<RenderTemplate
					class="min-w-0 flex-1"
					:template="internalTemplate"
					:item="item"
					:collection="junctionCollection ?? relatedCollection"
				/>
				<!-- Backoffice: icon-only link, named for screen readers. -->
				<RouterLink
					:to="getLinkForItem(item)!"
					:aria-label="$t('open')"
					class="flex shrink-0 rounded text-gray-500 hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:text-brand-400 dark:focus-visible:outline-brand-400"
				>
					<BoIcon name="launch" size="sm" />
				</RouterLink>
			</li>
		</ul>
	</ItemsMenu>
	<RenderTemplate v-else :template="internalTemplate" :item="value ?? {}" :collection="relatedCollection" />
</template>
