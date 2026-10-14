<script setup lang="ts">
import { AccordionContent, AccordionHeader, AccordionItem, AccordionRoot, AccordionTrigger } from 'reka-ui';
import { computed } from 'vue';
import BoIcon from './BoIcon.vue';

export interface AccordionItemDef {
	value: string;
	label?: string | undefined;
}

// Tier 3 Accordion recipe (Directus group-accordion). `v-model` is the list of open items in both modes. With
// `multiple`, Shift+click on a header opens every section, or closes them all when all are open (Directus toggleAll).
const {
	items,
	multiple = false,
	dir,
} = defineProps<{
	items: AccordionItemDef[];
	multiple?: boolean | undefined;
	dir?: 'ltr' | 'rtl' | undefined;
}>();

const model = defineModel<string[]>({ default: () => [] });

// Reka types the single and multiple roots apart; one bag of props keeps a single template.
const rootProps = computed<Record<string, unknown>>(() => ({
	type: multiple ? 'multiple' : 'single',
	collapsible: true,
	modelValue: multiple ? model.value : model.value[0],
	...(dir ? { dir } : {}),
}));

function onUpdate(value: string | string[] | undefined) {
	model.value = Array.isArray(value) ? value : value ? [value] : [];
}

// Capture phase on the header: runs before the trigger's own toggle, which stopPropagation then skips.
function onHeaderClick(event: MouseEvent) {
	if (!multiple || !event.shiftKey) return;
	event.stopPropagation();
	model.value = model.value.length === items.length ? [] : items.map((item) => item.value);
}
</script>

<template>
	<AccordionRoot v-bind="rootProps" @update:model-value="onUpdate">
		<AccordionItem
			v-for="item in items"
			:key="item.value"
			:value="item.value"
			class="border-b border-gray-200 dark:border-gray-800"
		>
			<AccordionHeader @click.capture="onHeaderClick">
				<AccordionTrigger
					class="group flex w-full items-center gap-2 py-4 text-start text-sm font-medium text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-white/90 dark:focus-visible:outline-brand-400"
				>
					<slot name="trigger" :item="item" :open="model.includes(item.value)">{{ item.label }}</slot>
					<BoIcon
						name="expand_more"
						class="ms-auto text-gray-500 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none dark:text-gray-400"
					/>
				</AccordionTrigger>
			</AccordionHeader>
			<AccordionContent class="pb-5">
				<slot name="content" :item="item" />
			</AccordionContent>
		</AccordionItem>
	</AccordionRoot>
</template>
