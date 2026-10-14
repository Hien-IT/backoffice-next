<!-- Ported from directus/app/src/interfaces/group-detail/group-detail.vue -->
<script setup lang="ts">
// Backoffice: VDetail + VDivider become BoDetail (Tier 3 Detail recipe); `headerColor` has no default: without it
// BoDetail uses the theme title color (Directus: var(--theme--foreground-accent)). The comparison indicator and collab
// context are removed (D-54, D-55). Not wrapped in FormField, so no FORM_FIELD_A11Y: the header button is labelled
// by the group name.
import formatTitle from '@directus/format-title';
import type { ContentVersion, Field, ValidationError } from '@directus/types';
import { isEqual } from 'lodash-es';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoDetail from '../../components/BoDetail.vue';
import BoIcon from '../../components/BoIcon.vue';
import BoTooltip from '../../components/BoTooltip.vue';
import BoForm from '../../components/form/BoForm.vue';

const props = withDefaults(
	defineProps<{
		field: Field;
		fields: Field[];
		nonEditable?: boolean | undefined;
		primaryKey: number | string;
		values: Record<string, unknown>;
		initialValues: Record<string, unknown>;
		disabled?: boolean | undefined;
		batchMode?: boolean | undefined;
		batchActiveFields?: string[];
		loading?: boolean | undefined;
		validationErrors?: ValidationError[];
		badge?: string | undefined;
		start?: 'open' | 'closed' | undefined;
		headerIcon?: string | undefined;
		headerColor?: string | undefined;
		direction?: string | undefined;
		version?: ContentVersion | null | undefined;
	}>(),
	{
		batchActiveFields: () => [],
		validationErrors: () => [],
		start: 'open',
	},
);

defineEmits(['apply']);

const { t } = useI18n();

const detailOpen = ref(props.start === 'open');

// In case that conditions change the start prop after the group already got rendered
// caused by the async loading of data to run the conditions against
watch(
	() => props.loading,
	(newVal) => {
		if (!newVal) detailOpen.value = props.start === 'open';
	},
	{ once: true },
);

const edited = computed(() => {
	if (!props.values) return false;

	const editedFields = Object.keys(props.values);
	return props.fields.some((field) => editedFields.includes(field.field));
});

const validationMessages = computed(() => {
	if (!props.validationErrors) return;

	const fields = props.fields.map((field) => field.field);

	const errors = props.validationErrors.reduce((acc, validationError) => {
		if (fields.includes(validationError.field) === false) return acc;

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

	if (errors.length === 0) return [];

	return errors;
});

watch(validationMessages, (newVal, oldVal) => {
	if (!validationMessages.value) return;
	if (isEqual(newVal, oldVal)) return;
	detailOpen.value = validationMessages.value.length > 0;
});
</script>

<template>
	<BoDetail
		v-model="detailOpen"
		:title="field.name"
		:icon="headerIcon"
		:color="headerColor"
		:edited="edited && !detailOpen"
		data-group-detail
	>
		<template #badge>
			<BoTooltip v-if="!detailOpen && validationMessages!.length > 0" :text="validationMessages!.join('\n')">
				<span class="inline-flex text-error-600 dark:text-error-400" data-error>
					<BoIcon name="error" size="sm" />
					<span class="sr-only">{{ validationMessages!.join('. ') }}</span>
				</span>
			</BoTooltip>
		</template>

		<BoForm
			:initial-values="initialValues"
			:fields="fields"
			:model-value="values"
			:primary-key="primaryKey"
			:group="field.meta?.field ?? null"
			:validation-errors="validationErrors"
			:loading="loading"
			:batch-mode="batchMode"
			:non-editable="nonEditable"
			:disabled="disabled"
			:badge="badge"
			:direction="direction"
			:show-no-visible-fields="false"
			:show-validation-errors="false"
			:version="version ?? null"
			@update:model-value="$emit('apply', $event)"
		/>
	</BoDetail>
</template>
