<!-- Ported from directus/app/src/interfaces/slider/slider.vue -->
<script setup lang="ts">
// Backoffice: VSlider (show-thumb-label, show-ticks) is BoSlider (component-specs Slider recipe); the thumb carries
// the form label and messages (FR-094). A null value puts the thumb mid-way without emitting (v-slider.vue).
import { computed, inject } from 'vue';
import BoSlider from '../../components/BoSlider.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';

interface BaseProps {
	disabled?: boolean | undefined;
	nonEditable?: boolean | undefined;
	minValue?: number;
	maxValue?: number;
	stepInterval?: number;
	alwaysShowValue?: boolean | undefined;
}
interface NumberProps extends BaseProps {
	type: 'integer' | 'float';
	value: number | null;
}
interface LegacyNumericStringProps extends BaseProps {
	type: 'bigInteger' | 'decimal';
	value: string | null;
}

const props = withDefaults(defineProps<NumberProps | LegacyNumericStringProps>(), {
	minValue: 0,
	maxValue: 100,
	stepInterval: 1,
});

const value = computed(() => {
	if (props.type === 'decimal') return parseFloat(props.value as string);
	if (props.type === 'bigInteger') return parseInt(props.value as string);
	return props.value as number | null;
});

const emit = defineEmits(['input']);

const a11y = inject(FORM_FIELD_A11Y, null);

// Backoffice: an unparsable string value counts as empty.
const sliderValue = computed(() => (value.value === null || Number.isNaN(value.value) ? null : value.value));
</script>

<template>
	<BoSlider
		:id="a11y?.inputId"
		class="mt-2.5"
		:aria-labelledby="a11y?.labelId"
		:aria-describedby="a11y?.describedBy"
		:invalid="!!a11y?.invalid"
		:model-value="sliderValue"
		:min="minValue"
		:max="maxValue"
		:step="stepInterval"
		:always-show-value="!!alwaysShowValue"
		:disabled="!!disabled"
		@update:model-value="emit('input', $event)"
	/>
</template>
