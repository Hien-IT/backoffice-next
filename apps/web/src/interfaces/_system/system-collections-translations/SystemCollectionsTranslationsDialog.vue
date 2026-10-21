<!-- Ported from directus/app/src/interfaces/_system/system-collections-translations/system-collections-translations-dialog.vue -->
<script setup lang="ts">
// Backoffice: VDrawer is BoDrawer, VCheckbox (array mode) is one boolean BoCheckbox per field, VSelect allow-other is
// BoCombobox, VInput is BoInput (`dbSafe`), VNotice is BoNotice (titles as a bold first line), VButton is BoButton;
// the API post goes through the SDK; unexpectedError is showUnexpectedError (D-66). The relationship inputs sit on two
// columns, the arrows next to the two foreign keys.
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../../api/sdk.ts';
import BoButton from '../../../components/BoButton.vue';
import BoCheckbox from '../../../components/BoCheckbox.vue';
import BoCombobox from '../../../components/BoCombobox.vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoInput from '../../../components/BoInput.vue';
import BoNotice from '../../../components/BoNotice.vue';
import BoDrawer from '../../../components/drawers/BoDrawer.vue';
import { showUnexpectedError as unexpectedError } from '../../../composables/use-notices.ts';
import { useCollectionsStore } from '../../../stores/collections.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import { useRelationsStore } from '../../../stores/relations.ts';
import type { TranslationConfig } from './utils.ts';
import { isFieldEligibleForTranslations } from './utils.ts';

const props = withDefaults(
	defineProps<{
		collection: string;
		mode?: 'enable' | 'manage';
		config?: TranslationConfig | null;
	}>(),
	{
		mode: 'enable',
		config: null,
	},
);

const { t } = useI18n();

const active = defineModel<boolean>('active', { default: false });

const collectionsStore = useCollectionsStore();
const fieldsStore = useFieldsStore();
const relationsStore = useRelationsStore();

const submitting = ref(false);
const showAdvancedMode = ref(false);
const autoFillNames = ref(true);
const selectedFields = ref<string[]>([]);
const translationsCollectionName = ref(`${props.collection}_translations`);
const languagesCollection = ref('languages');
const parentForeignKeyField = ref('');
const languageForeignKeyField = ref('');

const collectionFields = computed(() => fieldsStore.getFieldsForCollection(props.collection));
const primaryKeyField = computed(() => fieldsStore.getPrimaryKeyFieldForCollection(props.collection));
const isManageMode = computed(() => props.mode === 'manage');
const drawerTitle = computed(() => (isManageMode.value ? t('manage_translation_fields') : t('enable_translations')));

const availableFields = computed(() => {
	return collectionFields.value.filter((field) =>
		isFieldEligibleForTranslations(field, primaryKeyField.value?.field ?? null),
	);
});

const languagesCollectionExists = computed(() => {
	if (!languagesCollection.value) return false;
	return collectionsStore.getCollection(languagesCollection.value) !== null;
});

const languagesCollectionOptions = computed(() => {
	return collectionsStore.collections
		.map((collection) => ({
			text: collection.collection,
			value: collection.collection,
		}))
		.sort((a, b) => a.text.localeCompare(b.text));
});

const translationsCollectionExists = computed(() => {
	if (isManageMode.value) return false;
	const value = translationsCollectionName.value.trim();
	if (!value) return false;
	return collectionsStore.getCollection(value) !== null;
});

const manageConfigValid = computed(() => isManageMode.value && props.config?.valid === true);
const manageTargetCollection = computed(() => props.config?.translationsCollection ?? '');

const manageTranslationFields = computed(() =>
	manageTargetCollection.value ? fieldsStore.getFieldsForCollection(manageTargetCollection.value) : [],
);

const existingManageFieldNames = computed(() => {
	if (!props.config) return new Set<string>();

	const excluded = new Set(['id', props.config.parentForeignKeyField, props.config.languageForeignKeyField]);

	return new Set(
		manageTranslationFields.value.filter((field) => !excluded.has(field.field)).map((field) => field.field),
	);
});

const missingManageFields = computed(() =>
	availableFields.value.filter((field) => !existingManageFieldNames.value.has(field.field)),
);

const targetFields = computed(() => (isManageMode.value ? missingManageFields.value : availableFields.value));

const targetFieldOptions = computed(() =>
	targetFields.value.map((field) => ({
		field: field.field,
		name: field.name ?? field.field,
	})),
);

const isAllSelected = computed(() => {
	return targetFieldOptions.value.length > 0 && selectedFields.value.length === targetFieldOptions.value.length;
});

const parentPrimaryKey = computed(() => primaryKeyField.value?.field ?? 'id');

const languageCollectionName = computed(() => {
	if (isManageMode.value && props.config?.languagesCollection) return props.config.languagesCollection;
	return languagesCollection.value.trim();
});

const languagePrimaryKey = computed(() => {
	const languagesPrimaryKey = languageCollectionName.value
		? fieldsStore.getPrimaryKeyFieldForCollection(languageCollectionName.value)
		: null;

	return languagesPrimaryKey?.field ?? 'code';
});

const automaticParentForeignKeyField = computed(() => {
	if (isManageMode.value && props.config?.parentForeignKeyField) return props.config.parentForeignKeyField;
	return `${props.collection}_${parentPrimaryKey.value}`;
});

const automaticLanguageForeignKeyField = computed(() => {
	if (isManageMode.value && props.config?.languageForeignKeyField) return props.config.languageForeignKeyField;

	const languages = languageCollectionName.value || 'languages';
	return `${languages}_${languagePrimaryKey.value}`;
});

const resolvedParentForeignKeyField = computed(() => {
	if (isManageMode.value) return props.config?.parentForeignKeyField ?? '';
	if (autoFillNames.value) return automaticParentForeignKeyField.value;
	return parentForeignKeyField.value.trim();
});

const resolvedLanguageForeignKeyField = computed(() => {
	if (isManageMode.value) return props.config?.languageForeignKeyField ?? '';
	if (autoFillNames.value) return automaticLanguageForeignKeyField.value;
	return languageForeignKeyField.value.trim();
});

const fieldNameValidationMessage = computed(() => {
	if (isManageMode.value) return null;

	if (!resolvedParentForeignKeyField.value || !resolvedLanguageForeignKeyField.value) {
		return t('translations_field_name_required');
	}

	if (resolvedParentForeignKeyField.value === resolvedLanguageForeignKeyField.value) {
		return t('translations_foreign_key_name_conflict');
	}

	const allTargetNames = [
		'id',
		resolvedParentForeignKeyField.value,
		resolvedLanguageForeignKeyField.value,
		...selectedFields.value,
	];

	const duplicates = new Set<string>();

	for (const fieldName of allTargetNames) {
		if (allTargetNames.indexOf(fieldName) !== allTargetNames.lastIndexOf(fieldName)) {
			duplicates.add(fieldName);
		}
	}

	if (duplicates.size > 0) return t('translations_duplicate_field_names');

	return null;
});

const previewCollections = computed(() => {
	if (isManageMode.value) return [];

	const result: string[] = [];

	if (!translationsCollectionExists.value && translationsCollectionName.value.trim()) {
		result.push(translationsCollectionName.value.trim());
	}

	if (!languagesCollectionExists.value && languagesCollection.value.trim()) {
		result.push(languagesCollection.value.trim());
	}

	return result;
});

const previewFields = computed(() => {
	if (isManageMode.value) {
		return selectedFields.value;
	}

	const translationsCollection = translationsCollectionName.value.trim();

	// When the junction table already exists (re-enable case), only show
	// fields that will actually be created: new translated fields + the alias
	if (translationsCollectionExists.value) {
		const existingFields = fieldsStore.getFieldsForCollection(translationsCollection);
		const existingFieldNames = new Set(existingFields.map((f) => f.field));

		const newFields = selectedFields.value
			.filter((field) => !existingFieldNames.has(field))
			.map((field) => `${translationsCollection}.${field}`);

		return [...newFields, `${props.collection}.translations`].filter((field) => !field.includes('..'));
	}

	const fields = [
		`${translationsCollection}.id`,
		`${translationsCollection}.${resolvedParentForeignKeyField.value}`,
		`${translationsCollection}.${resolvedLanguageForeignKeyField.value}`,
		...selectedFields.value.map((field) => `${translationsCollection}.${field}`),
		`${props.collection}.translations`,
	];

	return fields.filter((field) => !field.includes('..'));
});

const previewRelations = computed(() => {
	if (isManageMode.value) return [];

	// Relations already exist when the junction table exists
	if (translationsCollectionExists.value) return [];

	const translationsCollection = translationsCollectionName.value.trim();
	const languages = languagesCollection.value.trim();

	return [
		`${translationsCollection}.${resolvedParentForeignKeyField.value} -> ${props.collection}`,
		`${translationsCollection}.${resolvedLanguageForeignKeyField.value} -> ${languages}`,
	].filter((entry) => !entry.includes('..'));
});

const canSubmit = computed(() => {
	if (isManageMode.value) {
		return manageConfigValid.value && selectedFields.value.length > 0;
	}

	return (
		selectedFields.value.length > 0 &&
		translationsCollectionName.value.trim().length > 0 &&
		languagesCollection.value.trim().length > 0 &&
		fieldNameValidationMessage.value === null
	);
});

watch(
	() => props.collection,
	(collection) => {
		translationsCollectionName.value = `${collection}_translations`;
	},
	{ immediate: true },
);

watch(
	targetFields,
	(fields) => {
		selectedFields.value = fields.map((field) => field.field);
	},
	{ immediate: true },
);

watch(
	() => props.config,
	(config) => {
		if (!config || props.mode !== 'manage') return;

		translationsCollectionName.value = config.translationsCollection;
		languagesCollection.value = config.languagesCollection ?? 'languages';
		parentForeignKeyField.value = config.parentForeignKeyField;
		languageForeignKeyField.value = config.languageForeignKeyField;
	},
	{ immediate: true },
);

watch(active, (isActive) => {
	if (!isActive) return;

	showAdvancedMode.value = false;
	if (!isManageMode.value) autoFillNames.value = true;
});

watch(
	[automaticParentForeignKeyField, automaticLanguageForeignKeyField, autoFillNames],
	([nextParentForeignKey, nextLanguageForeignKey, nextAutoFill]) => {
		if (!nextAutoFill) return;

		parentForeignKeyField.value = nextParentForeignKey;
		languageForeignKeyField.value = nextLanguageForeignKey;
	},
	{ immediate: true },
);

const generate = (body: Record<string, unknown>) =>
	sdk.request(requestEndpoint('/utils/translations/generate', { method: 'POST', body }));

function toggleField(field: string, checked: boolean) {
	selectedFields.value = checked
		? [...selectedFields.value, field]
		: selectedFields.value.filter((selected) => selected !== field);
}

function selectAllFields() {
	selectedFields.value = targetFields.value.map((field) => field.field);
}

function deselectAllFields() {
	selectedFields.value = [];
}

async function submitTranslations() {
	if (!canSubmit.value) return;

	if (isManageMode.value) {
		await generate({
			collection: props.collection,
			translationsCollection: manageTargetCollection.value,
			fields: selectedFields.value,
		});

		return;
	}

	await generate({
		collection: props.collection,
		fields: selectedFields.value,
		translationsCollection: translationsCollectionName.value.trim(),
		languagesCollection: languagesCollection.value.trim(),
		parentFkField: resolvedParentForeignKeyField.value,
		languageFkField: resolvedLanguageForeignKeyField.value,
		createLanguagesCollection: !languagesCollectionExists.value,
		seedLanguages: !languagesCollectionExists.value,
	});
}

async function submit() {
	if (!canSubmit.value) return;

	submitting.value = true;

	try {
		await submitTranslations();
	} catch (error) {
		unexpectedError(error);
		submitting.value = false;
		return;
	}

	active.value = false;
	submitting.value = false;

	try {
		await Promise.all([collectionsStore.hydrate(), fieldsStore.hydrate(), relationsStore.hydrate()]);
	} catch (error) {
		unexpectedError(error);
	}
}

const previewBlocks = computed(() =>
	[
		{ label: t('translations_preview_collections'), entries: previewCollections.value },
		{ label: t('translations_preview_fields'), entries: previewFields.value },
		{ label: t('translations_preview_relations'), entries: previewRelations.value },
	].filter((block) => block.entries.length > 0),
);

const TEXT_BTN =
	'rounded px-1 text-gray-500 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:text-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<BoDrawer v-model="active" :title="drawerTitle" icon="translate" @cancel="active = false">
		<div class="flex flex-col gap-4.5 p-6">
			<section>
				<p class="m-0 mb-2.5 text-sm font-medium text-gray-700 dark:text-gray-400">
					{{ isManageMode ? $t('fields_to_add_to_translations') : $t('fields_to_translate') }}
				</p>

				<BoNotice v-if="targetFieldOptions.length === 0" type="info">
					{{ isManageMode ? $t('translations_fields_up_to_date') : $t('no_fields_in_collection', { collection }) }}
				</BoNotice>

				<!-- the panel scrolls past 15.75rem with a sticky Select all footer: system-collections-translations-dialog.vue:536-540, 564-566 -->
				<div v-else class="max-h-[15.75rem] overflow-auto rounded-lg border border-gray-200 p-3 dark:border-gray-800">
					<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
						<BoCheckbox
							v-for="field in targetFieldOptions"
							:key="field.field"
							:model-value="selectedFields.includes(field.field)"
							:label="field.name"
							@update:model-value="toggleField(field.field, $event)"
						/>
					</div>
					<p
						class="sticky bottom-0 float-end m-0 mt-2 w-max rounded-ss-lg bg-white px-1.5 py-1 text-end text-theme-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400"
					>
						<button type="button" :class="TEXT_BTN" :disabled="isAllSelected" @click="selectAllFields">
							{{ $t('select_all') }}
						</button>
						/
						<button type="button" :class="TEXT_BTN" :disabled="selectedFields.length === 0" @click="deselectAllFields">
							{{ $t('deselect_all') }}
						</button>
					</p>
				</div>
			</section>

			<BoNotice v-if="translationsCollectionExists && !isManageMode" type="info">
				{{ $t('translations_collection_already_exists') }}
			</BoNotice>

			<button
				type="button"
				class="w-fit"
				:class="TEXT_BTN"
				:aria-expanded="showAdvancedMode"
				@click="showAdvancedMode = !showAdvancedMode"
			>
				{{ showAdvancedMode ? $t('hide_advanced_options') : $t('show_advanced_options') }}
			</button>

			<BoNotice v-if="fieldNameValidationMessage && !isManageMode" type="warning">
				{{ fieldNameValidationMessage }}
			</BoNotice>

			<section v-if="showAdvancedMode">
				<p class="m-0 mb-2.5 text-sm font-medium text-gray-700 dark:text-gray-400">{{ $t('relationship') }}</p>

				<div class="grid grid-cols-2 gap-x-5 gap-y-3">
					<BoInput :label="$t('this_collection')" disabled :model-value="collection" class="font-mono" />
					<BoInput
						v-model="translationsCollectionName"
						:label="$t('translations_collection')"
						db-safe
						class="font-mono"
						:disabled="isManageMode"
						:placeholder="$t('a_unique_table_name')"
					/>
					<BoCombobox
						v-if="!isManageMode"
						:model-value="languagesCollection"
						:label="$t('languages_collection')"
						:items="languagesCollectionOptions"
						allow-other
						:placeholder="$t('search_collection')"
						@update:model-value="languagesCollection = String($event ?? '')"
					/>
					<BoInput
						v-else
						:label="$t('languages_collection')"
						:model-value="props.config?.languagesCollection ?? '-'"
						disabled
						class="font-mono"
					/>
					<div />

					<BoInput :model-value="parentPrimaryKey" disabled :aria-label="$t('primary_key')" class="font-mono" />
					<div class="flex items-center gap-2">
						<BoIcon name="arrow_back" class="shrink-0 text-gray-500 dark:text-gray-400" />
						<BoInput
							v-model="parentForeignKeyField"
							class="min-w-0 flex-1 font-mono"
							:aria-label="$t('translations_collection')"
							:disabled="isManageMode || autoFillNames"
							db-safe
						/>
					</div>
					<div class="flex items-center gap-2">
						<BoInput
							v-model="languageForeignKeyField"
							class="min-w-0 flex-1 font-mono"
							:aria-label="$t('translations_collection')"
							:disabled="isManageMode || autoFillNames"
							db-safe
						/>
						<BoIcon name="arrow_forward" class="shrink-0 text-gray-500 dark:text-gray-400" />
					</div>
					<BoInput :model-value="languagePrimaryKey" disabled :aria-label="$t('primary_key')" class="font-mono" />
					<BoCheckbox v-if="!isManageMode" v-model="autoFillNames" :label="$t('auto_fill')" />
				</div>
			</section>

			<BoButton full-width :loading="submitting" :disabled="submitting || !canSubmit" @click="submit">
				{{ isManageMode ? $t('save') : $t('enable') }}
			</BoButton>

			<BoNotice v-if="!isManageMode || selectedFields.length > 0" type="warning">
				<template v-if="isManageMode">
					<p class="m-0 font-medium text-gray-800 dark:text-white/90">{{ $t('fields_to_add_to_translations') }}</p>
					<ul v-if="previewFields.length > 0" class="m-0 mt-2 ps-5">
						<li v-for="field in previewFields" :key="field" class="font-mono">{{ field }}</li>
					</ul>
					<span v-else>{{ $t('translations_fields_up_to_date') }}</span>
				</template>

				<template v-else>
					<p class="m-0">{{ $t('translations_copy_data_note') }}</p>
					<p class="m-0 mt-1 font-medium text-gray-800 dark:text-white/90">{{ $t('new_data_alert') }}</p>

					<div v-for="block in previewBlocks" :key="block.label" class="mt-3">
						<p class="m-0 font-medium">{{ block.label }}</p>
						<ul class="m-0 mt-1 ps-5">
							<li v-for="entry in block.entries" :key="entry" class="font-mono">{{ entry }}</li>
						</ul>
					</div>
				</template>
			</BoNotice>
		</div>
	</BoDrawer>
</template>
