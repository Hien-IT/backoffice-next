<!-- Ported from directus/app/src/components/v-progress-circular.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): v-progress-circular on BoProgressCircular (1em, current color) in a box of the
// DR sizes; the default slot sits in the middle; `animationiteration` comes from the spinning svg. The progressbar
// is named "Loading..." unless the caller gives an `aria-label` (DR has no name).
import { computed } from 'vue';
import BoProgressCircular from '../../components/BoProgressCircular.vue';

const props = withDefaults(
	defineProps<{
		/** If set to true displays no value but spins indefinitely */
		indeterminate?: boolean;
		/** Which value to represent going from 0 to 100 */
		value?: number;
		/** Renders the progress circular smaller */
		xSmall?: boolean;
		/** Renders the progress circular small */
		small?: boolean;
		/** Renders the progress circular large */
		large?: boolean;
		/** Renders the progress circular larger */
		xLarge?: boolean;
	}>(),
	{ indeterminate: false, value: 0 },
);

defineEmits(['animationiteration']);

// v-progress-circular --v-progress-circular-size per size class.
const size = computed(() => {
	if (props.xSmall) return '0.6875rem';
	if (props.small) return '1.125rem';
	if (props.large) return '2.6875rem';
	if (props.xLarge) return '3.625rem';
	// DR v-progress-circular.vue:77: the default size reads --v-progress-circular-size.
	return 'var(--v-progress-circular-size, 1.5625rem)';
});
</script>

<template>
	<div
		class="v-progress-circular relative inline-flex items-center justify-center"
		:style="{ fontSize: size, width: size, height: size }"
	>
		<BoProgressCircular
			class="absolute inset-0"
			:value="value"
			:indeterminate="indeterminate"
			:aria-label="($attrs['aria-label'] as string | undefined) ?? $t('loading')"
			@animationiteration="$emit('animationiteration', $event)"
		/>
		<slot />
	</div>
</template>
