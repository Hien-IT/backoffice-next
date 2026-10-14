<script setup lang="ts">
import type { IconName } from '@fortawesome/fontawesome-svg-core';
import { computed, defineAsyncComponent } from 'vue';
import { socialIcons } from './icon-picker/social-icons.ts';

// Material Symbols Rounded icon (research R8). Decorative by default; `label` makes it an image with a name.
const { name, size = 'md', label } = defineProps<{ name: string; size?: 'sm' | 'md' | 'lg'; label?: string }>();

// Brand names of the Directus social set render the Font Awesome brand SVG like Directus v-icon.vue. The brands
// library is a lazy chunk so it stays out of the main bundle (research R12).
const SocialIcon = defineAsyncComponent(() => import('./icon-picker/SocialIcon.vue'));

const socialIconName = computed(() => (socialIcons.includes(name) ? (name.replace(/_/g, '-') as IconName) : null));

// Inline style: the font's own `.material-symbols-rounded { font-size: 24px }` is unlayered and beats utilities.
// 18px, 24px (Modal title size) and 30px (TailAdmin title-sm).
const FONT_SIZES = { sm: 'var(--text-lg)', md: 'var(--text-2xl)', lg: 'var(--text-title-sm)' };
</script>

<template>
	<span
		class="select-none"
		:class="socialIconName ? 'inline-flex [&>svg]:h-[1em] [&>svg]:w-[1em]' : 'material-symbols-rounded'"
		:style="{ fontSize: FONT_SIZES[size] }"
		:role="label ? 'img' : undefined"
		:aria-label="label"
		:aria-hidden="label ? undefined : 'true'"
	>
		<SocialIcon v-if="socialIconName" :name="socialIconName" />
		<template v-else>{{ name }}</template>
	</span>
</template>
