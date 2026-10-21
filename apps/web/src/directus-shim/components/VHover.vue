<!-- Ported from directus/app/src/components/v-hover.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): new, the Directus component as is (no markup of its own to style).
import { ref } from 'vue';

const props = withDefaults(
	defineProps<{
		closeDelay?: number;
		openDelay?: number;
		disabled?: boolean;
		tag?: string;
	}>(),
	{
		closeDelay: 0,
		openDelay: 0,
		disabled: false,
		tag: 'div',
	},
);

const hover = ref<boolean>(false);

function onMouseEnter() {
	if (props.disabled === true) return;

	setTimeout(() => {
		hover.value = true;
	}, props.openDelay);
}

function onMouseLeave() {
	if (props.disabled === true) return;

	setTimeout(() => {
		hover.value = false;
	}, props.closeDelay);
}
</script>

<template>
	<component :is="tag" @mouseenter="onMouseEnter" @mouseleave="onMouseLeave">
		<slot v-bind="{ hover }" />
	</component>
</template>
