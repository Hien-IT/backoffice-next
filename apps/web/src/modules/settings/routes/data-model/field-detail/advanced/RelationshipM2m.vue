<!-- Ported from directus/app/src/modules/settings/routes/data-model/field-detail/field-detail-advanced/field-detail-advanced-relationship-m2m.vue -->
<script setup lang="ts">
// Backoffice: VInput/VSelect/VCheckbox/VNotice are the Bo components (inputs named by aria-label), VDivider a section
// title, the CSS form grids Tailwind grids; the arrows stay decorative.
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import RelatedCollectionSelect from '../shared/RelatedCollectionSelect.vue';
import RelatedFieldSelect from '../shared/RelatedFieldSelect.vue';
import { syncFieldDetailStoreProperty, useFieldDetailStore } from '../store/index.ts';
import { useFieldsStore } from '../../../../../../stores/fields.ts';
import { useRelationsStore } from '../../../../../../stores/relations.ts';
import BoCheckbox from '../../../../../../components/BoCheckbox.vue';
import BoIcon from '../../../../../../components/BoIcon.vue';
import BoInput from '../../../../../../components/BoInput.vue';
import BoNotice from '../../../../../../components/BoNotice.vue';
import BoSelect from '../../../../../../components/BoSelect.vue';

const { t } = useI18n();

const fieldDetailStore = useFieldDetailStore();
const relationsStore = useRelationsStore();
const fieldsStore = useFieldsStore();

const { collection, editing, generationInfo } = storeToRefs(fieldDetailStore);

const sortField = syncFieldDetailStoreProperty('relations.o2m.meta.sort_field');
const junctionCollection = syncFieldDetailStoreProperty('relations.o2m.collection');
const junctionFieldCurrent = syncFieldDetailStoreProperty('relations.o2m.field');
const junctionFieldRelated = syncFieldDetailStoreProperty('relations.m2o.field');
const relatedCollection = syncFieldDetailStoreProperty('relations.m2o.related_collection');
const autoGenerateJunctionRelation = syncFieldDetailStoreProperty('autoGenerateJunctionRelation');
const onDeleteCurrent = syncFieldDetailStoreProperty('relations.o2m.schema.on_delete');
const onDeleteRelated = syncFieldDetailStoreProperty('relations.m2o.schema.on_delete');
const deselectAction = syncFieldDetailStoreProperty('relations.o2m.meta.one_deselect_action');
const correspondingField = syncFieldDetailStoreProperty('fields.corresponding');
const correspondingFieldKey = syncFieldDetailStoreProperty('fields.corresponding.field');

const isExisting = computed(() => editing.value !== '+');

const currentPrimaryKey = computed(() => fieldsStore.getPrimaryKeyFieldForCollection(collection.value!)?.field);

const relatedPrimaryKey = computed(
	() => fieldsStore.getPrimaryKeyFieldForCollection(relatedCollection.value)?.field ?? 'id',
);

const hasCorresponding = computed({
	get() {
		return !!correspondingField.value;
	},
	set(enabled: boolean) {
		if (enabled) {
			correspondingField.value = {
				field: collection.value,
				collection: relatedCollection.value,
				type: 'alias',
				meta: {
					special: ['m2m'],
					interface: 'list-m2m',
				},
			};
		} else {
			correspondingField.value = null;
		}
	},
});

const correspondingLabel = computed(() => {
	if (junctionCollection.value) {
		return t('add_m2m_to_collection', { collection: relatedCollection.value });
	}

	return t('add_field_related');
});

const unsortableJunctionFields = computed(() => {
	const fields = [];

	if (junctionCollection.value) {
		const relations = relationsStore.getRelationsForCollection(junctionCollection.value);
		fields.push(...relations.map((field) => field.field));
	}

	return fields;
});
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
					{{ $t('related_collection') }}
				</p>
				<RelatedCollectionSelect v-model="relatedCollection" :disabled="isExisting" />
			</div>

			<BoInput disabled :model-value="currentPrimaryKey ?? ''" :aria-label="$t('primary_key')" />

			<RelatedFieldSelect
				v-model="junctionFieldCurrent"
				:collection="junctionCollection"
				:disabled="autoGenerateJunctionRelation || isExisting"
			/>

			<div aria-hidden="true" />
			<div aria-hidden="true" />

			<RelatedFieldSelect
				v-model="junctionFieldRelated"
				:collection="junctionCollection"
				:disabled="autoGenerateJunctionRelation || isExisting"
			/>

			<BoInput
				v-model="relatedPrimaryKey"
				disabled
				:placeholder="$t('primary_key') + '...'"
				:aria-label="$t('primary_key') + '...'"
			/>

			<div aria-hidden="true" />

			<BoCheckbox v-if="!isExisting" v-model="autoGenerateJunctionRelation" :label="$t('auto_fill')" />

			<BoIcon name="arrow_forward" aria-hidden="true" class="arrow pointer-events-none absolute text-brand-500" />
			<BoIcon name="arrow_back" aria-hidden="true" class="arrow pointer-events-none absolute text-brand-500" />
		</div>

		<p
			v-if="!isExisting"
			class="mt-8 mb-4 border-b border-gray-200 pb-1 text-theme-sm font-semibold text-gray-800 dark:border-gray-800 dark:text-white/90"
		>
			{{ $t('corresponding_field') }}
		</p>

		<div v-if="!isExisting" class="relative grid grid-cols-2 gap-x-7 gap-y-3 font-mono" data-cols="2">
			<div>
				<p class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">{{ $t('create_field') }}</p>
				<BoCheckbox v-model="hasCorresponding" :label="correspondingLabel" />
			</div>
			<div>
				<p class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">{{ $t('field_name') }}</p>
				<BoInput
					v-model="correspondingFieldKey"
					:disabled="hasCorresponding === false"
					:placeholder="$t('field_name') + '...'"
					db-safe
					:aria-label="$t('field_name') + '...'"
				/>
			</div>
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
				:collection="junctionCollection"
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
							collection: junctionCollection || '',
						})
					}}
				</p>
				<BoSelect
					v-model="deselectAction"
					:placeholder="$t('choose_action') + '...'"
					:items="[
						{
							text: $t('referential_action_set_null', {
								collection: junctionCollection,
								field: junctionFieldCurrent,
							}),
							value: 'nullify',
						},
						{
							text: $t('referential_action_cascade', {
								collection: junctionCollection,
								field: junctionFieldCurrent,
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
					v-model="onDeleteCurrent"
					:disabled="junctionCollection === collection"
					:placeholder="$t('choose_action') + '...'"
					:items="[
						{
							text: $t('referential_action_set_null', { field: junctionFieldCurrent }),
							value: 'SET NULL',
						},
						{
							text: $t('referential_action_set_default', { field: junctionFieldCurrent }),
							value: 'SET DEFAULT',
						},
						{
							text: $t('referential_action_cascade', {
								collection: junctionCollection,
								field: junctionFieldCurrent,
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
						$t('referential_action_field_label_m2o', {
							collection: relatedCollection || 'related',
						})
					}}
				</p>
				<BoSelect
					v-model="onDeleteRelated"
					:disabled="junctionCollection === relatedCollection"
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
