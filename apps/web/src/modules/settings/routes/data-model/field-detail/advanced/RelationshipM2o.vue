<!-- Ported from directus/app/src/modules/settings/routes/data-model/field-detail/field-detail-advanced/field-detail-advanced-relationship-m2o.vue -->
<script setup lang="ts">
// Backoffice: VInput/VSelect/VCheckbox/VNotice are the Bo components (inputs named by aria-label), VDivider a section
// title, the CSS form grids Tailwind grids; the arrows stay decorative.
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import RelatedCollectionSelect from '../shared/RelatedCollectionSelect.vue';
import { syncFieldDetailStoreProperty, useFieldDetailStore } from '../store/index.ts';
import { useFieldsStore } from '../../../../../../stores/fields.ts';
import BoCheckbox from '../../../../../../components/BoCheckbox.vue';
import BoIcon from '../../../../../../components/BoIcon.vue';
import BoInput from '../../../../../../components/BoInput.vue';
import BoNotice from '../../../../../../components/BoNotice.vue';
import BoSelect from '../../../../../../components/BoSelect.vue';

const { t } = useI18n();

const fieldDetailStore = useFieldDetailStore();
const fieldsStore = useFieldsStore();

const relatedCollection = syncFieldDetailStoreProperty('relations.m2o.related_collection');
const correspondingField = syncFieldDetailStoreProperty('fields.corresponding');
const correspondingFieldKey = syncFieldDetailStoreProperty('fields.corresponding.field');
const onDeleteRelated = syncFieldDetailStoreProperty('relations.m2o.schema.on_delete');

const { field, collection, editing, generationInfo } = storeToRefs(fieldDetailStore);

const isExisting = computed(() => editing.value !== '+');

const relatedPrimaryKey = computed(
	() => fieldsStore.getPrimaryKeyFieldForCollection(relatedCollection.value)?.field ?? 'id',
);

const currentField = computed(() => field.value.field);

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
					special: ['o2m'],
					interface: 'list-o2m',
				},
			};
		} else {
			correspondingField.value = null;
		}
	},
});

const correspondingLabel = computed(() => {
	if (relatedCollection.value) {
		return t('add_o2m_to_collection', { collection: relatedCollection.value });
	}

	return t('add_field_related');
});

const onDeleteOptions = computed(() =>
	[
		{
			text: t('referential_action_set_null', { field: currentField.value }),
			value: 'SET NULL',
		},
		{
			text: t('referential_action_set_default', { field: currentField.value }),
			value: 'SET DEFAULT',
		},
		{
			text: t('referential_action_cascade', {
				collection: collection.value,
				field: currentField.value,
			}),
			value: 'CASCADE',
		},
		{
			text: t('referential_action_no_action', { field: currentField.value }),
			value: 'NO ACTION',
		},
	].filter((o) => !(o.value === 'SET NULL' && field.value.schema?.is_nullable === false)),
);
</script>

<template>
	<div>
		<div class="relative grid grid-cols-2 gap-x-7 gap-y-3 font-mono" data-cols="2">
			<div>
				<p class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">{{ $t('this_collection') }}</p>
				<BoInput disabled :model-value="collection ?? ''" :aria-label="$t('this_collection')" />
			</div>

			<div>
				<p class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">{{ $t('related_collection') }}</p>

				<RelatedCollectionSelect v-model="relatedCollection" :disabled="isExisting" />
			</div>

			<BoInput disabled :model-value="currentField ?? ''" :aria-label="$t('field', 1)" />
			<BoInput
				:model-value="relatedPrimaryKey ?? ''"
				disabled
				:placeholder="$t('primary_key') + '...'"
				:aria-label="$t('primary_key') + '...'"
			/>
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
				<p class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">{{ $t('create_field') }}</p>
				<BoCheckbox v-model="hasCorresponding" :label="correspondingLabel" />
			</div>
			<div>
				<p class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">{{ $t('field_name') }}</p>
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

		<div class="grid grid-cols-1 gap-x-7 gap-y-5 sm:grid-cols-2">
			<p
				class="mt-8 mb-4 border-b border-gray-200 pb-1 text-theme-sm font-semibold text-gray-800 dark:border-gray-800 dark:text-white/90 sm:col-span-2"
			>
				{{ $t('relational_triggers') }}
			</p>

			<div>
				<p class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
					{{
						$t('referential_action_field_label_m2o', {
							collection: relatedCollection || 'related',
						})
					}}
				</p>
				<BoSelect
					v-model="onDeleteRelated"
					:disabled="collection === relatedCollection"
					:placeholder="$t('choose_action') + '...'"
					:items="onDeleteOptions"
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
