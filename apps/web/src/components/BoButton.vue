<script setup lang="ts">
import { computed, useSlots, warn } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import BoIcon from './BoIcon.vue';
import BoProgressCircular from './BoProgressCircular.vue';

const {
	variant = 'primary',
	type = 'button',
	icon,
	ariaLabel,
	loading = false,
	disabled = false,
	to,
	href,
	fullWidth = false,
} = defineProps<{
	variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
	type?: 'button' | 'submit' | 'reset';
	/** Material Symbols name shown before the text; without default slot content the button is icon-only. */
	icon?: string;
	/** Required for an icon-only button (FR-027). */
	ariaLabel?: string;
	loading?: boolean;
	disabled?: boolean;
	to?: RouteLocationRaw;
	href?: string;
	fullWidth?: boolean;
}>();

const slots = useSlots();

const iconOnly = computed(() => !!icon && !slots['default']);
const inactive = computed(() => disabled || loading);

// Vue's warn is a no-op in production builds.
if (icon && !slots['default'] && !ariaLabel) warn(`BoButton: icon-only button "${icon}" needs an ariaLabel`);

// A disabled or loading link renders as a disabled button: links have no disabled state. Only the attributes of the
// chosen element are bound (an `href: undefined` would override the href of RouterLink).
const element = computed(() => {
	if (inactive.value) return { is: 'button', attrs: { type, disabled: true } };
	if (to !== undefined) return { is: RouterLink, attrs: { to } };
	if (href !== undefined) return { is: 'a', attrs: { href } };
	return { is: 'button', attrs: { type } };
});

// component-specs Button: primary, outline (secondary), danger (B-1); ghost has no recipe, it is the outline colors
// without ring and background.
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const VARIANTS = {
	primary: `bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300 ${FOCUS}`,
	secondary: `bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] dark:hover:text-gray-300 ${FOCUS}`,
	ghost: `bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 ${FOCUS}`,
	danger:
		'bg-error-600 text-white shadow-theme-xs hover:bg-error-700 disabled:bg-error-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-600 dark:focus-visible:outline-error-400',
};
</script>

<template>
	<component
		:is="element.is"
		v-bind="element.attrs"
		:aria-label="ariaLabel"
		:aria-busy="loading ? 'true' : undefined"
		class="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium no-underline transition disabled:cursor-not-allowed disabled:opacity-50"
		:class="[VARIANTS[variant], iconOnly ? 'size-10' : 'px-4 py-2.5', { 'w-full': fullWidth }]"
	>
		<BoProgressCircular v-if="loading" indeterminate aria-hidden="true" />
		<BoIcon v-else-if="icon" :name="icon" size="sm" />
		<slot />
	</component>
</template>
