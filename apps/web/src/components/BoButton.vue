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

const VARIANTS = {
	primary: 'bg-eh-action-primary text-eh-neutral-0 hover:bg-eh-blue-800',
	secondary: 'border border-eh-border bg-eh-surface-default text-eh-text-primary hover:bg-eh-surface-subtle',
	ghost: 'bg-transparent text-eh-text-primary hover:bg-eh-surface-subtle',
	// Status colors are for border/icon only, text stays text-primary (spec Q-8).
	danger: 'border border-eh-status-danger bg-eh-surface-default text-eh-text-primary hover:bg-eh-surface-subtle',
};
</script>

<template>
	<component
		:is="element.is"
		v-bind="element.attrs"
		:aria-label="ariaLabel"
		:aria-busy="loading ? 'true' : undefined"
		class="inline-flex h-eh-10 items-center justify-center gap-eh-2 rounded-eh-md text-eh-sm font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-50"
		:class="[VARIANTS[variant], iconOnly ? 'w-eh-10' : 'px-eh-4', { 'w-full': fullWidth }]"
	>
		<BoProgressCircular v-if="loading" indeterminate aria-hidden="true" />
		<BoIcon v-else-if="icon" :name="icon" size="sm" />
		<slot />
	</component>
</template>
