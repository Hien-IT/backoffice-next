<!-- Ported from directus/app/src/interfaces/_system/system-display/system-display.vue -->
<script setup lang="ts">
// Backoffice: VNotice is BoNotice, VSelect is BoSelect (`showDeselect` as Directus); the displays come from the apps/web registry with
// their names translated (Directus translates them when it registers the extensions).
import { computed, inject, ref, watch } from 'vue';
import BoNotice from '../../../components/BoNotice.vue';
import BoSelect from '../../../components/BoSelect.vue';
import { FORM_FIELD_A11Y } from '../../../components/form/types.ts';
import { getDisplays } from '../../../displays/index.ts';
import { translateString } from '../../../utils/translate-object-values.ts';

const props = defineProps<{
	value: string | null;
	typeField?: string;
}>();

const emit = defineEmits<{
	(e: 'input', value: string | null): void;
}>();

const a11y = inject(FORM_FIELD_A11Y, null);
const values = inject('values', ref<Record<string, any>>({}));

const selectedType = computed(() => {
	if (!props.typeField || !values.value[props.typeField]) return;
	return values.value[props.typeField];
});

watch(
	() => values.value[props.typeField!],
	() => {
		emit('input', null);
	},
);

const items = computed(() => {
	return getDisplays()
		.filter((ext) => (ext.localTypes?.length ?? 0) === 0)
		.filter((ext) => selectedType.value === undefined || ext.types.includes(selectedType.value))
		.map((ext) => {
			return {
				text: translateString(ext.name),
				value: ext.id,
			};
		});
});
</script>

<template>
	<BoNotice v-if="selectedType === undefined">
		{{ $t('select_field_type') }}
	</BoNotice>
	<BoSelect
		v-else
		v-bind="a11y?.inputId ? { id: a11y.inputId } : {}"
		:items="items"
		:model-value="value"
		:placeholder="$t('interfaces.system-display.placeholder')"
		show-deselect
		@deselect="emit('input', null)"
		@update:model-value="emit('input', $event)"
	/>
</template>
