<!-- Ported from directus/app/src/components/v-form/components/form-field-interface.vue -->
<script setup lang="ts">
// Backoffice: the interface comes from the registry (getInterface) instead of a global component; comparison mode
// has no UI (D-55), so `comparisonMode` is false; the error boundary, notice and skeleton follow the Tier 1 Alert and
// the form skeleton (layout-patterns §8). `id`/`ariaLabelledby`/`ariaDescribedby` are passed only to the raw editor;
// interfaces read them from the FORM_FIELD_A11Y injection (FormField.vue).
import type { ContentVersion } from '@directus/types';
import { computed } from 'vue';
import { getInterface } from '../../interfaces/index.ts';
import SystemRawEditor from '../../interfaces/_system/system-raw-editor/SystemRawEditor.vue';
import { getDefaultInterfaceForType } from '../../utils/get-default-interface-for-type.ts';
import BoNotice from '../BoNotice.vue';
import ErrorBoundary from '../render/ErrorBoundary.vue';
import type { FormField } from './types.ts';

const props = defineProps<{
	field: FormField;
	batchMode?: boolean | undefined;
	batchActive?: boolean | undefined;
	primaryKey?: string | number | null | undefined;
	modelValue?: string | number | boolean | Record<string, any> | Array<any> | null | undefined;
	loading?: boolean | undefined;
	disabled?: boolean | undefined;
	nonEditable?: boolean | undefined;
	autofocus?: boolean | undefined;
	rawEditorEnabled?: boolean | undefined;
	rawEditorActive?: boolean | undefined;
	direction?: string | undefined;
	version?: ContentVersion | null | undefined;
	inputId?: string | undefined;
	labelId?: string | undefined;
}>();

defineEmits(['update:modelValue', 'setFieldValue']);

const inter = computed(() => getInterface(props.field?.meta?.interface ?? 'input') ?? null);

const interfaceExists = computed(() => !!inter.value);

const component = computed(() => {
	return props.field?.meta?.interface
		? inter.value?.component
		: getInterface(getDefaultInterfaceForType(props.field.type!))?.component;
});

const value = computed(() =>
	props.modelValue === undefined ? (props.field.schema?.default_value ?? null) : props.modelValue,
);

const rawValue = computed(() => value.value as string | object | null);
</script>

<template>
	<div class="relative" data-interface :class="{ 'opacity-50': batchMode && batchActive === false }">
		<div
			v-if="loading && field.hideLoader !== true"
			data-skeleton
			class="absolute inset-0 z-2 h-full min-h-11 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-gray-800"
		/>

		<ErrorBoundary v-if="interfaceExists && !rawEditorActive" :name="`interface-${field.meta?.interface}`">
			<component
				:is="component"
				v-bind="(field.meta && field.meta.options) || {}"
				:autofocus="disabled !== true && autofocus"
				:disabled="disabled"
				:non-editable="nonEditable"
				:loading="loading"
				:value="value"
				:batch-mode="batchMode"
				:batch-active="batchActive"
				:comparison-mode="false"
				:width="(field.meta && field.meta.width) || 'full'"
				:type="field.type"
				:collection="field.collection"
				:field="field.field"
				:field-data="field"
				:primary-key="primaryKey"
				:length="field.schema && field.schema.max_length"
				:direction="direction"
				:raw-editor-enabled="rawEditorEnabled"
				:version
				@input="$emit('update:modelValue', $event)"
				@set-field-value="$emit('setFieldValue', $event)"
			/>

			<template #fallback>
				<BoNotice type="warning">{{ $t('unexpected_error') }}</BoNotice>
			</template>
		</ErrorBoundary>

		<SystemRawEditor
			v-else-if="rawEditorEnabled && rawEditorActive"
			:id="inputId"
			:aria-labelledby="labelId"
			:value="rawValue"
			:type="field.type"
			@input="$emit('update:modelValue', $event)"
		/>

		<BoNotice v-else type="warning">
			{{ $t('interface_not_found', { interface: field.meta && field.meta.interface }) }}
		</BoNotice>
	</div>
</template>
