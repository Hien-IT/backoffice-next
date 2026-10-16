<!-- Ported from directus/app/src/modules/settings/routes/data-model/field-detail/field-detail-simple/relationship-configuration.vue -->
<script setup lang="ts">
// Backoffice: the m2a multiple VSelect is BoMultiSelect (managed collections, then the CRUD-safe system ones; a flat
// list instead of the Directus `system` group, singletons disabled); required marks are a star with an sr-only text.
import { computed } from 'vue';
import BoIcon from '../../../../../../components/BoIcon.vue';
import BoMultiSelect from '../../../../../../components/BoMultiSelect.vue';
import { useCollectionsStore } from '../../../../../../stores/collections.ts';
import RelatedCollectionSelect from '../shared/RelatedCollectionSelect.vue';
import RelatedFieldSelect from '../shared/RelatedFieldSelect.vue';
import { syncFieldDetailStoreProperty } from '../store/index.ts';

defineProps<{
	localType: string;
}>();

const collectionsStore = useCollectionsStore();

const relatedCollectionM2O = syncFieldDetailStoreProperty('relations.m2o.related_collection');
const o2mCollection = syncFieldDetailStoreProperty('relations.o2m.collection');
const o2mField = syncFieldDetailStoreProperty('relations.o2m.field');
const oneAllowedCollections = syncFieldDetailStoreProperty('relations.m2o.meta.one_allowed_collections', []);

const availableCollections = computed(() => [
	...collectionsStore.databaseCollections
		.filter((collection) => collection.meta)
		.map((collection) => ({
			text: collection.collection,
			value: collection.collection,
			disabled: !!collection.meta?.singleton,
		})),
	...collectionsStore.crudSafeSystemCollections.map((collection) => ({
		text: collection.collection,
		value: collection.collection,
	})),
]);

const LABEL = 'mb-1.5 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-400';
</script>

<template>
	<div class="grid grid-cols-1 gap-x-6 gap-y-5 empty:hidden sm:grid-cols-2">
		<div v-if="localType === 'm2o'" class="sm:col-span-2">
			<p :class="LABEL">
				{{ $t('related_collection') }}
				<BoIcon name="star" size="sm" class="text-error-600 dark:text-error-400" :label="$t('required')" />
			</p>
			<RelatedCollectionSelect v-model="relatedCollectionM2O" />
		</div>
		<template v-else-if="localType === 'o2m'">
			<div>
				<p :class="LABEL">
					{{ $t('related_collection') }}
					<BoIcon name="star" size="sm" class="text-error-600 dark:text-error-400" :label="$t('required')" />
				</p>
				<RelatedCollectionSelect v-model="o2mCollection" />
			</div>
			<div>
				<p :class="LABEL">
					{{ $t('foreign_key') }}
					<BoIcon name="star" size="sm" class="text-error-600 dark:text-error-400" :label="$t('required')" />
				</p>
				<RelatedFieldSelect v-model="o2mField" :collection="o2mCollection" :disabled="!o2mCollection" />
			</div>
		</template>
		<div v-if="localType === 'm2m'" class="sm:col-span-2">
			<p :class="LABEL">
				{{ $t('related_collection') }}
				<BoIcon name="star" size="sm" class="text-error-600 dark:text-error-400" :label="$t('required')" />
			</p>
			<RelatedCollectionSelect v-model="relatedCollectionM2O" />
		</div>
		<div v-if="localType === 'translations'" class="sm:col-span-2">
			<p :class="LABEL">
				{{ $t('languages_collection') }}
				<BoIcon name="star" size="sm" class="text-error-600 dark:text-error-400" :label="$t('required')" />
			</p>
			<RelatedCollectionSelect v-model="relatedCollectionM2O" />
		</div>
		<div v-if="localType === 'm2a'" class="sm:col-span-2">
			<BoMultiSelect
				v-model="oneAllowedCollections"
				class="font-mono"
				:label="$t('related_collections')"
				:placeholder="$t('collection') + '...'"
				:items="availableCollections"
				:preview-threshold="0"
			/>
		</div>
	</div>
</template>
