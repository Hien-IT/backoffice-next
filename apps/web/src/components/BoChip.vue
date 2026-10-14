<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import BoIcon from './BoIcon.vue';

const {
	size = 'sm',
	removable = false,
	disabled = false,
} = defineProps<{
	text: string;
	icon?: string;
	/** Data colors (Directus choice foreground / background), applied with style. */
	color?: string;
	background?: string;
	size?: 'sm' | 'md';
	removable?: boolean;
	disabled?: boolean;
}>();

const emit = defineEmits<{ remove: [] }>();

const { t } = useI18n();

// Tier 3 Chip recipe (Badge light) with the Badge sizes.
const SIZES = { sm: 'text-theme-xs', md: 'text-sm' };
const DELETE =
	'-me-1 inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-300 dark:focus-visible:outline-brand-400';
</script>

<template>
	<span
		class="inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 font-medium"
		:class="[SIZES[size], color || background ? '' : 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80']"
		:style="color || background ? { color, backgroundColor: background } : undefined"
	>
		<!-- Leading content (icon, color dot) before the text; defaults to `icon`. -->
		<slot name="leading"><BoIcon v-if="icon" :name="icon" size="sm" class="shrink-0" /></slot>
		<span class="truncate">{{ text }}</span>
		<button
			v-if="removable"
			type="button"
			:class="DELETE"
			:disabled="disabled"
			:aria-label="`${t('remove')} ${text}`"
			@click="emit('remove')"
		>
			<!-- 14px (recipe): the fallthrough style overrides BoIcon's own font size. -->
			<BoIcon name="close" size="sm" :style="{ fontSize: 'var(--text-theme-sm)' }" />
		</button>
	</span>
</template>
