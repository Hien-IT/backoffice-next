<!-- Ported from directus/app/src/interfaces/group-raw/group-raw.vue -->
<script setup lang="ts">
// Backoffice: comparison and collab context removed (D-54, D-55).
import type { ContentVersion, Field, ValidationError } from '@directus/types';
import BoForm from '../../components/form/BoForm.vue';

withDefaults(
	defineProps<{
		field: Field;
		fields: Field[];
		values: Record<string, unknown>;
		initialValues: Record<string, unknown>;
		primaryKey: number | string;
		disabled?: boolean | undefined;
		nonEditable?: boolean | undefined;
		batchMode?: boolean | undefined;
		batchActiveFields?: string[];
		loading?: boolean | undefined;
		validationErrors?: ValidationError[];
		badge?: string | undefined;
		rawEditorEnabled?: boolean | undefined;
		direction?: string | undefined;
		version?: ContentVersion | null | undefined;
	}>(),
	{
		batchActiveFields: () => [],
		validationErrors: () => [],
	},
);

defineEmits(['apply']);
</script>

<template>
	<div data-group-raw>
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
			:raw-editor-enabled="rawEditorEnabled"
			:direction="direction"
			:version="version ?? null"
			:show-no-visible-fields="false"
			:show-validation-errors="false"
			@update:model-value="$emit('apply', $event)"
		/>
	</div>
</template>
