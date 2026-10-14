<!-- Ported from directus/app/src/components/v-form/components/form-field-raw-editor.vue -->
<script setup lang="ts">
// Backoffice: BoDialog (Modal recipe) instead of v-dialog + v-card; input-code comes from the registry and, until it
// is registered, objects are edited in system-raw-editor as multi-line text (the cast below parses the JSON).
// Closing the dialog (Esc, overlay) cancels like the Directus `@esc`.
import type { Field } from '@directus/types';
import { isValidJSON, parseJSON } from '@directus/utils';
import { isNil } from 'lodash-es';
import { computed, ref, watch } from 'vue';
import { getInterface } from '../../interfaces/index.ts';
import SystemRawEditor from '../../interfaces/_system/system-raw-editor/SystemRawEditor.vue';
import BoButton from '../BoButton.vue';
import BoDialog from '../BoDialog.vue';
import type { FormField } from './types.ts';
import { getJSType } from './utils/get-js-type.ts';
import { getStringifiedValue } from './utils/get-stringified-value.ts';

const props = withDefaults(
	defineProps<{
		field: FormField;
		showModal?: boolean;
		disabled?: boolean;
		currentValue?: unknown | undefined;
	}>(),
	{
		showModal: false,
		disabled: false,
	},
);

const emit = defineEmits(['cancel', 'setRawValue']);
const internalValue = ref();

const type = computed(() => {
	return getJSType(props.field as Field);
});

const inputCode = computed(() => getInterface('input-code')?.component ?? null);

watch(
	() => props.showModal,
	(isActive) => {
		if (isActive) {
			if (isNil(props.currentValue)) {
				return;
			}

			internalValue.value = getStringifiedValue(props.currentValue, type.value === 'object');
		}
	},
);

const setRawValue = () => {
	switch (type.value) {
		case 'string':
			emit('setRawValue', internalValue.value);
			break;
		case 'number':
			emit('setRawValue', Number(internalValue.value));
			break;
		case 'boolean':
			emit('setRawValue', internalValue.value === 'true');
			break;
		case 'object':
			emit('setRawValue', isValidJSON(internalValue.value) ? parseJSON(internalValue.value) : internalValue.value);
			break;
		default:
			emit('setRawValue', internalValue.value);
			break;
	}
};

function onOpenChange(open: boolean) {
	if (!open) emit('cancel');
}
</script>

<template>
	<BoDialog
		:open="showModal"
		:title="disabled ? $t('view_raw_value') : $t('edit_raw_value')"
		@update:open="onOpenChange"
	>
		<component
			:is="inputCode"
			v-if="type === 'object' && inputCode"
			:value="internalValue"
			:disabled="disabled"
			:line-number="false"
			:alt-options="{ gutters: false }"
			:placeholder="$t('enter_raw_value')"
			language="json"
			@input="internalValue = $event"
		/>
		<SystemRawEditor
			v-else
			:value="internalValue"
			:type="type === 'string' || type === 'object' ? 'text' : type"
			:disabled="disabled"
			language="plaintext"
			:placeholder="$t('enter_raw_value')"
			@input="internalValue = $event"
		/>
		<template #actions>
			<BoButton variant="secondary" @click="$emit('cancel')">{{ $t('cancel') }}</BoButton>
			<BoButton @click.prevent="setRawValue">{{ $t('done') }}</BoButton>
		</template>
	</BoDialog>
</template>
