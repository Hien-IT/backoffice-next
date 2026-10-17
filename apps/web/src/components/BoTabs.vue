<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core';
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui';

export interface TabItem {
	value: string;
	label?: string | undefined;
	disabled?: boolean | undefined;
}

// Tier 3 Tabs recipe. `fillWidth` stretches the triggers over the list; `dir` follows the form direction (Reka
// mirrors the arrow keys in rtl). `orientation="vertical"` (016, research R13): the list is a column at the start of
// the drawer (Q-22, Q-23), Up/Down move between tabs; callers switch back to horizontal on narrow screens. Feature 018
// (Q-39): `list-append` adds content under the list (the Activity link of the notifications drawer), outside the
// tablist; the wrapper is `display: contents` in horizontal mode.
const {
	items,
	label,
	fillWidth = false,
	dir,
	orientation = 'horizontal',
} = defineProps<{
	items: TabItem[];
	/** Accessible name of the tab list. */
	label?: string | undefined;
	fillWidth?: boolean | undefined;
	dir?: 'ltr' | 'rtl' | undefined;
	orientation?: 'horizontal' | 'vertical' | undefined;
}>();

const HORIZONTAL_LIST = 'no-scrollbar flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800';
const VERTICAL_LIST = 'flex w-56 shrink-0 flex-col gap-1';
const TRIGGER_FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const HORIZONTAL_TRIGGER =
	'-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-theme-sm font-medium text-gray-500 hover:text-gray-700 data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 data-[state=active]:border-brand-500 data-[state=active]:text-brand-600 dark:text-gray-400 dark:hover:text-gray-300 dark:data-[disabled]:text-white/15 dark:data-[state=active]:border-brand-400 dark:data-[state=active]:text-brand-400';
const VERTICAL_TRIGGER =
	'flex min-h-9 items-center gap-2 rounded-lg px-3 py-2 text-start text-theme-sm font-medium text-gray-700 hover:bg-gray-100 data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 data-[state=active]:bg-brand-50 data-[state=active]:text-brand-600 dark:text-gray-300 dark:hover:bg-white/5 dark:data-[disabled]:text-white/15 dark:data-[state=active]:bg-brand-500/[0.12] dark:data-[state=active]:text-brand-400';

const model = defineModel<string>({ default: '' });

const [DefineList, ReuseList] = createReusableTemplate();
</script>

<template>
	<TabsRoot
		v-model="model"
		v-bind="dir ? { dir } : {}"
		:orientation="orientation"
		:class="{ 'flex items-start gap-6': orientation === 'vertical' }"
	>
		<DefineList>
			<TabsList :aria-label="label" :class="orientation === 'vertical' ? VERTICAL_LIST : HORIZONTAL_LIST">
				<TabsTrigger
					v-for="item in items"
					:key="item.value"
					:value="item.value"
					:disabled="item.disabled ?? false"
					:class="[
						orientation === 'vertical' ? VERTICAL_TRIGGER : HORIZONTAL_TRIGGER,
						TRIGGER_FOCUS,
						{ 'flex-1 justify-center': fillWidth && orientation !== 'vertical' },
					]"
				>
					<slot name="trigger" :item="item" :active="model === item.value">{{ item.label }}</slot>
				</TabsTrigger>
			</TabsList>
		</DefineList>

		<!-- Without `list-append` the tablist stays a direct child of the root (callers select it so). -->
		<div
			v-if="$slots['list-append']"
			:class="orientation === 'vertical' ? 'flex w-56 shrink-0 flex-col gap-4' : 'contents'"
		>
			<ReuseList />
			<slot name="list-append" />
		</div>
		<ReuseList v-else />
		<TabsContent
			v-for="item in items"
			:key="item.value"
			:value="item.value"
			class="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
			:class="orientation === 'vertical' ? 'min-w-0 flex-1' : 'pt-5'"
		>
			<slot name="content" :item="item" />
		</TabsContent>
	</TabsRoot>
</template>
