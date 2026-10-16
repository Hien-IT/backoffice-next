<!-- Ported from directus/app/src/interfaces/_system/system-collections-translations/system-collections-translations.vue -->
<script setup lang="ts">
// Backoffice: VNotice is BoNotice (the title of the success notice as a bold first line), VSelect is BoSelect,
// VButton is BoButton. isSystemCollection is the `directus_` prefix (as stores/collections.ts).
import { computed, inject, ref, watch } from 'vue';
import BoButton from '../../../components/BoButton.vue';
import BoNotice from '../../../components/BoNotice.vue';
import BoSelect from '../../../components/BoSelect.vue';
import { useFieldsStore } from '../../../stores/fields.ts';
import { useRelationsStore } from '../../../stores/relations.ts';
import SystemCollectionsTranslationsDialog from './SystemCollectionsTranslationsDialog.vue';
import { detectTranslationConfigs, isFieldEligibleForTranslations } from './utils.ts';

const formValues = inject('values', ref({ collection: null as string | null }));
const fieldsStore = useFieldsStore();
const relationsStore = useRelationsStore();

const dialogActive = ref(false);
const dialogMode = ref<'enable' | 'manage'>('enable');
const selectedTranslationField = ref<string | null>(null);

const collection = computed(() => formValues.value.collection);

const isSystem = computed(() => {
	if (!collection.value) return false;
	return collection.value.startsWith('directus_');
});

const collectionFields = computed(() => {
	if (!collection.value) return [];
	return fieldsStore.getFieldsForCollection(collection.value);
});

const primaryKeyField = computed(() => {
	if (!collection.value) return null;
	return fieldsStore.getPrimaryKeyFieldForCollection(collection.value);
});

const availableFields = computed(() => {
	return collectionFields.value.filter((field) =>
		isFieldEligibleForTranslations(field, primaryKeyField.value?.field ?? null),
	);
});

const translationConfigs = computed(() => {
	if (!collection.value) return [];
	return detectTranslationConfigs(collection.value, collectionFields.value, relationsStore.relations);
});

const hasTranslations = computed(() => translationConfigs.value.length > 0);
const validTranslationConfigs = computed(() => translationConfigs.value.filter((config) => config.valid));

const invalidTranslationsConfigCount = computed(
	() => translationConfigs.value.length - validTranslationConfigs.value.length,
);

const translationConfigOptions = computed(() =>
	validTranslationConfigs.value.map((config) => ({
		text: `${config.translationField} -> ${config.translationsCollection}`,
		value: config.translationField,
	})),
);

const selectedConfig = computed(() => {
	if (!selectedTranslationField.value) return null;
	return (
		validTranslationConfigs.value.find((config) => config.translationField === selectedTranslationField.value) ?? null
	);
});

watch(
	validTranslationConfigs,
	(configs) => {
		if (configs.length === 0) {
			selectedTranslationField.value = null;
			return;
		}

		const selectedStillExists = configs.some((config) => config.translationField === selectedTranslationField.value);

		if (!selectedStillExists) {
			selectedTranslationField.value = configs[0]!.translationField;
		}
	},
	{ immediate: true },
);

function openEnableDialog() {
	dialogMode.value = 'enable';
	dialogActive.value = true;
}

function openManageDialog() {
	if (!selectedConfig.value) return;
	dialogMode.value = 'manage';
	dialogActive.value = true;
}
</script>

<template>
	<div v-if="collection && !isSystem">
		<div v-if="hasTranslations" class="flex flex-col gap-2.5">
			<BoNotice type="success">
				<p class="m-0 font-medium text-gray-800 dark:text-white/90">{{ $t('translations_already_enabled') }}</p>
				<p class="m-0 mt-1">{{ $t('translations_manage_helper_description') }}</p>

				<div v-if="validTranslationConfigs.length > 1" class="mt-3 flex flex-col gap-1.5">
					<BoSelect
						v-model="selectedTranslationField"
						:label="$t('translation_configuration')"
						:items="translationConfigOptions"
						:placeholder="$t('select')"
					/>
				</div>

				<BoNotice v-if="invalidTranslationsConfigCount > 0" type="warning" class="mt-3">
					{{ $t('translations_invalid_config_warning', { count: invalidTranslationsConfigCount }) }}
				</BoNotice>
			</BoNotice>

			<BoButton class="w-fit" :disabled="!selectedConfig" @click="openManageDialog">
				{{ $t('add_fields') }}
			</BoButton>
		</div>

		<div v-else class="flex flex-col gap-2.5">
			<BoNotice>
				{{ $t('translations_enable_helper_description') }}
			</BoNotice>

			<BoButton class="w-fit" :disabled="availableFields.length === 0" @click="openEnableDialog">
				{{ $t('enable_translations') }}
			</BoButton>
		</div>

		<SystemCollectionsTranslationsDialog
			v-model:active="dialogActive"
			:collection
			:mode="dialogMode"
			:config="dialogMode === 'manage' ? selectedConfig : null"
		/>
	</div>
</template>
