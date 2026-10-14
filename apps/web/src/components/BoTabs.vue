<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui';

export interface TabItem {
	value: string;
	label?: string | undefined;
	disabled?: boolean | undefined;
}

// Tier 3 Tabs recipe. `fillWidth` stretches the triggers over the list; `dir` follows the form direction (Reka
// mirrors the arrow keys in rtl).
const {
	items,
	label,
	fillWidth = false,
	dir,
} = defineProps<{
	items: TabItem[];
	/** Accessible name of the tab list. */
	label?: string | undefined;
	fillWidth?: boolean | undefined;
	dir?: 'ltr' | 'rtl' | undefined;
}>();

const model = defineModel<string>({ default: '' });
</script>

<template>
	<TabsRoot v-model="model" v-bind="dir ? { dir } : {}">
		<TabsList
			:aria-label="label"
			class="no-scrollbar flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800"
		>
			<TabsTrigger
				v-for="item in items"
				:key="item.value"
				:value="item.value"
				:disabled="item.disabled ?? false"
				class="-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-theme-sm font-medium text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 data-[state=active]:border-brand-500 data-[state=active]:text-brand-600 dark:text-gray-400 dark:hover:text-gray-300 dark:focus-visible:outline-brand-400 dark:data-[disabled]:text-white/15 dark:data-[state=active]:border-brand-400 dark:data-[state=active]:text-brand-400"
				:class="{ 'flex-1 justify-center': fillWidth }"
			>
				<slot name="trigger" :item="item" :active="model === item.value">{{ item.label }}</slot>
			</TabsTrigger>
		</TabsList>
		<TabsContent
			v-for="item in items"
			:key="item.value"
			:value="item.value"
			class="pt-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
		>
			<slot name="content" :item="item" />
		</TabsContent>
	</TabsRoot>
</template>
