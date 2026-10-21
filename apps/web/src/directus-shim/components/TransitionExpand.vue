<!-- Ported from directus/app/src/components/transition/expand.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7 #67): the Directus height (or width) transition; see expand-methods.ts for
// reduced motion.
import ExpandMethods from './expand-methods.ts';

const props = withDefaults(
	defineProps<{
		/** Expand on the horizontal instead vertical axis */
		xAxis?: boolean;
		/** Add a custom class to the element that is expanded */
		expandedParentClass?: string;
	}>(),
	{
		xAxis: false,
		expandedParentClass: '',
	},
);

const emit = defineEmits([
	'beforeEnter',
	'enter',
	'afterEnter',
	'enterCancelled',
	'beforeLeave',
	'leave',
	'afterLeave',
	'leaveCancelled',
]);

const methods = ExpandMethods(props.expandedParentClass, props.xAxis, emit);
</script>

<template>
	<Transition name="expand-transition" mode="in-out" v-on="methods">
		<slot />
	</Transition>
</template>
