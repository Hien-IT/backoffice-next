<!-- Ported from directus/app/src/modules/settings/routes/data-model/field-detail/shared/related-field-select.vue -->
<script setup lang="ts">
// Backoffice: VInput with an append menu is a db-safe BoInput next to a BoMenu button of the collection fields
// (alias, primary key, denied types and `disabledFields` disabled); an existing field shows in the brand color.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../../../../../components/BoIcon.vue';
import BoInput from '../../../../../../components/BoInput.vue';
import type { BoMenuItem } from '../../../../../../components/BoMenu.vue';
import BoMenu from '../../../../../../components/BoMenu.vue';
import { useFieldsStore } from '../../../../../../stores/fields.ts';

const props = withDefaults(
	defineProps<{
		modelValue?: string | undefined;
		disabled?: boolean;
		collection?: string | undefined;
		disabledFields?: string[];
		typeDenyList?: string[];
		typeAllowList?: string[] | undefined;
		placeholder?: string | undefined;
		nullable?: boolean;
	}>(),
	{
		modelValue: undefined,
		collection: undefined,
		disabledFields: () => [],
		typeDenyList: () => [],
		typeAllowList: undefined,
		placeholder: undefined,
	},
);

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>();

const { t } = useI18n();
const fieldsStore = useFieldsStore();

const fields = computed(() => {
	if (!props.collection) return [];

	return fieldsStore.getFieldsForCollectionAlphabetical(props.collection).map((field) => ({
		text: field.field,
		value: field.field,
		disabled:
			!field.schema ||
			!!field.schema?.is_primary_key ||
			props.disabledFields.includes(field.field) ||
			props.typeDenyList.includes(field.type) ||
			(props.typeAllowList && !props.typeAllowList.includes(field.type)),
	}));
});

const fieldExists = computed(() => {
	if (!props.collection || !props.modelValue) return false;
	return !!fieldsStore.getField(props.collection, props.modelValue);
});

const items = computed<BoMenuItem[]>(() =>
	fields.value.map((field) => ({
		text: field.text,
		active: props.modelValue === field.value,
		disabled: !!field.disabled,
		onSelect: () => emit('update:modelValue', field.value),
	})),
);

function onInput(value: string | number | null) {
	// DR VInput `nullable`: an emptied input gives null.
	emit('update:modelValue', value === '' && props.nullable ? null : String(value ?? ''));
}

const ICON_BTN =
	'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div class="flex items-center gap-2">
		<div class="min-w-0 flex-1">
			<BoInput
				:model-value="modelValue ?? ''"
				class="font-mono"
				:class="{ '[&_input]:text-brand-500': fieldExists }"
				db-safe
				:disabled="!!disabled"
				:aria-label="placeholder || t('foreign_key')"
				:placeholder="placeholder || t('foreign_key')"
				@update:model-value="onInput"
			/>
		</div>
		<BoMenu v-if="fields.length > 0 && !disabled" :items="items" align="end">
			<template #trigger>
				<button type="button" :class="ICON_BTN" :aria-label="t('select_existing')" :title="t('select_existing')">
					<BoIcon name="list_alt" size="sm" />
				</button>
			</template>
		</BoMenu>
	</div>
</template>
