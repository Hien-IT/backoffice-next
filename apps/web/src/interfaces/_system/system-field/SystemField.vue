<!-- Ported from directus/app/src/interfaces/_system/system-field/system-field.vue -->
<script setup lang="ts">
// Backoffice: VNotice is BoNotice, VSelect is BoSelect (disabled items, `showDeselect` row when allowNone), linked to
// the form label by the FormField ids.
import type { Field } from '@directus/types';
import { computed, inject, ref, watch } from 'vue';
import BoNotice from '../../../components/BoNotice.vue';
import BoSelect from '../../../components/BoSelect.vue';
import { FORM_FIELD_A11Y } from '../../../components/form/types.ts';
import { useFieldsStore } from '../../../stores/fields.ts';

const props = withDefaults(
	defineProps<{
		value: string | null;
		collectionField?: string;
		collectionName?: string;
		typeAllowList?: string[];
		disabled?: boolean;
		placeholder?: string;
		allowNone?: boolean;
		allowPrimaryKey?: boolean;
		allowForeignKeys?: boolean;
	}>(),
	{
		typeAllowList: () => [],
		allowForeignKeys: true,
	},
);

const emit = defineEmits<{
	(e: 'input', value: string | null): void;
}>();

const a11y = inject(FORM_FIELD_A11Y, null);
const fieldsStore = useFieldsStore();

const values = inject('values', ref<Record<string, any>>({}));

const collection = computed(() => values.value[props.collectionField!] || props.collectionName);

const fields = computed(() => {
	if (!props.collectionField && !props.collectionName) return [];
	return fieldsStore.getFieldsForCollection(collection.value);
});

// Reset value whenever the chosen collection changes
watch(collection, (newCol, oldCol) => {
	if (oldCol && newCol !== oldCol) {
		emit('input', null);
	}
});

const selectItems = computed(() =>
	fields.value.map((field: Field) => {
		let disabled = false;

		if (props.allowPrimaryKey === false && field?.schema?.is_primary_key === true) disabled = true;
		if (props.allowForeignKeys === false && field?.schema?.foreign_key_table) disabled = true;
		if (props.typeAllowList.length > 0 && props.typeAllowList.includes(field.type) === false) disabled = true;

		return {
			text: field.name,
			value: field.field,
			disabled,
		};
	}),
);
</script>

<template>
	<BoNotice v-if="!collectionField && !collectionName" type="warning">
		{{ $t('collection_field_not_setup') }}
	</BoNotice>
	<BoNotice v-else-if="selectItems.length === 0" type="warning">
		{{ $t('select_a_collection') }}
	</BoNotice>
	<BoSelect
		v-else
		:id="a11y?.inputId"
		:show-deselect="!!allowNone"
		:model-value="value"
		:disabled="!!disabled"
		:items="selectItems"
		:placeholder="placeholder || $t('select_a_field')"
		@update:model-value="emit('input', $event)"
		@deselect="emit('input', null)"
	/>
</template>
