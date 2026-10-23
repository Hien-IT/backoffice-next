<script setup lang="ts">
import { computed, useSlots, warn } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import BoIcon from './BoIcon.vue';
import BoProgressCircular from './BoProgressCircular.vue';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'info' | 'success' | 'warning';

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
	size,
	square = false,
	shape,
	outlined = false,
	dashed = false,
	active = false,
	align,
} = defineProps<{
	/** info, success, warning: the status-colored solid buttons (DR v-button `kind`, spec 020). */
	variant?: Variant;
	type?: 'button' | 'submit' | 'reset';
	/** Material Symbols name shown before the text; without default slot content the button is icon-only. */
	icon?: string;
	/** Required for an icon-only button (FR-027). */
	ariaLabel?: string | undefined;
	loading?: boolean | undefined;
	disabled?: boolean | undefined;
	to?: RouteLocationRaw;
	href?: string;
	fullWidth?: boolean | undefined;
	// The options below come from DR v-button (spec 020, data-model §7); unset they keep the compact button.
	/** Height 24/32/48/56 px instead of the compact 40 px. */
	size?: 'xs' | 'sm' | 'lg' | 'xl' | undefined;
	/** Square icon button whatever the content (DR `icon`). */
	square?: boolean | undefined;
	/** circle = DR `rounded`, tile = no radius. */
	shape?: 'circle' | 'tile' | undefined;
	/** Transparent background with a ring in the variant color. */
	outlined?: boolean | undefined;
	/** Dashed neutral border. */
	dashed?: boolean | undefined;
	/** Highlighted (selected) state: outlined and neutral buttons draw filled. */
	active?: boolean | undefined;
	align?: 'start' | 'end' | undefined;
}>();

const slots = useSlots();

const iconOnly = computed(() => square || (!!icon && !slots['default']));
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
// without ring and background. info/success/warning: the status-colored solid buttons (700 shades with white text).
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const FOCUS_ERROR =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-600 dark:focus-visible:outline-error-400';
const VARIANTS: Record<Variant, string> = {
	primary: `bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300 ${FOCUS}`,
	secondary: `bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] dark:hover:text-gray-300 ${FOCUS}`,
	ghost: `bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 ${FOCUS}`,
	danger: `bg-error-600 text-white shadow-theme-xs hover:bg-error-700 disabled:bg-error-300 ${FOCUS_ERROR}`,
	info: `bg-blue-light-700 text-white shadow-theme-xs hover:bg-blue-light-800 disabled:bg-blue-light-300 ${FOCUS}`,
	success: `bg-success-700 text-white shadow-theme-xs hover:bg-success-800 disabled:bg-success-300 ${FOCUS}`,
	warning: `bg-warning-700 text-white shadow-theme-xs hover:bg-warning-800 disabled:bg-warning-300 ${FOCUS}`,
};
const NEUTRAL_OUTLINED = `bg-transparent text-gray-500 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] ${FOCUS}`;
const OUTLINED: Record<Variant, string> = {
	primary: `bg-transparent text-brand-600 ring-1 ring-inset ring-brand-500 hover:bg-brand-50 dark:text-brand-400 dark:ring-brand-400 dark:hover:bg-brand-500/15 ${FOCUS}`,
	secondary: NEUTRAL_OUTLINED,
	ghost: NEUTRAL_OUTLINED,
	danger: `bg-transparent text-error-600 ring-1 ring-inset ring-error-600 hover:bg-error-50 dark:text-error-400 dark:ring-error-400 dark:hover:bg-error-500/15 ${FOCUS_ERROR}`,
	info: `bg-transparent text-blue-light-700 ring-1 ring-inset ring-blue-light-700 hover:bg-blue-light-50 dark:text-blue-light-400 dark:ring-blue-light-400 dark:hover:bg-blue-light-500/15 ${FOCUS}`,
	success: `bg-transparent text-success-700 ring-1 ring-inset ring-success-700 hover:bg-success-50 dark:text-success-400 dark:ring-success-400 dark:hover:bg-success-500/15 ${FOCUS}`,
	warning: `bg-transparent text-warning-700 ring-1 ring-inset ring-warning-700 hover:bg-warning-50 dark:text-warning-400 dark:ring-warning-400 dark:hover:bg-warning-500/15 ${FOCUS}`,
};
const ACTIVE_NEUTRAL = `bg-gray-100 text-gray-800 ring-1 ring-inset ring-gray-300 dark:bg-white/5 dark:text-white/90 dark:ring-gray-700 ${FOCUS}`;
const DASHED = `border border-dashed border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.03] ${FOCUS}`;

const SIZES = {
	xs: 'h-6 px-2.5 text-theme-xs',
	sm: 'h-8 px-3 text-theme-sm',
	md: 'px-4 py-2.5 text-sm',
	lg: 'h-12 px-5 text-sm',
	xl: 'h-14 px-6 text-base',
};
const SQUARES = {
	xs: 'size-6 text-theme-xs',
	sm: 'size-8 text-theme-sm',
	md: 'size-10 text-sm',
	lg: 'size-12 text-sm',
	xl: 'size-14 text-base',
};
const SHAPES = { circle: 'rounded-full', tile: 'rounded-none' };
const ALIGN = { start: 'justify-start', end: 'justify-end' };

const neutral = computed(() => variant === 'secondary' || variant === 'ghost');

const colors = computed(() => {
	if (dashed && !active) return DASHED;
	if (outlined && !active) return OUTLINED[variant];
	if (active && neutral.value) return ACTIVE_NEUTRAL;
	return VARIANTS[variant];
});
</script>

<template>
	<component
		:is="element.is"
		v-bind="element.attrs"
		:aria-label="ariaLabel"
		:aria-busy="loading ? 'true' : undefined"
		class="inline-flex items-center gap-2 font-medium no-underline transition disabled:cursor-not-allowed disabled:opacity-50"
		:class="[
			colors,
			(iconOnly ? SQUARES : SIZES)[size ?? 'md'],
			shape ? SHAPES[shape] : 'rounded-lg',
			align ? ALIGN[align] : 'justify-center',
			{ 'w-full': fullWidth },
		]"
	>
		<slot v-if="loading" name="loading"><BoProgressCircular indeterminate aria-hidden="true" /></slot>
		<BoIcon v-else-if="icon" :name="icon" size="sm" />
		<!-- A square button has room for the spinner only. -->
		<slot v-if="!loading || !square" />
	</component>
</template>
