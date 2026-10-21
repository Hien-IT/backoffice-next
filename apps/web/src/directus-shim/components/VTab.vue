<!-- Ported from directus/app/src/components/v-tab.vue -->
<script setup lang="ts">
import { useGroupable } from '@directus/composables';
import { inject, ref } from 'vue';

// Backoffice (spec 020, data-model §7): joins the `v-tabs` group like Directus; a `button role="tab"` with the
// BoTabs trigger classes (underline when horizontal, menu item when vertical), focusable when active (roving focus in
// VTabs).
const props = withDefaults(defineProps<{ value?: string | number | undefined; disabled?: boolean | undefined }>(), {
	value: undefined,
	disabled: false,
});

const { active, toggle } = useGroupable({
	...(props.value === undefined ? {} : { value: props.value }),
	group: 'v-tabs',
});

const vertical = inject('v-tabs-vertical', ref(false));

function onClick() {
	if (props.disabled === false) toggle();
}

// Directus v-tab.vue:53-54: a disabled tab only shows the not-allowed cursor (hover and tooltips stay); onClick blocks it.
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const HORIZONTAL =
	'-mb-px inline-flex flex-1 shrink-0 items-center justify-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-theme-sm font-medium text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:text-gray-300 data-[state=active]:border-brand-500 data-[state=active]:text-brand-600 dark:text-gray-400 dark:hover:text-gray-300 dark:disabled:text-white/15 dark:data-[state=active]:border-brand-400 dark:data-[state=active]:text-brand-400';
const VERTICAL =
	'flex min-h-9 items-center gap-2 rounded-lg px-3 py-2 text-start text-theme-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent data-[state=active]:bg-brand-50 data-[state=active]:text-brand-600 dark:text-gray-300 dark:hover:bg-white/5 dark:disabled:text-white/15 dark:data-[state=active]:bg-brand-500/[0.12] dark:data-[state=active]:text-brand-400';
</script>

<template>
	<button
		type="button"
		role="tab"
		class="v-tab"
		:class="[vertical ? 'vertical' : 'horizontal', vertical ? VERTICAL : HORIZONTAL, FOCUS, { active }]"
		:data-state="active ? 'active' : 'inactive'"
		:aria-selected="active"
		:tabindex="active ? 0 : -1"
		:disabled="disabled"
		@click="onClick"
	>
		<slot v-bind="{ active, toggle }" />
	</button>
</template>
