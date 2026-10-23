<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui';
import BoIcon from './BoIcon.vue';
import BoTooltip from './BoTooltip.vue';

// Tier 3 Detail recipe (DR v-detail as used by group-detail). `color` is data (DR `headerColor`): icon and
// title color by `style`; without it the theme classes apply. The `badge` slot sits after the title (error icon).
// Spec 020 (VDetail shim): an `activator` slot replaces the header button, with `{ active, enable, disable, toggle }`.
const {
	title,
	icon,
	color,
	edited = false,
	disabled = false,
} = defineProps<{
	title?: string | null | undefined;
	icon?: string | null | undefined;
	color?: string | null | undefined;
	edited?: boolean | undefined;
	disabled?: boolean | undefined;
}>();

const open = defineModel<boolean>({ default: false });

const enable = () => (open.value = true);
const disable = () => (open.value = false);
const toggle = () => (open.value = !open.value);
</script>

<template>
	<CollapsibleRoot v-model:open="open" :disabled="disabled">
		<slot name="activator" v-bind="{ active: open, enable, disable, toggle }">
			<CollapsibleTrigger
				class="group flex w-full items-center gap-2 border-b border-gray-200 py-2 text-start text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed dark:border-gray-800 dark:focus-visible:outline-brand-400"
				:class="color ? undefined : 'text-gray-800 dark:text-white/90'"
				:style="color ? { color } : undefined"
			>
				<BoIcon v-if="icon" :name="icon" :class="color ? undefined : 'text-gray-500 dark:text-gray-400'" />
				<BoTooltip v-if="edited" :text="$t('edited')">
					<span class="inline-flex" data-edited>
						<span class="h-1.5 w-1.5 rounded-full bg-gray-500 dark:bg-gray-400" aria-hidden="true" />
						<span class="sr-only">{{ $t('edited') }}</span>
					</span>
				</BoTooltip>
				<span class="min-w-0 truncate">
					<slot name="title">{{ title }}</slot>
				</span>
				<slot name="badge" />
				<BoIcon
					name="expand_more"
					class="ms-auto text-gray-500 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none dark:text-gray-400"
				/>
			</CollapsibleTrigger>
		</slot>
		<CollapsibleContent class="pt-5">
			<slot />
		</CollapsibleContent>
	</CollapsibleRoot>
</template>
