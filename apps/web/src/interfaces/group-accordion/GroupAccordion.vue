<!-- Ported from directus/app/src/interfaces/group-accordion/group-accordion.vue -->
<script setup lang="ts">
// Backoffice: VItemGroup + accordion-section.vue become BoAccordion (Tier 3 Accordion recipe); the section logic
// (fieldsInSection, edited, validationMessage) lives here per field; Shift+click toggle-all is in BoAccordion. The
// comparison indicator and collab context are removed (D-54, D-55). Group interfaces are not wrapped in FormField,
// so there is no FORM_FIELD_A11Y to link: each section header is its own labelled button.
import type { ContentVersion, Field, ValidationError } from '@directus/types';
import { isEqual, merge } from 'lodash-es';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoAccordion from '../../components/BoAccordion.vue';
import BoChip from '../../components/BoChip.vue';
import BoIcon from '../../components/BoIcon.vue';
import BoTooltip from '../../components/BoTooltip.vue';
import BoForm from '../../components/form/BoForm.vue';
import { getFieldsInGroup } from '../../components/form/utils/get-fields-in-group.ts';

const props = withDefaults(
	defineProps<{
		field: Field;
		fields: Field[];
		values: Record<string, unknown>;
		initialValues: Record<string, unknown>;
		disabled?: boolean | undefined;
		nonEditable?: boolean | undefined;
		batchMode?: boolean | undefined;
		batchActiveFields?: string[];
		primaryKey: string | number;
		loading?: boolean | undefined;
		validationErrors?: ValidationError[];
		badge?: string | undefined;
		rawEditorEnabled?: boolean | undefined;
		accordionMode?: boolean | undefined;
		start?: 'opened' | 'closed' | 'first' | undefined;
		direction?: string | undefined;
		version?: ContentVersion | null | undefined;
	}>(),
	{
		batchActiveFields: () => [],
		validationErrors: () => [],
		accordionMode: true,
		start: 'closed',
	},
);

defineEmits<{
	(e: 'apply', value: Record<string, unknown>): void;
}>();

const { t } = useI18n();

const selection = ref<string[]>([]);
const { groupFields, groupValues } = useComputedGroup();

watch(
	() => props.start,
	(start) => {
		if (start === 'opened') {
			selection.value = groupFields.value.map((field) => field.field);
		}

		if (start === 'first') {
			// Backoffice: an empty group opens nothing (Directus reads groupFields[0]! and throws).
			selection.value = groupFields.value.slice(0, 1).map((field) => field.field);
		}
	},
	{ immediate: true },
);

watch(
	() => props.validationErrors,
	(newVal, oldVal) => {
		if (!props.validationErrors) return;
		if (isEqual(newVal, oldVal)) return;

		const includedFieldsWithErrors = props.validationErrors.filter((validationError) =>
			groupFields.value.find((rootField) => rootField.field === validationError.field),
		);

		if (includedFieldsWithErrors.length > 0)
			selection.value = [(includedFieldsWithErrors as [ValidationError])[0].field];
	},
);

function useComputedGroup() {
	const groupFields = ref<Field[]>(limitFields());
	const groupValues = ref<Record<string, any>>(props.values);

	watch(
		() => props.fields,
		() => {
			const newVal = limitFields();

			if (!isEqual(groupFields.value, newVal)) {
				groupFields.value = newVal;
			}
		},
	);

	watch(
		() => props.values,
		(newVal) => {
			if (!isEqual(groupValues.value, newVal)) {
				groupValues.value = newVal;
			}
		},
	);

	return { groupFields, groupValues };

	function limitFields(): Field[] {
		return props.fields.filter((field) => field.meta?.group === props.field.meta?.field);
	}
}

// accordion-section.vue

function fieldsInSection(field: Field) {
	const fields: Field[] = [merge({}, field, { hideLabel: true })];

	if (field.meta?.special?.includes('group')) {
		fields.push(...getFieldsInGroup(field.field, props.fields));
	}

	return fields;
}

function isEdited(field: Field) {
	if (!groupValues.value) return false;

	const editedFields = Object.keys(groupValues.value);
	return fieldsInSection(field).some((sectionField) => editedFields.includes(sectionField.field));
}

function validationMessage(field: Field) {
	const validationError = props.validationErrors.find((error) => error.field === field.field);
	if (validationError === undefined) return;

	if (validationError.code === 'RECORD_NOT_UNIQUE') {
		return t('validationError.unique');
	} else {
		return t(`validationError.${validationError.type}`, validationError as unknown as Record<string, unknown>);
	}
}

// Backoffice: the form direction typed for BoAccordion.
const dir = computed(() => props.direction as 'ltr' | 'rtl' | undefined);

function fieldOf(name: string) {
	return groupFields.value.find((field) => field.field === name)!;
}
</script>

<template>
	<BoAccordion
		v-model="selection"
		:items="groupFields.filter((f) => !f.meta?.hidden).map((f) => ({ value: f.field, label: f.name }))"
		:multiple="accordionMode === false"
		:dir="dir"
		data-group-accordion
	>
		<template #trigger="{ item, open }">
			<BoTooltip v-if="isEdited(fieldOf(item.value))" :text="$t('edited')">
				<span class="inline-flex" data-edited>
					<span class="h-1.5 w-1.5 rounded-full bg-gray-500 dark:bg-gray-400" aria-hidden="true" />
					<span class="sr-only">{{ $t('edited') }}</span>
				</span>
			</BoTooltip>
			<span class="min-w-0 truncate">{{ item.label }}</span>
			<template v-if="fieldOf(item.value).meta?.required === true">
				<span class="text-error-600 dark:text-error-400" aria-hidden="true">*</span>
				<span class="sr-only">{{ $t('required') }}</span>
			</template>
			<BoChip v-if="badge" :text="badge" />
			<BoTooltip v-if="!open && validationMessage(fieldOf(item.value))" :text="validationMessage(fieldOf(item.value))!">
				<span class="inline-flex text-error-600 dark:text-error-400" data-error>
					<BoIcon name="error" size="sm" />
					<span class="sr-only">{{ validationMessage(fieldOf(item.value)) }}</span>
				</span>
			</BoTooltip>
		</template>

		<template #content="{ item }">
			<BoForm
				:initial-values="initialValues"
				:fields="fieldsInSection(fieldOf(item.value))"
				:model-value="groupValues"
				:primary-key="primaryKey"
				:group="field.meta!.field"
				:validation-errors="validationErrors"
				:loading="loading"
				:batch-mode="batchMode"
				:disabled="disabled"
				:non-editable="nonEditable"
				:direction="direction"
				:version="version ?? null"
				:show-no-visible-fields="false"
				:show-validation-errors="false"
				@update:model-value="$emit('apply', $event)"
			/>
		</template>
	</BoAccordion>
</template>
