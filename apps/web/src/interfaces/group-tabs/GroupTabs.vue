<!-- Ported from directus/app/src/interfaces/group-tabs/group-tabs.vue -->
<script setup lang="ts">
// Backoffice: TabsRoot/TabsList + tab-trigger.vue + tab-content.vue become BoTabs (Tier 3 Tabs recipe, underline
// instead of the pill list); the trigger logic (edited, validationMessages) and the content field list are functions
// here. `fillWidth` is the DR `fill` grid class (the group spans every form column). Comparison and collab
// context removed (D-54, D-55). Not wrapped in FormField, so no FORM_FIELD_A11Y: the tab list is named by the group.
import formatTitle from '@directus/format-title';
import type { ContentVersion, Field, ValidationError } from '@directus/types';
import { isEqual, merge } from 'lodash-es';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoChip from '../../components/BoChip.vue';
import BoIcon from '../../components/BoIcon.vue';
import BoTabs from '../../components/BoTabs.vue';
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
		direction?: 'ltr' | 'rtl' | undefined;
		fillWidth?: boolean | undefined;
		// Backoffice: declared so the form's `version` does not fall through to the DOM (the tabs do not use it).
		version?: ContentVersion | null | undefined;
	}>(),
	{
		batchActiveFields: () => [],
		validationErrors: () => [],
		fillWidth: false,
	},
);

defineEmits<{
	(e: 'apply', value: Record<string, unknown>): void;
}>();

const { t } = useI18n();

const { groupFields, groupValues } = useComputedGroup();

const visibleFields = computed(() => groupFields.value.filter((field) => !field.meta?.hidden));

const activeTab = ref(visibleFields.value[0]?.field ?? '');

watch(visibleFields, (newFields) => {
	if (newFields.length > 0 && !newFields.some((f) => f.field === activeTab.value)) {
		activeTab.value = newFields[0]!.field;
	}
});

watch(
	() => props.validationErrors,
	(newVal, oldVal) => {
		if (!props.validationErrors) return;
		if (isEqual(newVal, oldVal)) return;

		const tabWithError = visibleFields.value.find((tabField) => {
			const nested = getFieldsInGroup(tabField.field, props.fields);

			return props.validationErrors!.some(
				(err) => err.field === tabField.field || nested.some((f) => f.field === err.field),
			);
		});

		if (tabWithError) {
			activeTab.value = tabWithError.field;
		}
	},
);

function useComputedGroup() {
	const groupFields = ref<Field[]>(limitFields());
	const groupValues = ref(props.values);

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

function fieldOf(name: string) {
	return visibleFields.value.find((field) => field.field === name)!;
}

// tab-trigger.vue and tab-content.vue

function fieldsInSection(field: Field, hideLabel: boolean) {
	const fields: Field[] = [hideLabel ? merge({}, field, { hideLabel: true }) : field];

	if (field.meta?.special?.includes('group')) {
		fields.push(...getFieldsInGroup(field.field, props.fields));
	}

	return fields;
}

function isEdited(field: Field) {
	if (!groupValues.value) return false;
	const editedFields = Object.keys(groupValues.value);
	return fieldsInSection(field, false).some((sectionField) => editedFields.includes(sectionField.field));
}

function validationMessages(field: Field) {
	const fieldNames = fieldsInSection(field, false).map((sectionField) => sectionField.field);

	const errors = props.validationErrors.reduce((acc, validationError) => {
		if (fieldNames.includes(validationError.field) === false) return acc;

		if (validationError.code === 'RECORD_NOT_UNIQUE') {
			acc.push(`${formatTitle(validationError.field)} ${t('validationError.unique').toLowerCase()}`);
		} else {
			acc.push(
				`${formatTitle(validationError.field)} ${t(
					`validationError.${validationError.type}`,
					validationError as unknown as Record<string, unknown>,
				).toLowerCase()}`,
			);
		}

		return acc;
	}, [] as string[]);

	return errors;
}
</script>

<template>
	<BoTabs
		v-if="visibleFields.length > 0"
		v-model="activeTab"
		:items="visibleFields.map((f) => ({ value: f.field, label: f.name }))"
		:label="field.name"
		:dir="direction"
		:class="{ 'col-span-full!': fillWidth }"
		data-group-tabs
	>
		<template #trigger="{ item }">
			<BoTooltip v-if="isEdited(fieldOf(item.value))" :text="t('edited')">
				<span class="inline-flex" data-edited>
					<span class="h-1.5 w-1.5 rounded-full bg-gray-500 dark:bg-gray-400" aria-hidden="true" />
					<span class="sr-only">{{ t('edited') }}</span>
				</span>
			</BoTooltip>
			<span>{{ item.label }}</span>
			<BoChip v-if="badge" :text="badge" />
			<BoTooltip
				v-if="validationMessages(fieldOf(item.value)).length > 0"
				:text="validationMessages(fieldOf(item.value)).join('\n')"
			>
				<span class="inline-flex text-error-600 dark:text-error-400" data-error>
					<BoIcon name="error" size="sm" />
					<span class="sr-only">{{ validationMessages(fieldOf(item.value)).join('. ') }}</span>
				</span>
			</BoTooltip>
		</template>

		<template #content="{ item }">
			<BoForm
				:initial-values="initialValues"
				:fields="fieldsInSection(fieldOf(item.value), true)"
				:model-value="groupValues"
				:primary-key="primaryKey"
				:group="field.meta?.field ?? ''"
				:validation-errors="validationErrors"
				:loading="loading"
				:batch-mode="batchMode"
				:disabled="disabled"
				:non-editable="nonEditable"
				:direction="direction"
				:show-no-visible-fields="false"
				:show-validation-errors="false"
				@update:model-value="$emit('apply', $event)"
			/>
		</template>
	</BoTabs>
</template>
