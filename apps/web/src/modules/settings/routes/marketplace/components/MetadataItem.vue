<!-- Ported from directus/app/src/modules/settings/routes/marketplace/components/metadata-item.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-43): a metadata row `flex items-center gap-3 text-theme-sm` with an 18 px icon (BoIcon sm);
// `href` is an external link (new tab, rel noopener noreferrer). The unused `to` prop is not ported. Directus
// `has-tooltip` + `v-tooltip` become `tooltip`: the row is then focusable so the tooltip opens from the keyboard too.
import BoIcon from '../../../../../components/BoIcon.vue';
import BoTooltip from '../../../../../components/BoTooltip.vue';

const {
	color = 'subdued',
	href = null,
	tooltip = null,
} = defineProps<{
	icon: string;
	color?: 'primary' | 'subdued' | 'foreground' | 'warning';
	href?: string | null | undefined;
	monospace?: boolean;
	tooltip?: string | null | undefined;
}>();

const COLORS = {
	primary: 'text-brand-500 dark:text-brand-400',
	foreground: 'text-gray-800 dark:text-white/90',
	subdued: 'text-gray-500 dark:text-gray-400',
	warning: 'text-warning-700 dark:text-warning-400',
};

const ROW = 'flex items-center gap-3 rounded-lg py-1.5 text-theme-sm';
const LINK = 'no-underline hover:text-brand-500 dark:hover:text-brand-400';
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<a v-if="href" :href="href" target="_blank" rel="noopener noreferrer" :class="[ROW, LINK, FOCUS, COLORS[color]]">
		<BoIcon :name="icon" size="sm" class="shrink-0" />
		<span class="min-w-0 truncate" :class="{ 'font-mono': monospace }"><slot /></span>
	</a>
	<BoTooltip v-else-if="tooltip" :text="tooltip">
		<div tabindex="0" class="cursor-help" :class="[ROW, FOCUS, COLORS[color]]">
			<slot name="icon"><BoIcon :name="icon" size="sm" class="shrink-0" /></slot>
			<span class="min-w-0" :class="{ 'font-mono': monospace }"><slot /></span>
		</div>
	</BoTooltip>
	<div v-else :class="[ROW, COLORS[color]]">
		<slot name="icon"><BoIcon :name="icon" size="sm" class="shrink-0" /></slot>
		<span class="min-w-0" :class="{ 'font-mono': monospace }"><slot /></span>
	</div>
</template>
