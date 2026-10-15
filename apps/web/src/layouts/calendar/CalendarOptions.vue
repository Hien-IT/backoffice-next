<!-- Ported from directus/app/src/layouts/calendar/options.vue -->
<script setup lang="ts">
// Backoffice: BoSelect with its label instead of `.type-label` + v-select; `show-deselect` is a "Deselect" item on top
// while a field is chosen (BoSelect has no clear button); the first day values go through the string values of BoSelect;
// the display template is a BoInput (no port of v-collection-field-template yet: the `{{ field }}` template is typed);
// `useSync` = emit of the update.
import type { Field } from '@directus/types';
import { add, startOfWeek } from 'date-fns';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoInput from '../../components/BoInput.vue';
import BoSelect from '../../components/BoSelect.vue';
import { localizedFormat } from '../../utils/localized-format.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
	defineProps<{
		collection: string;
		dateFields: Field[];
		template?: string | undefined;
		startDateField?: string | undefined;
		endDateField?: string | undefined;
		firstDay?: number | undefined;
	}>(),
	{
		template: undefined,
		startDateField: undefined,
		endDateField: undefined,
		firstDay: 0,
	},
);

const emit = defineEmits<{
	'update:template': [value: string];
	'update:startDateField': [value: string | undefined];
	'update:endDateField': [value: string | undefined];
	'update:firstDay': [value: number];
}>();

const { t } = useI18n();

const DESELECT = '__deselect__';

const firstDayOfWeekForDate = startOfWeek(new Date());

const firstDayOptions: { text: string; value: number }[] = [...Array(7).keys()].map((_, i) => ({
	text: localizedFormat(add(firstDayOfWeekForDate, { days: i }), 'EEEE'),
	value: i,
}));

const dateFieldItems = computed(() => props.dateFields.map((field) => ({ text: field.name, value: field.field })));

function fieldItems(selected: string | undefined) {
	return selected ? [{ text: t('deselect'), value: DESELECT }, ...dateFieldItems.value] : dateFieldItems.value;
}

const fromSelect = (value: string) => (value === DESELECT ? undefined : value);

defineExpose({ firstDayOptions });
</script>

<template>
	<div class="space-y-5">
		<BoInput
			:label="$t('display_template')"
			:model-value="template ?? ''"
			@update:model-value="emit('update:template', $event)"
		/>

		<BoSelect
			:label="$t('layouts.calendar.start_date_field')"
			:model-value="startDateField ?? null"
			:items="fieldItems(startDateField)"
			@update:model-value="emit('update:startDateField', fromSelect($event))"
		/>

		<BoSelect
			:label="$t('layouts.calendar.end_date_field')"
			:placeholder="$t('layouts.calendar.optional')"
			:model-value="endDateField ?? null"
			:items="fieldItems(endDateField)"
			@update:model-value="emit('update:endDateField', fromSelect($event))"
		/>

		<BoSelect
			:label="$t('layouts.calendar.first_day')"
			:model-value="String(firstDay)"
			:items="firstDayOptions.map((option) => ({ text: option.text, value: String(option.value) }))"
			@update:model-value="emit('update:firstDay', Number($event))"
		/>
	</div>
</template>
