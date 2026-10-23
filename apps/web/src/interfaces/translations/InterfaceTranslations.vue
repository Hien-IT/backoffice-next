<!-- Ported from directus/app/src/interfaces/translations/translations.vue -->
<script setup lang="ts">
// Backoffice: `useWindowSize` of @vueuse/core (same contract as DR composables/use-window-size.ts);
// use-nested-validation.ts is not ported yet, so its inject (string key `nestedValidation`, no-op default) is inlined
// in useNestedValidation below; unexpectedError keeps only its console warning until the notifications store (D-45);
// `getEndpoint` + `fetchAll` go through the SDK (#39). The interface is a group labelled by the field label
// (FORM_FIELD_A11Y); the first language menu trigger (a Reka trigger with its own id) is labelled by the field label
// and its value.
import type { ContentVersion } from '@directus/types';
import { getEndpoint } from '@directus/utils';
import { useWindowSize } from '@vueuse/core';
import { isNil } from 'lodash-es';
import { computed, inject, ref, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../components/BoIcon.vue';
import BoNotice from '../../components/BoNotice.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { validateItem } from '../../components/form/utils/validate-item.ts';
import { useRelationM2M } from '../../composables/use-relation-m2m.ts';
import {
	type DisplayItem,
	type RelationQueryMultiple,
	useRelationMultiple,
} from '../../composables/use-relation-multiple.ts';
import { type APIError, translateAPIError } from '../../lang/index.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { fetchAll } from '../../utils/fetch-all.ts';
import type { LanguageOption } from './LanguageSelect.vue';
import TranslationForm from './TranslationForm.vue';

function unexpectedError(error: unknown): void {
	// eslint-disable-next-line no-console
	console.warn(error);
}

const props = withDefaults(
	defineProps<{
		collection: string;
		field: string;
		primaryKey: string | number;
		languageField?: string | null;
		languageDirectionField?: string | null;
		defaultLanguage?: string | null;
		defaultOpenSplitView?: boolean;
		userLanguage?: boolean;
		value?: (number | string | Record<string, any>)[] | Record<string, any> | null;
		autofocus?: boolean;
		disabled?: boolean;
		nonEditable?: boolean;
		version?: ContentVersion | null;
	}>(),
	{
		languageField: null,
		languageDirectionField: 'direction',
		value: () => [],
		autofocus: false,
		disabled: false,
		nonEditable: false,
		defaultLanguage: null,
		defaultOpenSplitView: false,
		userLanguage: false,
		// Backoffice: optional (BoForm passes null outside versions).
		version: null,
	},
);

const emit = defineEmits(['input']);

const a11y = inject(FORM_FIELD_A11Y, null);

const value = computed({
	get: () => props.value ?? [],
	set: (val) => {
		emit('input', val);
	},
});

const { collection, field, primaryKey, version } = toRefs(props);
const { relationInfo } = useRelationM2M(collection, field);
const { locale } = useI18n();

const fieldsStore = useFieldsStore();

const { languageOptions, firstLang, secondLang, loading: languagesLoading } = useLanguages();

const { splitView, splitViewAvailable, splitViewEnabled } = useSplitView();

function useSplitView() {
	const selectedSplitView = ref<boolean>();

	const splitView = computed({
		get() {
			return selectedSplitView.value ?? props.defaultOpenSplitView;
		},
		set(value) {
			selectedSplitView.value = value;
		},
	});

	watch(splitView, (splitViewEnabled) => {
		if (splitViewEnabled && secondLang.value === firstLang.value) {
			const lang = languageOptions.value;
			const alternativeLang = lang.find((l) => l.value !== firstLang.value);
			secondLang.value = alternativeLang?.value ?? lang[0]?.value;
		}
	});

	const { width } = useWindowSize();
	const splitViewAvailable = computed(() => width.value > 960 && languageOptions.value.length > 1);
	const splitViewEnabled = computed(() => splitViewAvailable.value && splitView.value);

	return {
		splitView,
		splitViewAvailable,
		splitViewEnabled,
	};
}

const fields = computed(() => {
	if (!relationInfo.value) return [];
	return fieldsStore.getFieldsForCollection(relationInfo.value.junctionCollection.collection);
});

const query = ref<RelationQueryMultiple>({ fields: ['*'], limit: -1, page: 1 });

const {
	create,
	update,
	remove,
	isLocalItem,
	displayItems,
	loading: itemsLoading,
	fetchedItems,
	getItemEdits,
	error: loadError,
} = useRelationMultiple(value, query, relationInfo, primaryKey, version);

useNestedValidation();

function getItemWithLang<T extends Record<string, any>>(items: T[], lang: string | undefined) {
	const langField = relationInfo.value?.junctionField.field;
	const relatedPKField = relationInfo.value?.relatedPrimaryKeyField.field;
	if (!langField || !relatedPKField || !lang) return;

	return items.find((item) => item?.[langField]?.[relatedPKField] === lang);
}

function updateValue(item: DisplayItem | undefined, lang: string | undefined) {
	const info = relationInfo.value;
	if (!info) return;

	const itemInfo = getItemWithLang(displayItems.value, lang);

	if (itemInfo) {
		const itemUpdates = {
			...item,
			[info.junctionField.field]: {
				[info.relatedPrimaryKeyField.field]: lang,
			},
			$type: itemInfo?.$type,
			$index: itemInfo?.$index,
			$edits: itemInfo?.$edits,
		} as DisplayItem;

		if (itemInfo[info.junctionPrimaryKeyField.field] !== undefined) {
			itemUpdates[info.junctionPrimaryKeyField.field] = itemInfo[info.junctionPrimaryKeyField.field];
		} else if (primaryKey.value !== '+') {
			itemUpdates[info.reverseJunctionField.field] = primaryKey.value;
		}

		update(itemUpdates);
	} else {
		create({
			...item,
			[info.junctionField.field]: {
				[info.relatedPrimaryKeyField.field]: lang,
			},
		});
	}
}

const translationProps = computed(() => ({
	languageOptions: languageOptions.value,
	disabled: props.disabled,
	nonEditable: props.nonEditable,
	autofocus: props.autofocus,
	relationInfo: relationInfo.value,
	getItemWithLang,
	loading: languagesLoading.value || itemsLoading.value,
	displayItems: displayItems.value,
	fetchedItems: fetchedItems.value,
	getItemEdits,
	isLocalItem,
	updateValue,
	remove,
}));

function useLanguages() {
	const languages = ref<Record<string, any>[]>([]);
	const firstLangRaw = ref<string>();
	const secondLangRaw = ref<string>();
	const loading = ref(false);
	const error = ref<any>(null);
	const fieldsStore = useFieldsStore();

	const languageOptions = computed<LanguageOption[]>(() => {
		const langField = relationInfo.value?.junctionField.field;

		if (!langField) return [];

		const writableFields = fields.value.filter(
			(field) => field.type !== 'alias' && field.meta?.hidden === false && field.meta.readonly === false,
		);

		const totalFields = writableFields.length;

		return languages.value.map((language) => {
			const info = relationInfo.value;
			if (!info) return language;

			const langCode = language[info.relatedPrimaryKeyField.field];

			const edits = getItemWithLang(displayItems.value, langCode);

			const filledFields = writableFields.filter((field) => !isNil((edits ?? {})[field.field])).length;

			return {
				text: language[props.languageField ?? relationInfo.value.relatedPrimaryKeyField.field],
				direction: props.languageDirectionField ? language[props.languageDirectionField] : undefined,
				value: langCode,
				edited: edits?.$type !== undefined,
				progress: Math.round((filledFields / totalFields) * 100),
				max: totalFields,
				current: filledFields,
			};
		});
	});

	const fieldsToFetch = computed(() => {
		const fields: string[] = [];
		if (!relationInfo.value) return fields;

		const collection = relationInfo.value.relatedCollection.collection;

		if (props.languageField !== null && fieldsStore.getField(collection, props.languageField)) {
			fields.push(props.languageField);
		}

		if (props.languageDirectionField !== null && fieldsStore.getField(collection, props.languageDirectionField)) {
			fields.push(props.languageDirectionField);
		}

		fields.push(relationInfo.value.relatedPrimaryKeyField.field);

		return fields;
	});

	const defaultLang = computed(() => {
		const pkField = relationInfo.value?.relatedPrimaryKeyField.field ?? '';

		const userLocale = props.userLanguage ? locale.value : props.defaultLanguage;
		const firstDefault = getDefaultLang(userLocale);
		const firstLang = firstDefault?.[pkField] as string;

		const defaultLocale = props.userLanguage ? props.defaultLanguage : null;
		let secondDefault = getDefaultLang(defaultLocale);

		if (!secondDefault || secondDefault[pkField] === firstLang) {
			secondDefault = languages.value.find((lang) => lang[pkField] !== firstLang) || languages.value[1];
		}

		const second = secondDefault?.[pkField] as string;

		return {
			first: firstLang,
			second,
		};

		function getDefaultLang(defaultLocale: string | null) {
			return languages.value.find((lang) => lang[pkField] === defaultLocale) || languages.value[0];
		}
	});

	const firstLang = computed({
		get() {
			return firstLangRaw.value ?? defaultLang.value.first;
		},
		set(value) {
			firstLangRaw.value = value;
		},
	});

	const secondLang = computed({
		get() {
			return secondLangRaw.value ?? defaultLang.value.second;
		},
		set(value) {
			secondLangRaw.value = value;
		},
	});

	watch(fieldsToFetch, fetchLanguages, { immediate: true });

	return { languageOptions, firstLang, secondLang, loading, error };

	async function fetchLanguages() {
		if (!relationInfo.value || !fieldsToFetch.value?.length) return;

		loading.value = true;

		try {
			languages.value = await fetchAll<Record<string, any>>(
				getEndpoint(relationInfo.value.relatedCollection.collection),
				{
					params: {
						fields: fieldsToFetch.value,
						sort:
							relationInfo.value.relatedCollection.meta?.sort_field ??
							props.languageField ??
							relationInfo.value.relatedPrimaryKeyField.field,
					},
				},
			);
		} catch (error) {
			unexpectedError(error);
		} finally {
			loading.value = false;
		}
	}
}

function useNestedValidation() {
	// Backoffice: useInjectNestedValidation of directus/app/src/composables/use-nested-validation.ts.
	const { updateNestedValidationErrors } = inject('nestedValidation', {
		updateNestedValidationErrors: (_field: string, _validationErrors: any[]) => {},
	});

	watch(
		() => displayItems.value,
		(updatedDisplayItems) => {
			const errorsMap = getErrorsPerLanguage(updatedDisplayItems);

			const validationErrors = Object.entries(errorsMap)?.flatMap(([lang, items]) =>
				items.map((item: Record<string, any>) => updateFieldName(item, lang)),
			);

			updateNestedValidationErrors(props.field, validationErrors);
		},
	);

	function getErrorsPerLanguage(updatedDisplayItems: DisplayItem[]) {
		const errorsMap: Record<string, any> = {};

		updatedDisplayItems?.forEach((item) => {
			const langField = relationInfo.value?.junctionField.field;
			const relatedPKField = relationInfo.value?.relatedPrimaryKeyField.field;
			if (!langField || !relatedPKField) return;

			const lang = item?.[langField]?.[relatedPKField];
			if (!lang) return;

			const errorsPerLanguage = validateItem(item, fields.value, item.$type === 'created', true);
			if (!errorsPerLanguage?.length) return;

			errorsMap[lang] = errorsPerLanguage.map((error) => addNestedProperties(error, lang));
		});

		return errorsMap;
	}

	function addNestedProperties(error: any, lang: string) {
		const field = fields.value?.find((field) => field.field === error.field);

		const nestedNames = {
			[lang]: languageOptions.value.find((langOption) => langOption.value === lang)?.text ?? lang,
			[error.field]: field?.name ?? error.field,
		};

		const validation_message = field?.meta?.validation_message;

		return { ...error, nestedNames, validation_message };
	}

	function updateFieldName(item: Record<string, any>, lang: string) {
		return { ...item, field: `${props.field}.${lang}.${item['field']}` };
	}
}

// Backoffice: DR `ICON_BTN` for the split view toggle (v-icon clickable + tooltip).
const ICON_BTN =
	'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div
		class="grid gap-x-6"
		:class="splitViewEnabled ? 'grid-cols-2' : 'grid-cols-1'"
		:role="a11y ? 'group' : undefined"
		:aria-labelledby="a11y?.labelId"
		:aria-describedby="a11y?.describedBy"
		:aria-invalid="a11y?.invalid || undefined"
		data-testid="translations"
	>
		<BoNotice v-if="loadError" type="danger" class="col-span-full mb-3">{{ translateAPIError(loadError as APIError) }}</BoNotice>

		<TranslationForm
			v-model:lang="firstLang"
			v-bind="translationProps"
			:trigger-attrs="a11y ? { 'aria-labelledby': a11y.labelId, 'aria-describedby': a11y.describedBy } : undefined"
		>
			<template #split-view="{ active, toggle }">
				<button
					v-if="splitViewAvailable && !splitViewEnabled"
					type="button"
					:class="ICON_BTN"
					:aria-label="$t('interfaces.translations.toggle_split_view')"
					:title="$t('interfaces.translations.toggle_split_view')"
					:disabled="disabled && !nonEditable"
					data-testid="split-view-open"
					@click.stop="
						if (active) toggle();
						splitView = true;
					"
				>
					<BoIcon name="flip" size="sm" />
				</button>
			</template>
		</TranslationForm>

		<TranslationForm v-if="splitViewEnabled" v-model:lang="secondLang" v-bind="translationProps" secondary>
			<template #split-view>
				<button
					type="button"
					:class="ICON_BTN"
					:aria-label="$t('interfaces.translations.toggle_split_view')"
					:title="$t('interfaces.translations.toggle_split_view')"
					:disabled="disabled && !nonEditable"
					data-testid="split-view-close"
					@click="splitView = false"
				>
					<BoIcon name="flip" size="sm" />
				</button>
			</template>
		</TranslationForm>
	</div>
</template>
