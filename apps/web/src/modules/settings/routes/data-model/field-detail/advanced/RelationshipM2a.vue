<!-- Ported from directus/app/src/modules/settings/routes/data-model/field-detail/field-detail-advanced/field-detail-advanced-relationship-m2a.vue -->
<script setup lang="ts">
// Backoffice: VInput/VSelect/VCheckbox/VNotice are the Bo components (inputs named by aria-label), VDivider a section
// title, the CSS form grids Tailwind grids; the arrows stay decorative.
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import RelatedCollectionSelect from '../shared/RelatedCollectionSelect.vue';
import RelatedFieldSelect from '../shared/RelatedFieldSelect.vue';
import { syncFieldDetailStoreProperty, useFieldDetailStore } from '../store/index.ts';
import { useCollectionsStore } from '../../../../../../stores/collections.ts';
import { useFieldsStore } from '../../../../../../stores/fields.ts';
import { useRelationsStore } from '../../../../../../stores/relations.ts';
import BoCheckbox from '../../../../../../components/BoCheckbox.vue';
import BoIcon from '../../../../../../components/BoIcon.vue';
import BoInput from '../../../../../../components/BoInput.vue';
import BoMultiSelect from '../../../../../../components/BoMultiSelect.vue';
import BoNotice from '../../../../../../components/BoNotice.vue';
import BoSelect from '../../../../../../components/BoSelect.vue';

const fieldDetailStore = useFieldDetailStore();
const collectionsStore = useCollectionsStore();
const relationsStore = useRelationsStore();
const fieldsStore = useFieldsStore();

const { collection, editing, generationInfo } = storeToRefs(fieldDetailStore);

const autoGenerateJunctionRelation = syncFieldDetailStoreProperty('autoGenerateJunctionRelation');
const junctionCollection = syncFieldDetailStoreProperty('relations.o2m.collection');
const junctionFieldCurrent = syncFieldDetailStoreProperty('relations.o2m.field');
const junctionFieldRelated = syncFieldDetailStoreProperty('relations.m2o.field');
const oneCollectionField = syncFieldDetailStoreProperty('relations.m2o.meta.one_collection_field');
const oneAllowedCollections = syncFieldDetailStoreProperty('relations.m2o.meta.one_allowed_collections', []);
const sortField = syncFieldDetailStoreProperty('relations.o2m.meta.sort_field');
const onDelete = syncFieldDetailStoreProperty('relations.o2m.schema.on_delete');
const onDeselect = syncFieldDetailStoreProperty('relations.o2m.meta.one_deselect_action');

const isExisting = computed(() => editing.value !== '+');
const currentPrimaryKey = computed(() => fieldsStore.getPrimaryKeyFieldForCollection(collection.value!)?.field);

const unsortableJunctionFields = computed(() => {
	const fields = ['item', 'collection'];

	if (junctionCollection.value) {
		const relations = relationsStore.getRelationsForCollection(junctionCollection.value);
		fields.push(...relations.map((field) => field.field));
	}

	return fields;
});

/** BoMultiSelect has no groups: the managed collections (singletons disabled), then the system ones. */
const allowedCollectionItems = computed(() => [
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
</script>

<template>
	<div>
		<div class="relative grid grid-cols-3 gap-x-7 gap-y-3 font-mono" data-cols="3">
			<div>
				<p class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">{{ $t('this_collection') }}</p>
				<BoInput disabled :model-value="collection ?? ''" :aria-label="$t('this_collection')" />
			</div>
			<div>
				<p class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">
					{{ $t('junction_collection') }}
				</p>
				<RelatedCollectionSelect v-model="junctionCollection" :disabled="autoGenerateJunctionRelation || isExisting" />
			</div>

			<div>
				<p class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">
					{{ $t('related_collections') }}
				</p>

				<BoMultiSelect
					v-model="oneAllowedCollections"
					:placeholder="$t('collection') + '...'"
					:aria-label="$t('related_collections')"
					:items="allowedCollectionItems"
					:preview-threshold="0"
				/>
			</div>

			<div class="primary-key">
				<div class="field-wrapper">
					<BoInput disabled :model-value="currentPrimaryKey ?? ''" :aria-label="$t('primary_key')" />
					<BoIcon name="arrow_forward" aria-hidden="true" class="arrow pointer-events-none absolute text-brand-500" />
				</div>
			</div>

			<RelatedFieldSelect
				v-model="junctionFieldCurrent"
				:collection="junctionCollection"
				:disabled="autoGenerateJunctionRelation || isExisting"
			/>

			<div class="related-collections-preview">{{ (oneAllowedCollections ?? []).join(', ') }}</div>

			<div aria-hidden="true" />

			<div class="junction-field-related">
				<div class="field-wrapper">
					<RelatedFieldSelect
						v-model="oneCollectionField"
						:collection="junctionCollection"
						:placeholder="$t('collection_key') + '...'"
						:disabled="autoGenerateJunctionRelation || isExisting"
					/>
					<BoIcon name="arrow_back" aria-hidden="true" class="arrow pointer-events-none absolute text-brand-500" />
				</div>
			</div>

			<div aria-hidden="true" />

			<div class="field-wrapper">
				<RelatedFieldSelect v-model="junctionFieldRelated" :disabled="autoGenerateJunctionRelation || isExisting" />
				<BoIcon name="arrow_back" aria-hidden="true" class="arrow pointer-events-none absolute text-brand-500" />
			</div>

			<BoInput disabled :model-value="$t('primary_key') ?? ''" :aria-label="$t('field', 1)" />

			<div aria-hidden="true" />
			<BoCheckbox v-if="!isExisting" v-model="autoGenerateJunctionRelation" :label="$t('auto_fill')" />
		</div>

		<div class="font-mono">
			<p
				class="mt-8 mb-4 border-b border-gray-200 pb-1 text-theme-sm font-semibold text-gray-800 dark:border-gray-800 dark:text-white/90"
			>
				{{ $t('sort_field') }}
			</p>
			<RelatedFieldSelect
				v-model="sortField"
				:type-allow-list="['integer', 'bigInteger', 'float', 'decimal']"
				:disabled-fields="unsortableJunctionFields"
				:collection="junctionCollection"
				:placeholder="$t('add_sort_field')"
				nullable
			/>
		</div>

		<div class="grid grid-cols-1 gap-x-7 gap-y-5 sm:grid-cols-2">
			<p
				class="mt-8 mb-4 border-b border-gray-200 pb-1 text-theme-sm font-semibold text-gray-800 dark:border-gray-800 dark:text-white/90 sm:col-span-2"
			>
				{{ $t('relational_triggers') }}
			</p>

			<div>
				<p class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">
					{{
						$t('referential_action_field_label_m2o', {
							collection: collection || 'related',
						})
					}}
				</p>
				<BoSelect
					v-model="onDelete"
					:disabled="collection === junctionCollection"
					:placeholder="$t('choose_action') + '...'"
					:items="[
						{
							text: $t('referential_action_set_null', { field: junctionFieldRelated }),
							value: 'SET NULL',
						},
						{
							text: $t('referential_action_set_default', { field: junctionFieldRelated }),
							value: 'SET DEFAULT',
						},
						{
							text: $t('referential_action_cascade', {
								collection: junctionCollection,
								field: junctionFieldRelated,
							}),
							value: 'CASCADE',
						},
						{
							text: $t('referential_action_no_action'),
							value: 'NO ACTION',
						},
					]"
				/>
			</div>

			<div>
				<p class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">
					{{
						$t('referential_action_field_label_o2m', {
							collection: junctionCollection || 'related',
						})
					}}
				</p>
				<BoSelect
					v-model="onDeselect"
					:placeholder="$t('choose_action') + '...'"
					:items="[
						{
							text: $t('referential_action_set_null', { field: junctionFieldRelated }),
							value: 'nullify',
						},
						{
							text: $t('referential_action_cascade', {
								collection: junctionCollection,
								field: junctionFieldRelated,
							}),
							value: 'delete',
						},
					]"
				/>
			</div>
		</div>

		<BoNotice v-if="generationInfo.length > 0" type="warning">
			<span>
				{{ $t('new_data_alert') }}
				<ul>
					<li v-for="(data, index) in generationInfo" :key="index">
						<span class="field-name">{{ data.name }}</span>
					</li>
				</ul>
			</span>
		</BoNotice>
	</div>
</template>

<style scoped>
/* The decorative arrows sit between the columns of the input row under the labels (Directus `.arrow`). */
.arrow {
	top: 6.4rem;
	transform: translateX(-50%);
}
[data-cols='2'] > .arrow {
	left: 50%;
}
[data-cols='3'] > .arrow:nth-last-of-type(2) {
	left: calc(100% / 3);
}
[data-cols='3'] > .arrow:last-of-type {
	left: calc(200% / 3);
}
[data-cols='2'] > .arrow:nth-last-of-type(2):not(:last-of-type) {
	display: none;
}
</style>
