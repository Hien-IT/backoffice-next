<!-- Ported from directus/app/src/components/v-tabs.vue -->
<script setup lang="ts">
import { useGroupableParent } from '@directus/composables';
import { provide, ref, toRefs } from 'vue';

// Backoffice (spec 020, data-model §7): same `v-tabs` group as Directus (single, mandatory) and `v-tabs-vertical`
// provide. Rendered as a design-system tab list (BoTabs recipe) with roving focus: arrows (mirrored in rtl), Home and
// End move to and select the next enabled tab. Vertical tabs are a column of tabs rather than a v-list (a tablist may
// only hold tabs).
const props = withDefaults(
	defineProps<{ vertical?: boolean | undefined; modelValue?: (number | string)[] | undefined }>(),
	{
		vertical: false,
		modelValue: undefined,
	},
);

const emit = defineEmits(['update:modelValue']);

const { modelValue: selection, vertical } = toRefs(props);

provide('v-tabs-vertical', vertical);

useGroupableParent(
	{ selection, onSelectionChange: (newSelection) => emit('update:modelValue', newSelection) },
	{ multiple: ref(false), mandatory: ref(true) },
	'v-tabs',
);

function onKeydown(event: KeyboardEvent) {
	const list = event.currentTarget as HTMLElement;
	const tabs = [...list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')].filter(
		(tab) => tab.closest('[role="tablist"]') === list,
	);
	const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
	if (index === -1) return;

	const rtl = !props.vertical && getComputedStyle(list).direction === 'rtl';
	const [previous, next] = props.vertical
		? ['ArrowUp', 'ArrowDown']
		: rtl
			? ['ArrowRight', 'ArrowLeft']
			: ['ArrowLeft', 'ArrowRight'];

	let target: number;
	if (event.key === previous) target = (index - 1 + tabs.length) % tabs.length;
	else if (event.key === next) target = (index + 1) % tabs.length;
	else if (event.key === 'Home') target = 0;
	else if (event.key === 'End') target = tabs.length - 1;
	else return;

	event.preventDefault();
	tabs[target]!.focus();
	tabs[target]!.click();
}
</script>

<template>
	<div
		role="tablist"
		class="v-tabs"
		:class="
			vertical
				? 'vertical flex flex-col gap-1'
				: 'horizontal no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800'
		"
		:aria-orientation="vertical ? 'vertical' : 'horizontal'"
		@keydown="onKeydown"
	>
		<slot />
	</div>
</template>
