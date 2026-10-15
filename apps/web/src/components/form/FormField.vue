<!-- Ported from directus/app/src/components/v-form/components/form-field.vue -->
<script setup lang="ts">
// Backoffice: template per the form grid (layout-patterns §8) and the Field label row recipe; the collab context is
// removed (D-54). Comparison mode (spec 014 FR-072, lifts D-55) shows the label and passes the context on. The note is markdown sanitized by utils/markdown.ts, links in
// a new tab as v-md `target: '_blank'`. Ids for the label, note and error are provided to the interface (FR-094).
import type { ContentVersion, ValidationError } from '@directus/types';
import { parseJSON } from '@directus/utils';
import { isEqual } from 'lodash-es';
import { computed, provide, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { md } from '../../utils/markdown.ts';
import BoIcon from '../BoIcon.vue';
import BoTooltip from '../BoTooltip.vue';
import { useClipboard } from './composables/use-clipboard.ts';
import FormFieldInterface from './FormFieldInterface.vue';
import FormFieldLabel from './FormFieldLabel.vue';
import FormFieldMenu, { type MenuOptions } from './FormFieldMenu.vue';
import FormFieldRawEditor from './FormFieldRawEditor.vue';
import { type ComparisonContext, FORM_FIELD_A11Y, type FormField, WIDTH_CLASSES } from './types.ts';
import { formatFieldFunction } from './utils/format-field-function.ts';

const props = withDefaults(
	defineProps<{
		field: FormField;
		batchMode?: boolean | undefined;
		batchActive?: boolean | undefined;
		disabled?: boolean | undefined;
		nonEditable?: boolean | undefined;
		modelValue?: any | undefined;
		initialValue?: any | undefined;
		primaryKey?: string | number | undefined;
		loading?: boolean | undefined;
		validationError?: ValidationError | undefined;
		autofocus?: boolean | undefined;
		badge?: string | undefined;
		rawEditorEnabled?: boolean | undefined;
		rawEditorActive?: boolean | undefined;
		disabledMenuOptions?: MenuOptions[] | undefined;
		disabledMenu?: boolean | undefined;
		direction?: string | undefined;
		version?: ContentVersion | null | undefined;
		comparison?: ComparisonContext | undefined;
		comparisonActive?: boolean | undefined;
	}>(),
	{
		modelValue: undefined,
		initialValue: undefined,
		primaryKey: undefined,
		validationError: undefined,
		badge: undefined,
		direction: undefined,
		comparison: undefined,
		comparisonActive: false,
	},
);

const emit = defineEmits(['toggle-batch', 'toggle-raw', 'unset', 'update:modelValue', 'setFieldValue']);

const { t } = useI18n();

const isDisabled = computed(() => {
	if (props.disabled) return true;
	if (props.field?.meta?.readonly === true) return true;
	if (props.batchMode && props.batchActive === false) return true;
	return false;
});

const isNonEditable = computed(() => {
	if (props.nonEditable) return true;
	if (props.field?.meta?.non_editable === true) return true;
	return false;
});

const isLabelHidden = computed(() => {
	if ((props.batchMode || !!props.comparison) && !props.field.meta?.special?.includes('no-data')) return false;
	return props.field.hideLabel;
});

const srOnlyLabel = computed(() => isLabelHidden.value && !props.field.meta?.special?.includes('no-data'));

const { internalValue, isEdited, defaultValue } = useComputedValues();

const { showRaw, copyRaw, pasteRaw, onRawValueSubmit } = useRaw();

const validationMessage = computed(() => {
	if (!props.validationError) return null;

	if (props.validationError.code === 'RECORD_NOT_UNIQUE') {
		return t('validationError.unique');
	} else {
		return t(`validationError.${props.validationError.type}`, props.validationError);
	}
});

const validationPrefix = computed(() => {
	if (!props.validationError) return null;

	if (props.validationError.field.includes('(') && props.validationError.field.includes(')')) {
		return formatFieldFunction(props.field.collection!, props.validationError.field) + ': ';
	}

	return null;
});

const showCustomValidationMessage = computed(() => {
	if (!props.validationError) return false;

	const customValidationMessage = !!props.field.meta?.validation_message;
	const hasCustomValidation = !!props.field.meta?.validation;

	return customValidationMessage && (!hasCustomValidation || props.validationError.code === 'FAILED_VALIDATION');
});

// Backoffice: ids linking the label, note and validation message to the control.
const inputId = useId();
const labelId = `${inputId}-label`;
const noteId = `${inputId}-note`;
const errorId = `${inputId}-error`;

const note = computed(() => {
	if (!props.field.meta?.note) return null;
	// v-md `target: '_blank'`: every link opens a new tab (utils/markdown.ts already does it for other origins).
	return md(props.field.meta.note).replace(/<a (?![^>]*\btarget=)/g, '<a target="_blank" rel="noopener noreferrer" ');
});

provide(
	FORM_FIELD_A11Y,
	computed(() => ({
		inputId,
		labelId,
		describedBy: [note.value && noteId, props.validationError && errorId].filter(Boolean).join(' ') || undefined,
		invalid: !!props.validationError,
	})),
);

function emitValue(value: any) {
	if (
		(isEqual(value, props.initialValue) || (props.initialValue === undefined && isEqual(value, defaultValue.value))) &&
		props.batchMode === false
	) {
		unsetValue();
	} else {
		updateValue(value);
	}
}

function unsetValue() {
	emit('unset', props.field);
}

function updateValue(value: any) {
	emit('update:modelValue', value);
}

function useRaw() {
	const showRaw = ref(false);

	const { copyToClipboard, pasteFromClipboard } = useClipboard();

	function onRawValueSubmit(value: any) {
		showRaw.value = false;
		emitValue(value);
	}

	async function copyRaw() {
		await copyToClipboard(internalValue.value);
	}

	async function pasteRaw() {
		const pastedValue = await pasteFromClipboard();
		if (!pastedValue) return;

		try {
			internalValue.value = parseJSON(pastedValue);
		} catch {
			internalValue.value = pastedValue;
		}

		emitValue(internalValue.value);
	}

	return { showRaw, copyRaw, pasteRaw, onRawValueSubmit };
}

function useComputedValues() {
	const defaultValue = computed<any>(() => props.field?.schema?.default_value);
	const internalValue = ref<any>(getInternalValue());

	const isEdited = computed(
		() => props.modelValue !== undefined && isEqual(props.modelValue, props.initialValue) === false,
	);

	watch(
		() => props.modelValue,
		() => {
			const newVal = getInternalValue();

			if (!isEqual(internalValue.value, newVal)) {
				internalValue.value = newVal;
			}
		},
	);

	return { internalValue, isEdited, defaultValue };

	function getInternalValue(): any {
		if (props.modelValue !== undefined) return props.modelValue;
		if (props.initialValue !== undefined) return props.initialValue;
		return defaultValue.value;
	}
}
</script>

<template>
	<div
		:data-primary-key="primaryKey"
		:data-collection="field.collection"
		:data-field="field.field"
		class="relative min-w-0"
		:class="WIDTH_CLASSES[field.meta?.width || 'full']"
	>
		<FormFieldLabel
			v-if="!isLabelHidden"
			:field="field"
			:batch-mode="batchMode"
			:batch-active="batchActive"
			:edited="isEdited"
			:has-error="!!validationError"
			:badge="badge"
			:raw-editor-enabled="rawEditorEnabled"
			:raw-editor-active="rawEditorActive"
			:loading="loading"
			:input-id="inputId"
			:label-id="labelId"
			:comparison="comparison"
			:comparison-active="comparisonActive"
			@toggle-batch="$emit('toggle-batch', $event)"
			@toggle-raw="$emit('toggle-raw', $event)"
		>
			<template v-if="!disabledMenu" #menu>
				<FormFieldMenu
					:field="field"
					:model-value="internalValue"
					:initial-value="initialValue"
					:restricted="isDisabled"
					:disabled-options="disabledMenuOptions"
					@update:model-value="emitValue($event)"
					@unset="unsetValue"
					@edit-raw="showRaw = true"
					@copy-raw="copyRaw"
					@paste-raw="pasteRaw"
				/>
			</template>
		</FormFieldLabel>

		<div v-else-if="['full', 'fill'].includes(field.meta?.width ?? '') === false" class="mb-1.5 h-6" />

		<!-- Backoffice: a data field whose label is hidden (an accordion section shows its name in the header) keeps
		an accessible name (FR-092, T093: axe "label"); groups and presentation fields (no-data) have nothing to label. -->
		<label v-if="srOnlyLabel" :id="labelId" :for="inputId" class="sr-only">{{ field.name }}</label>

		<FormFieldInterface
			:autofocus="autofocus"
			:model-value="internalValue"
			:field="field"
			:loading="loading"
			:batch-mode="batchMode"
			:batch-active="batchActive"
			:disabled="isDisabled"
			:non-editable="isNonEditable"
			:primary-key="primaryKey"
			:raw-editor-enabled="rawEditorEnabled"
			:raw-editor-active="rawEditorActive"
			:direction="direction"
			:version
			:comparison="comparison"
			:comparison-active="comparisonActive"
			:input-id="inputId"
			:label-id="isLabelHidden && !srOnlyLabel ? undefined : labelId"
			@update:model-value="emitValue($event)"
			@set-field-value="$emit('setFieldValue', $event)"
		/>

		<FormFieldRawEditor
			:show-modal="showRaw"
			:field="field"
			:current-value="internalValue"
			:disabled="isDisabled"
			@cancel="showRaw = false"
			@set-raw-value="onRawValueSubmit"
		/>

		<!-- sanitized by utils/markdown.ts (DOMPurify, FR-065) -->
		<!-- eslint-disable vue/no-v-html -->
		<small
			v-if="note"
			:id="noteId"
			class="mt-1.5 block max-w-[29.25rem] text-theme-xs text-gray-500 dark:text-gray-400 [&_a]:text-brand-500 [&_a]:underline [&_a:hover]:text-brand-600 dark:[&_a]:text-brand-400"
			v-html="note"
		/>
		<!-- eslint-enable vue/no-v-html -->

		<small
			v-if="validationError"
			:id="errorId"
			class="mt-1.5 flex items-center gap-1 text-theme-xs text-error-600 dark:text-error-400"
		>
			<template v-if="showCustomValidationMessage">
				{{ field.meta?.validation_message }}
				<BoTooltip :text="validationMessage ?? ''">
					<button
						type="button"
						class="inline-flex rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-600 dark:focus-visible:outline-error-400"
						:aria-label="validationMessage ?? undefined"
					>
						<BoIcon name="help" size="sm" />
					</button>
				</BoTooltip>
			</template>
			<template v-else>{{ validationPrefix }}{{ validationMessage }}</template>
		</small>
	</div>
</template>
