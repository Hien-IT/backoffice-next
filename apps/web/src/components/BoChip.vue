<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import BoIcon from './BoIcon.vue';

const {
	text,
	size = 'sm',
	removable = false,
	disabled = false,
	removeIcon = 'close',
	outlined = false,
	squared = false,
	clickable = false,
} = defineProps<{
	/** The label; the default slot replaces it. */
	text?: string;
	icon?: string;
	/** Data colors (DR choice foreground / background), applied with style. */
	color?: string;
	background?: string;
	size?: 'sm' | 'md' | 'lg';
	removable?: boolean;
	disabled?: boolean;
	// The options below come from DR v-chip (spec 020, data-model §7); unset they keep the chip as it was.
	removeIcon?: string;
	/** Transparent background with a ring. */
	outlined?: boolean;
	/** Theme radius instead of the pill (DR `label`). */
	squared?: boolean;
	/** The chip is a button. */
	clickable?: boolean | undefined;
}>();

const emit = defineEmits<{ remove: [event: MouseEvent] }>();

const { t } = useI18n();

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
// Tier 3 Chip recipe (Badge light) with the Badge sizes.
const SIZES = { sm: 'text-theme-xs', md: 'text-sm', lg: 'text-base' };
const DELETE = `-me-1 inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-300 ${FOCUS}`;
const BASE = 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80';
const OUTLINED = 'bg-transparent text-gray-700 ring-1 ring-inset ring-gray-300 dark:text-white/80 dark:ring-gray-700';
const CLICKABLE = `cursor-pointer hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/10 ${FOCUS}`;
</script>

<template>
	<component
		:is="clickable ? 'button' : 'span'"
		:type="clickable ? 'button' : undefined"
		:disabled="clickable ? disabled : undefined"
		class="inline-flex max-w-full items-center gap-1 px-2.5 py-0.5 font-medium"
		:class="[
			SIZES[size],
			squared ? 'rounded-lg' : 'rounded-full',
			color || background ? '' : outlined ? OUTLINED : BASE,
			clickable ? CLICKABLE : '',
		]"
		:style="color || background ? { color, backgroundColor: background } : undefined"
	>
		<!-- Leading content (icon, color dot) before the text; defaults to `icon`. -->
		<slot name="leading"><BoIcon v-if="icon" :name="icon" size="sm" class="shrink-0" /></slot>
		<span class="truncate">
			<slot>{{ text }}</slot>
		</span>
		<button
			v-if="removable"
			type="button"
			:class="DELETE"
			:disabled="disabled"
			:aria-label="text ? `${t('remove')} ${text}` : t('remove')"
			@click="emit('remove', $event)"
		>
			<!-- 14px (recipe): the fallthrough style overrides BoIcon's own font size. -->
			<BoIcon :name="removeIcon" size="sm" :style="{ fontSize: 'var(--text-theme-sm)' }" />
		</button>
	</component>
</template>
