<!-- Ported from directus/app/src/views/private/components/sidebar-detail.vue -->
<script setup lang="ts">
// Backoffice: recipe "Detail panel sections (Q-9)" and the L-4 section block (layout-patterns §7). Each section is its
// own single, collapsible Reka AccordionRoot bound to `sidebarStore.activeAccordionItem` (Directus: one AccordionRoot
// in private-view-sidebar.vue, which DetailPanel does not have), so one section is open at a time through the store.
// No collapsed-rail tooltip: a collapsed panel is hidden (D-45). The badge is a light Badge (BoChip) or a dot.
import { AccordionContent, AccordionHeader, AccordionItem, AccordionRoot, AccordionTrigger } from 'reka-ui';
import { watch } from 'vue';
import { useSidebarStore } from '../../layout/stores/sidebar.ts';
import BoChip from '../BoChip.vue';
import BoIcon from '../BoIcon.vue';

const props = defineProps<{
	id: string;
	title: string;
	icon: string;
	badge?: boolean | string | number;
}>();

const sidebarStore = useSidebarStore();

const emit = defineEmits<{
	toggle: [open: boolean];
}>();

watch(
	() => sidebarStore.activeAccordionItem,
	(newActive, oldActive) => {
		if (newActive === props.id && newActive !== oldActive) {
			emit('toggle', true);
		} else if (oldActive === props.id && newActive !== props.id) {
			emit('toggle', false);
		}
	},
);

function onUpdate(value: string | string[] | undefined) {
	if (value === props.id) sidebarStore.activeAccordionItem = props.id;
	else if (sidebarStore.activeAccordionItem === props.id) sidebarStore.activeAccordionItem = null;
}
</script>

<template>
	<AccordionRoot
		type="single"
		collapsible
		:model-value="sidebarStore.activeAccordionItem === id ? id : ''"
		@update:model-value="onUpdate"
	>
		<AccordionItem :value="id" class="border-b border-gray-200 dark:border-gray-800">
			<AccordionHeader>
				<AccordionTrigger
					class="group flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
				>
					<BoIcon :name="icon" class="text-gray-500 dark:text-gray-400" />
					<span class="min-w-0 flex-1 truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
						{{ title }}
					</span>
					<span v-if="badge === true" class="size-2 shrink-0 rounded-full bg-brand-500 dark:bg-brand-400" />
					<BoChip v-else-if="badge" :text="String(badge)" class="shrink-0" />
					<BoIcon
						name="expand_more"
						class="text-gray-500 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none dark:text-gray-400"
					/>
				</AccordionTrigger>
			</AccordionHeader>
			<AccordionContent class="px-5 pb-5 text-theme-sm text-gray-500 dark:text-gray-400">
				<slot />
			</AccordionContent>
		</AccordionItem>
	</AccordionRoot>
</template>
