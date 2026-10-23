<!-- Ported from directus/app/src/modules/settings/routes/data-model/field-detail/field-detail-advanced/field-detail-advanced-relationship-o2m.vue -->
<script setup lang="ts">
// Backoffice: VInput/VSelect/VCheckbox/VNotice are the Bo components (inputs named by aria-label), VDivider a section
// title, the CSS form grids Tailwind grids; the arrows stay decorative.
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import RelatedCollectionSelect from '../shared/RelatedCollectionSelect.vue';
import RelatedFieldSelect from '../shared/RelatedFieldSelect.vue';
import { syncFieldDetailStoreProperty, useFieldDetailStore } from '../store/index.ts';
import { useFieldsStore } from '../../../../../../stores/fields.ts';
import { useRelationsStore } from '../../../../../../stores/relations.ts';
import BoIcon from '../../../../../../components/BoIcon.vue';
import BoInput from '../../../../../../components/BoInput.vue';
import BoNotice from '../../../../../../components/BoNotice.vue';
import BoSelect from '../../../../../../components/BoSelect.vue';

const fieldDetailStore = useFieldDetailStore();
const relationsStore = useRelationsStore();
const fieldsStore = useFieldsStore();

const relatedCollection = syncFieldDetailStoreProperty('relations.o2m.collection');
const relatedField = syncFieldDetailStoreProperty('relations.o2m.field');
const sortField = syncFieldDetailStoreProperty('relations.o2m.meta.sort_field');
const onDelete = syncFieldDetailStoreProperty('relations.o2m.schema.on_delete');
const onDeselect = syncFieldDetailStoreProperty('relations.o2m.meta.one_deselect_action');

const { collection, editing, generationInfo } = storeToRefs(fieldDetailStore);

const isExisting = computed(() => editing.value !== '+');
const currentPrimaryKey = computed(() => fieldsStore.getPrimaryKeyFieldForCollection(collection.value!)?.field);

const unsortableJunctionFields = computed(() => {
	const fields = [];

	if (relatedCollection.value) {
		const relations = relationsStore.getRelationsForCollection(relatedCollection.value);
		fields.push(...relations.map((field) => field.field));
	}

	return fields;
});
</script>

<template>
	<div>
		<div class="relative grid grid-cols-2 gap-x-7 gap-y-3 font-mono" data-cols="2">
			<div>
				<p class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">{{ $t('this_collection') }}</p>
				<BoInput disabled :model-value="collection ?? ''" :aria-label="$t('this_collection')" />
			</div>

			<div>
				<p class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">
					{{ $t('related_collection') }}
				</p>
				<RelatedCollectionSelect v-model="relatedCollection" :disabled="isExisting" />
			</div>

			<BoInput disabled :model-value="currentPrimaryKey ?? ''" :aria-label="$t('primary_key')" />

			<RelatedFieldSelect v-model="relatedField" :collection="relatedCollection" />

			<BoIcon name="arrow_forward" aria-hidden="true" class="arrow pointer-events-none absolute text-brand-500" />
		</div>

		<div class="font-mono">
			<p
				class="mt-8 mb-4 border-b border-gray-200 pb-1 text-theme-sm font-semibold text-gray-800 dark:border-gray-800 dark:text-white/90"
			>
				{{ $t('sort_field') }}
			</p>

			<RelatedFieldSelect
				v-model="sortField"
				:collection="relatedCollection"
				:type-allow-list="['integer', 'bigInteger', 'float', 'decimal']"
				:disabled-fields="unsortableJunctionFields"
				:placeholder="$t('add_sort_field') + '...'"
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
						$t('referential_action_field_label_o2m', {
							collection: relatedCollection || 'related',
						})
					}}
				</p>
				<BoSelect
					v-model="onDeselect"
					:placeholder="$t('choose_action') + '...'"
					:items="[
						{
							text: $t('referential_action_set_null', { field: relatedField }),
							value: 'nullify',
						},
						{
							text: $t('referential_action_cascade', {
								collection: relatedCollection,
								field: relatedField,
							}),
							value: 'delete',
						},
					]"
				/>
			</div>

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
					:disabled="collection === relatedCollection"
					:placeholder="$t('choose_action') + '...'"
					:items="[
						{
							text: $t('referential_action_set_null', { field: relatedField }),
							value: 'SET NULL',
						},
						{
							text: $t('referential_action_set_default', { field: relatedField }),
							value: 'SET DEFAULT',
						},
						{
							text: $t('referential_action_cascade', {
								collection: relatedCollection,
								field: relatedField,
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
/* The decorative arrows sit between the columns of the input row under the labels (DR `.arrow`). */
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
