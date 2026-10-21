<!-- Ported from directus/app/src/components/v-form/v-form.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): v-form on BoForm (the interfaces come from the registry, extension ones
// included). `collabContext` is accepted and ignored: no collaboration (D-141).
import type { ContentVersion, Field, ValidationError } from '@directus/types';
import { computed } from 'vue';
import BoForm from '../../components/form/BoForm.vue';
import type { MenuOptions } from '../../components/form/FormFieldMenu.vue';
import type { ComparisonContext, FieldValues } from '../../components/form/types.ts';

const props = withDefaults(
	defineProps<{
		collection?: string | undefined;
		fields?: Field[] | undefined;
		initialValues?: FieldValues | null;
		modelValue?: FieldValues | null;
		loading?: boolean;
		batchMode?: boolean;
		primaryKey?: string | number | undefined;
		disabled?: boolean;
		nonEditable?: boolean;
		validationErrors?: ValidationError[];
		autofocus?: boolean;
		group?: string | null;
		badge?: string | undefined;
		showValidationErrors?: boolean;
		showNoVisibleFields?: boolean;
		/* Enable the raw editor toggler on fields */
		rawEditorEnabled?: boolean;
		disabledMenuOptions?: MenuOptions[] | undefined;
		disabledMenu?: boolean;
		direction?: string | undefined;
		showDivider?: boolean;
		inline?: boolean;
		version?: ContentVersion | null;
		comparison?: ComparisonContext | undefined;
		collabContext?: Record<string, any> | undefined;
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
		direction: undefined,
		disabledMenuOptions: undefined,
		version: null,
		comparison: undefined,
		collabContext: undefined,
	},
);

defineEmits(['update:modelValue']);

const formProps = computed(() => {
	const { collabContext: _ignored, ...rest } = props;
	return rest;
});
</script>

<template>
	<BoForm class="v-form" v-bind="formProps" @update:model-value="$emit('update:modelValue', $event)" />
</template>
