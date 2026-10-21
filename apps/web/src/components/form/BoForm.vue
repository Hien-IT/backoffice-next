<!-- Ported from directus/app/src/components/v-form/v-form.vue -->
<script setup lang="ts">
// Backoffice: template per the form grid (layout-patterns §8: two columns, `with-fill` third column above 726px);
// use-ai-tools and the collab context are removed (D-54); `inline` only changes the no-fields info (spec 020). Comparison mode (spec 014 FR-072,
// lifts D-55): a nested group form reads the parent's `comparison` through FORM_COMPARISON (group interfaces do not
// pass it on), and a differing field gets the recipe Q-10 highlight instead of the field-indicator bar. Group interfaces come from the registry: a group field whose interface is null or
// not registered is not rendered, nor its children, without a warning (measured on Directus, spec Edge Cases, T004).
// The system divider is drawn here (Directus: presentation-divider interface without title). `hasEdits` is exposed
// for the unsaved-changes guard (FR-084).
import type { ContentVersion, Field, ValidationError } from '@directus/types';
import { useElementSize } from '@vueuse/core';
import { assign, cloneDeep, isEmpty, isEqual, isNil, omit } from 'lodash-es';
import { computed, inject, onBeforeUpdate, provide, ref, watch } from 'vue';
import { getInterface } from '../../interfaces/index.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { selectiveClone } from '../../utils/selective-clone.ts';
import BoIcon from '../BoIcon.vue';
import FormField from './FormField.vue';
import type { MenuOptions } from './FormFieldMenu.vue';
import {
	type ComparisonContext,
	FORM_COMPARISON,
	type FieldValues,
	type FormField as TFormField,
	WIDTH_CLASSES,
} from './types.ts';
import { applyConditions } from './utils/apply-conditions.ts';
import { extractFieldFromFunction } from './utils/extract-field-from-function.ts';
import { getDefaultValuesFromFields } from './utils/get-default-values-from-fields.ts';
import { getFormFields } from './utils/get-form-fields.ts';
import { pushGroupOptionsDown } from './utils/push-group-options-down.ts';
import { updateFieldWidths } from './utils/update-field-widths.ts';
import { updateSystemDivider } from './utils/update-system-divider.ts';
import ValidationErrors from './ValidationErrors.vue';

const props = withDefaults(
	defineProps<{
		collection?: string | undefined;
		fields?: Field[] | undefined;
		initialValues?: FieldValues | null;
		modelValue?: FieldValues | null;
		loading?: boolean | undefined;
		batchMode?: boolean | undefined;
		primaryKey?: string | number | undefined;
		disabled?: boolean | undefined;
		nonEditable?: boolean | undefined;
		validationErrors?: ValidationError[];
		autofocus?: boolean | undefined;
		group?: string | null;
		badge?: string | undefined;
		showValidationErrors?: boolean;
		showNoVisibleFields?: boolean;
		/* Enable the raw editor toggler on fields */
		rawEditorEnabled?: boolean | undefined;
		disabledMenuOptions?: MenuOptions[] | undefined;
		disabledMenu?: boolean | undefined;
		direction?: string | undefined;
		showDivider?: boolean | undefined;
		/** The "no visible fields" info without icon, aligned to the start (v-form `inline`, spec 020) */
		inline?: boolean | undefined;
		version?: ContentVersion | null;
		comparison?: ComparisonContext | undefined;
	}>(),
	{
		collection: undefined,
		fields: undefined,
		initialValues: null,
		modelValue: null,
		primaryKey: undefined,
		validationErrors: () => [],
		group: null,
		badge: undefined,
		showValidationErrors: true,
		showNoVisibleFields: true,
		disabledMenuOptions: undefined,
		direction: undefined,
		version: null,
		comparison: undefined,
	},
);

const emit = defineEmits(['update:modelValue']);

const fieldsStore = useFieldsStore();

const parentComparison = inject(FORM_COMPARISON, undefined);

const comparison = computed(() => props.comparison ?? (props.group !== null ? parentComparison?.value : undefined));

provide(FORM_COMPARISON, comparison);

const fieldDefinitions = computed<Field[]>(() => {
	if (props.collection) {
		return fieldsStore.getFieldsForCollection(props.collection);
	}

	if (props.fields) {
		return props.fields;
	}

	return [];
});

const fieldDefinitionsMap = computed<Record<string, Field | undefined>>(() => {
	return Object.fromEntries(fieldDefinitions.value.map((field) => [field.field, field]));
});

const values = computed(() => {
	return Object.assign(
		{},
		selectiveClone(props.initialValues, fieldDefinitionsMap.value),
		selectiveClone(props.modelValue, fieldDefinitionsMap.value),
	);
});

const el = ref<HTMLElement>();

const { width } = useElementSize(el);

// 770 (drawer width) - 2 * 22 (content-padding) = 726
const withFill = computed(() => width.value > 726);

const formFieldEls = ref<Record<string, any>>({});

onBeforeUpdate(() => {
	formFieldEls.value = {};
});

const {
	fields: finalFields,
	fieldNames,
	fieldsMap,
	fieldsForGroup,
	isDisabled,
	getFieldsForGroup,
	isFieldVisible,
} = useForm();

const { toggleBatchField, batchActiveFields } = useBatch();
const { toggleRawField, rawActiveFields } = useRawEditor();

const firstEditableFieldIndex = computed(() => {
	for (const [index, fieldName] of fieldNames.value.entries()) {
		const field = fieldsMap.value[fieldName];

		if (field?.meta && !field.meta?.readonly && isFieldVisible(field)) {
			return index;
		}
	}

	return null;
});

const noVisibleFields = computed(() => {
	return Object.keys(fieldsMap.value).every((fieldKey) => {
		return !isFieldVisible(fieldsMap.value[fieldKey]!);
	});
});

// Backoffice: FR-084, the screen asks `unsaved_changes` when the form has edits (use-edits-guard.ts).
const hasEdits = computed(() => !isEmpty(props.modelValue));

defineExpose({ hasEdits });

watch(
	() => props.validationErrors,
	(newVal, oldVal) => {
		if (!props.showValidationErrors) return;
		if (isEqual(newVal, oldVal)) return;
		if (newVal?.length > 0) el?.value?.scrollIntoView({ behavior: scrollBehavior() });
	},
);

provide('values', values);

function useForm() {
	const fieldsStore = useFieldsStore();
	const fields = ref<Field[]>(getFields());

	watch(
		() => props.fields,
		() => {
			const newVal = getFields();

			if (!isEqual(fields.value, newVal)) {
				fields.value = newVal;
			}
		},
	);

	const defaultValues = getDefaultValuesFromFields(fields);

	const formFields = getFormFields(fields);

	const fieldsWithConditions = computed(() => {
		const valuesWithDefaults = Object.assign({}, defaultValues.value, values.value);

		let fields = formFields.value.map((field) =>
			applyConditions(valuesWithDefaults, setPrimaryKeyReadonly(field), props.version),
		);

		fields = pushGroupOptionsDown(fields);
		updateSystemDivider(fields, isFieldVisible);
		updateFieldWidths(fields, isFieldVisible);

		return fields;
	});

	const fieldsMap = computed<Record<string, TFormField | undefined>>(() => {
		return Object.fromEntries(fieldsWithConditions.value.map((field) => [field.field, field as TFormField]));
	});

	const fieldNames = computed(() => {
		const fieldsInGroup = formFields.value.filter(
			(field: Field) => field.meta?.group === props.group || (props.group === null && isNil(field.meta?.group)),
		);

		return fieldsInGroup.map((field) => field.field);
	});

	const fieldsForGroup = computed(() => {
		return fieldNames.value.map((name) => getFieldsForGroup(fieldsMap.value[name]?.meta?.field || null));
	});

	return { fields, fieldNames, fieldsMap, fieldsForGroup, isDisabled, getFieldsForGroup, isFieldVisible };

	function isDisabled(field: TFormField | undefined) {
		if (!field) return true;
		const meta = fieldsMap.value?.[field.field]?.meta;
		return (
			props.loading ||
			props.disabled === true ||
			meta?.readonly === true ||
			field.schema?.is_generated === true ||
			(props.batchMode && batchActiveFields.value.includes(field.field) === false)
		);
	}

	function getFieldsForGroup(group: null | string, passed: string[] = []): Field[] {
		const fieldsInGroup = fieldsWithConditions.value.filter((field) => {
			const meta = fieldsMap.value?.[field.field]?.meta;
			return meta?.group === group || (group === null && isNil(meta));
		});

		for (const field of fieldsInGroup) {
			const meta = fieldsMap.value?.[field.field]?.meta;

			if (meta?.special?.includes('group') && !passed.includes(meta!.field!)) {
				passed.push(meta!.field!);
				fieldsInGroup.push(...getFieldsForGroup(meta!.field!, passed));
			}
		}

		return fieldsInGroup;
	}

	function getFields(): Field[] {
		if (props.collection) {
			return fieldsStore.getFieldsForCollection(props.collection);
		}

		if (props.fields) {
			return props.fields;
		}

		throw new Error('[BoForm]: You need to pass either the collection or fields prop.');
	}

	function setPrimaryKeyReadonly(field: Field) {
		if (
			field.schema?.is_primary_key === true &&
			props.primaryKey !== '+' &&
			(field.schema?.has_auto_increment === true || field.meta?.special?.includes('uuid'))
		) {
			const fieldClone = cloneDeep(field) as any;
			if (!fieldClone.meta) fieldClone.meta = {};
			fieldClone.meta.readonly = true;
			return fieldClone;
		}

		return field;
	}

	function isFieldVisible(field: Field | TFormField): boolean {
		if (comparison.value?.showDifferencesOnly) {
			return !!comparison.value.fields.has(field.field);
		}

		return (
			field.meta?.hidden !== true ||
			!!comparison.value?.fields?.has(field.field) ||
			!!comparison.value?.revisionFields?.has(field.field)
		);
	}
}

function setValue(fieldKey: string, value: any, opts?: { force?: boolean }) {
	const field = fieldsMap.value[fieldKey];

	if (opts?.force !== true && (!field || isDisabled(field))) return;

	const edits = props.modelValue ? selectiveClone(props.modelValue, fieldDefinitionsMap.value) : {};
	edits[fieldKey] = value;
	emit('update:modelValue', edits);
}

function apply(updates: { [field: string]: any }) {
	const updatableKeys = props.batchMode
		? Object.keys(updates)
		: Object.keys(updates).filter((key) => {
				const field = fieldsMap.value[key];
				if (!field) return false;
				return (
					(updates['$type'] === 'created' && field.meta?.readonly) || field.schema?.is_primary_key || !isDisabled(field)
				);
			});

	if (!isNil(props.group)) {
		const groupFields = getFieldsForGroup(props.group)
			.filter((field) => !field.schema?.is_primary_key && !isDisabled(field as TFormField))
			.map((field) => field.field);

		emit('update:modelValue', assign({}, omit(props.modelValue, groupFields), pickKeepMeta(updates, updatableKeys)));
	} else {
		// Preserve existing values for fields that belong to groups
		const updatableGroupKeys = Object.keys(updates).filter((key) => {
			if (key.startsWith('$')) return false;
			const field = fieldsMap.value[key];
			return !isNil(field?.meta?.group) && props.modelValue && key in props.modelValue;
		});

		// Preserve readonly field values when unchanged
		const preservedReadonlyKeys = Object.keys(updates).filter((key) => {
			if (key.startsWith('$') || updatableKeys.includes(key)) return false;
			const field = fieldsMap.value[key];
			return field && isDisabled(field) && isEqual(props.modelValue?.[key], updates[key]);
		});

		emit(
			'update:modelValue',
			pickKeepMeta(assign({}, props.modelValue, updates), [
				...updatableKeys,
				...updatableGroupKeys,
				...preservedReadonlyKeys,
			]),
		);
	}
}

function pickKeepMeta(obj: Record<string, any>, keys: string[]) {
	return Object.entries(obj).reduce<Record<string, any>>((result, [key, value]) => {
		if (keys.includes(key) || key.startsWith('$')) result[key] = value;
		return result;
	}, {});
}

function unsetValue(field: TFormField | undefined) {
	if (!field) return;
	if (!props.batchMode && isDisabled(field)) return;

	if (field.field in (props.modelValue || {})) {
		const newEdits = { ...props.modelValue };
		delete newEdits[field.field];
		emit('update:modelValue', newEdits);
	}
}

function useBatch() {
	const batchActiveFields = ref<string[]>([]);

	watch(
		() => props.modelValue,
		(newModelValue) => {
			if (!props.batchMode || isEmpty(newModelValue) || !isEmpty(batchActiveFields.value)) return;

			batchActiveFields.value = Object.keys(newModelValue!);
		},
		{ immediate: true },
	);

	return { batchActiveFields, toggleBatchField };

	function toggleBatchField(field: TFormField | undefined) {
		if (!field) return;

		if (batchActiveFields.value.includes(field.field)) {
			batchActiveFields.value = batchActiveFields.value.filter((fieldKey) => fieldKey !== field.field);

			unsetValue(field);
		} else {
			batchActiveFields.value = [...batchActiveFields.value, field.field];
			setValue(field.field, field.schema?.default_value);
		}
	}
}

// Backoffice: no smooth scrolling when the user asks for reduced motion.
function scrollBehavior(): 'auto' | 'smooth' {
	return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function scrollToField(fieldKey: string) {
	const { field } = extractFieldFromFunction(fieldKey);
	if (!formFieldEls.value[field]) return;
	const element: HTMLElement = formFieldEls.value[field].$el ?? formFieldEls.value[field];
	element.scrollIntoView({ behavior: scrollBehavior() });

	// Backoffice: ValidationErrors recipe, the field link also moves focus to the field.
	element
		.querySelector<HTMLElement>(
			'[data-interface] :is(input, textarea, select, button, [tabindex]:not([tabindex="-1"]))',
		)
		?.focus({ preventScroll: true });
}

function useRawEditor() {
	const rawActiveFields = ref(new Set<string>());

	return { rawActiveFields, toggleRawField };

	function toggleRawField(field: TFormField | undefined) {
		if (!field) return;

		if (rawActiveFields.value.has(field.field)) {
			rawActiveFields.value.delete(field.field);
		} else {
			rawActiveFields.value.add(field.field);
		}
	}
}

function isGroupFieldVisible(field: TFormField, groupFields: Field[]): boolean {
	if (comparison.value?.showDifferencesOnly) {
		return groupFields.some((f) => comparison.value!.fields.has(f.field));
	}

	return isFieldVisible(field);
}

// Backoffice: recipe Q-10 highlight of a differing field (Directus: `indicator-active`; groups are `hidden`).
const COMPARISON_DIFF =
	'rounded-sm bg-warning-50 ring-8 ring-warning-50 dark:bg-warning-500/15 dark:ring-warning-500/15';

// Backoffice: the group interface of the stored field (before get-form-fields replaces a null interface).
function getGroupInterface(fieldName: string) {
	const id = fieldDefinitionsMap.value[fieldName]?.meta?.interface;
	return id ? (getInterface(id) ?? null) : null;
}
</script>

<template>
	<div
		ref="el"
		class="@container grid gap-x-6 gap-y-5"
		:class="withFill ? 'grid-cols-[minmax(0,21.375rem)_minmax(0,21.375rem)_1fr]' : 'grid-cols-2'"
		:aria-busy="loading ? 'true' : undefined"
	>
		<ValidationErrors
			v-if="showValidationErrors && validationErrors.length > 0"
			:validation-errors="validationErrors"
			:fields="finalFields"
			@scroll-to-field="scrollToField"
		/>
		<div
			v-if="noVisibleFields && showNoVisibleFields && !loading"
			class="col-span-full flex flex-col rounded-2xl border border-gray-200 bg-white px-5 py-7 xl:px-10 xl:py-12 dark:border-gray-800 dark:bg-white/[0.03]"
			:class="{ 'items-center text-center': !inline }"
		>
			<BoIcon v-if="!inline" name="search" size="lg" class="mb-3 text-gray-500 dark:text-gray-400" />
			<p class="text-base font-medium text-gray-800 dark:text-white/90">{{ $t('no_visible_fields') }}</p>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ $t('no_visible_fields_copy') }}</p>
		</div>
		<template v-for="(fieldName, index) in fieldNames" :key="fieldName">
			<template v-if="fieldsMap[fieldName]">
				<template v-if="fieldsMap[fieldName]!.meta?.special?.includes('group')">
					<component
						:is="getGroupInterface(fieldName)!.component"
						v-if="
							getGroupInterface(fieldName) && isGroupFieldVisible(fieldsMap[fieldName]!, fieldsForGroup[index] || [])
						"
						:ref="
							(el: any) => {
								formFieldEls[fieldName] = el;
							}
						"
						:class="WIDTH_CLASSES[fieldsMap[fieldName]!.meta?.width || 'full']"
						:field="fieldsMap[fieldName]"
						:fields="fieldsForGroup[index] || []"
						:values="modelValue || {}"
						:initial-values="initialValues || {}"
						:disabled="disabled || nonEditable"
						:non-editable="nonEditable"
						:batch-mode="batchMode"
						:batch-active-fields="batchActiveFields"
						:primary-key="primaryKey"
						:loading="loading"
						:validation-errors="validationErrors"
						:badge="badge"
						:raw-editor-enabled="rawEditorEnabled"
						:direction="direction"
						:version
						v-bind="fieldsMap[fieldName]!.meta?.options || {}"
						@apply="apply"
					/>
				</template>

				<div
					v-else-if="fieldName === '$system_divider'"
					v-show="isFieldVisible(fieldsMap[fieldName]!)"
					role="separator"
					class="col-span-full border-t border-gray-200 dark:border-gray-800"
				/>

				<FormField
					v-else-if="isFieldVisible(fieldsMap[fieldName]!)"
					:ref="
						(el: any) => {
							formFieldEls[fieldName] = el;
						}
					"
					:class="comparison?.fields.has(fieldName) ? COMPARISON_DIFF : undefined"
					:field="fieldsMap[fieldName]!"
					:comparison="comparison"
					:comparison-active="comparison?.selectedFields.includes(fieldName)"
					:autofocus="index === firstEditableFieldIndex && autofocus"
					:model-value="(values || {})[fieldName]"
					:initial-value="(initialValues || {})[fieldName]"
					:disabled="isDisabled(fieldsMap[fieldName]!) || nonEditable"
					:non-editable="nonEditable"
					:batch-mode="batchMode"
					:batch-active="batchActiveFields.includes(fieldName)"
					:primary-key="primaryKey"
					:loading="loading"
					:validation-error="
						validationErrors.find(
							(err) =>
								err.collection === fieldsMap[fieldName]!.collection &&
								(err.field === fieldName || err.field.endsWith(`(${fieldName})`)),
						)
					"
					:badge="badge"
					:raw-editor-enabled="rawEditorEnabled"
					:raw-editor-active="rawActiveFields.has(fieldName)"
					:disabled-menu-options="disabledMenuOptions"
					:disabled-menu="disabledMenu"
					:direction="direction"
					:version
					@update:model-value="setValue(fieldName, $event)"
					@set-field-value="setValue($event.field, $event.value, { force: true })"
					@unset="unsetValue(fieldsMap[fieldName]!)"
					@toggle-batch="toggleBatchField(fieldsMap[fieldName]!)"
					@toggle-raw="toggleRawField(fieldsMap[fieldName]!)"
				/>
			</template>
		</template>
		<div
			v-if="showDivider && !noVisibleFields"
			aria-hidden="true"
			class="col-span-full border-t border-gray-200 dark:border-gray-800"
		/>
	</div>
</template>
