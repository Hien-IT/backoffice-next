<script setup lang="ts">
// Backoffice (spec 020, data-model §7): wraps BoSlider (extended with `showThumbLabel`, `showTicks`, `change` and the
// `value` slot of the bubble). Directus shows the bubble always when `alwaysShowValue` (or `nonEditable`), else while
// dragging; here BoSlider shows it on hover and focus. `aria-label`/`aria-labelledby`/`id` go to the thumb, the other
// attrs to the root. Not honoured: the greyless look of `nonEditable` (a disabled slider stays greyed).
import { omit } from 'lodash-es';
import { computed, useAttrs, useId } from 'vue';
import BoSlider from '../../components/BoSlider.vue';

defineOptions({ inheritAttrs: false });

interface Props {
	/** Disables the slider */
	disabled?: boolean;
	/** Set the non-editable state for the radio */
	nonEditable?: boolean;
	/** Show the thumb label on drag of the thumb */
	showThumbLabel?: boolean;
	/** Maximum allowed value */
	max?: number;
	/** Minimum allowed value */
	min?: number;
	/** In what step the value can be entered */
	step?: number;
	/** Show tick for each step */
	showTicks?: boolean;
	/** Always the current selected value */
	alwaysShowValue?: boolean;
	/** Model the current selected value */
	modelValue?: number | null;
}

withDefaults(defineProps<Props>(), {
	disabled: false,
	nonEditable: false,
	showThumbLabel: false,
	max: 100,
	min: 0,
	step: 1,
	showTicks: false,
	alwaysShowValue: true,
	modelValue: 0,
});

const emit = defineEmits(['change', 'update:modelValue']);

const attrs = useAttrs();

const rootAttrs = computed(() => omit(attrs, ['id', 'aria-label', 'aria-labelledby']));

// BoSlider has no aria-label prop: the thumb is labelled by a hidden copy of the text.
const labelId = `${useId()}-label`;

const thumbId = computed(() => attrs['id'] as string | undefined);
const labelledBy = computed(() => (attrs['aria-label'] ? labelId : (attrs['aria-labelledby'] as string | undefined)));
</script>

<template>
	<div v-bind="rootAttrs" class="v-slider flex items-center gap-3">
		<div v-if="$slots['prepend']" class="shrink-0">
			<slot name="prepend" :value="modelValue" />
		</div>
		<span v-if="$attrs['aria-label']" :id="labelId" class="sr-only">{{ $attrs['aria-label'] }}</span>
		<BoSlider
			:id="thumbId"
			class="min-w-0 grow"
			:model-value
			:min
			:max
			:step
			:disabled
			:show-ticks
			:show-thumb-label
			:always-show-value="alwaysShowValue || nonEditable"
			:aria-labelledby="labelledBy"
			@update:model-value="emit('update:modelValue', $event)"
			@change="emit('change', $event)"
		>
			<template #value="{ value }">
				<slot name="thumb-label type-text" :value="value">{{ value }}</slot>
			</template>
		</BoSlider>
		<div v-if="$slots['append']" class="shrink-0">
			<slot name="append" :value="modelValue" />
		</div>
	</div>
</template>
