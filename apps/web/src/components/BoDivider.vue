<script setup lang="ts">
import { Separator } from 'reka-ui';
import { computed, useSlots } from 'vue';
import BoIcon from './BoIcon.vue';

// Tier 3 Divider recipe (DR v-divider / presentation-divider). `color` is data (field options): applied to the
// icon and title with `style`, never a class. Spec 020 (VDivider shim): `large` title text and an `icon` slot that
// replaces the `icon` prop.
const {
	title,
	icon,
	color,
	inlineTitle = true,
	vertical = false,
	large = false,
} = defineProps<{
	title?: string | null | undefined;
	icon?: string | null | undefined;
	color?: string | null | undefined;
	/** Title and line on one row (DR `inlineTitle`), else the title above a full-width line. */
	inlineTitle?: boolean | undefined;
	vertical?: boolean | undefined;
	/** Larger title text (DR `large`). */
	large?: boolean | undefined;
}>();

const slots = useSlots();

const hasTitle = computed(() => !vertical && (!!title || !!icon || !!slots['default'] || !!slots['icon']));
</script>

<template>
	<Separator v-if="vertical" orientation="vertical" decorative class="w-px self-stretch bg-gray-200 dark:bg-gray-800" />
	<div v-else :class="hasTitle && inlineTitle ? 'flex items-center gap-3' : undefined">
		<div
			v-if="hasTitle"
			class="flex min-w-0 items-center gap-3"
			:class="color ? undefined : 'text-gray-800 dark:text-white/90'"
			:style="color ? { color } : undefined"
		>
			<slot name="icon">
				<BoIcon v-if="icon" :name="icon" :class="color ? undefined : 'text-gray-500 dark:text-gray-400'" />
			</slot>
			<h3 v-if="title || $slots['default']" class="truncate font-semibold" :class="large ? 'text-xl' : 'text-sm'">
				<slot>{{ title }}</slot>
			</h3>
		</div>
		<Separator
			:decorative="!hasTitle"
			class="h-px bg-gray-200 dark:bg-gray-800"
			:class="hasTitle && inlineTitle ? 'flex-1' : hasTitle ? 'mt-2 w-full' : 'w-full'"
		/>
	</div>
</template>
