<!-- Ported from directus/app/src/components/v-progress-linear.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): v-progress-linear on BoProgressLinear (`colorful` and the `{ value }` slot
// there); `absolute`, `fixed`, `top`, `bottom` position the bar as the DR classes do, `rounded` rounds it. The
// progressbar is named "Loading..." unless the caller gives an `aria-label` (DR has no name).
import { computed } from 'vue';
import BoProgressLinear from '../../components/BoProgressLinear.vue';

const props = withDefaults(
	defineProps<{
		/** Sets position to absolute */
		absolute?: boolean;
		/** Positions the bar at the bottom */
		bottom?: boolean;
		/** Sets position to fixed */
		fixed?: boolean;
		/** Play a general loading animation */
		indeterminate?: boolean;
		/** Rounds up the corners of the progress */
		rounded?: boolean;
		/** Positions the bar at the top */
		top?: boolean;
		/** Which value to represent from 0 to 100 */
		value?: number;
		/** Adds color to progress linear depending on the current percentage */
		colorful?: boolean;
	}>(),
	{
		absolute: false,
		bottom: false,
		fixed: false,
		indeterminate: false,
		rounded: false,
		top: false,
		value: 0,
		colorful: false,
	},
);

defineEmits(['animationiteration']);

// Inline: BoProgressLinear's own `relative` class would tie with a position utility. The height variable is the one
// v-progress-linear reads.
const style = computed(() => ({
	position: props.fixed ? ('fixed' as const) : props.absolute ? ('absolute' as const) : undefined,
	top: props.top ? 0 : undefined,
	bottom: props.bottom ? 0 : undefined,
	height: 'var(--v-progress-linear-height, 0.25rem)',
}));
</script>

<template>
	<BoProgressLinear
		class="v-progress-linear"
		:value="value"
		:indeterminate="indeterminate"
		:colorful="colorful"
		:aria-label="($attrs['aria-label'] as string | undefined) ?? $t('loading')"
		:class="{ 'rounded-full': rounded }"
		:style="style"
		@animationiteration="$emit('animationiteration', $event)"
	>
		<template v-if="$slots['default']" #default="{ value: current }"><slot :value="current" /></template>
	</BoProgressLinear>
</template>
