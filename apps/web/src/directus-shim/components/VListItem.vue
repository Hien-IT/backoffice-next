<!-- Ported from directus/app/src/components/v-list-item.vue -->
<script setup lang="ts">
import { useGroupable } from '@directus/composables';
import { computed, inject, type FunctionalComponent } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import { FOCUS, LIST, useRouteActive } from './list.ts';

// Backoffice (spec 020, data-model §7): RouterLink / `a` / `button` / `li` like DR, joins the `v-list` group.
// Inside a list a link or button gets an `li` around it, outside a list the plain item is a `div` (a11y); attrs go
// to the item element. Styled with the design-system menu item recipe.
defineOptions({ inheritAttrs: false });

const props = withDefaults(
	defineProps<{
		block?: boolean | undefined;
		grow?: boolean | undefined;
		dense?: boolean | undefined;
		to?: string | RouteLocationRaw | undefined;
		href?: string | undefined;
		disabled?: boolean | undefined;
		nonEditable?: boolean | undefined;
		clickable?: boolean | undefined;
		active?: boolean | undefined;
		dashed?: boolean | undefined;
		exact?: boolean | undefined;
		query?: boolean | undefined;
		download?: string | undefined;
		value?: number | string | undefined;
		nav?: boolean | undefined;
		scope?: string | undefined;
		// eslint-disable-next-line vue/require-default-prop -- no default in DR (Boolean casting gives false)
		activator?: boolean | undefined;
	}>(),
	{
		block: false,
		grow: false,
		dense: false,
		to: '',
		href: undefined,
		disabled: false,
		nonEditable: false,
		clickable: false,
		active: undefined,
		dashed: false,
		exact: false,
		query: false,
		download: undefined,
		value: undefined,
		nav: false,
		scope: 'v-list',
	},
);

const emit = defineEmits(['click']);

const list = inject(LIST, null);

const isActiveRoute = useRouteActive(props);

useGroupable({ ...(props.value === undefined ? {} : { value: props.value }), group: props.scope });

const kind = computed(() => {
	if (props.to) return 'link';
	if (props.href) return 'a';
	if (!props.activator && props.clickable) return 'button';
	return 'li';
});

const element = computed(() => {
	if (kind.value === 'link') return RouterLink;
	if (kind.value === 'li') return list ? 'li' : 'div';
	return kind.value;
});

const additionalProps = computed(() => {
	if (kind.value === 'link') return { to: props.to, 'aria-disabled': props.disabled || undefined };
	if (kind.value === 'a') {
		return {
			href: props.href,
			target: '_blank',
			rel: 'noopener noreferrer',
			'aria-disabled': props.disabled || undefined,
		};
	}
	if (kind.value === 'button') return { type: 'button', disabled: props.disabled };
	return { 'aria-disabled': props.disabled || undefined };
});

const isLink = computed(() => Boolean(props.to || props.href || props.clickable));
const isDense = computed(() => props.dense || !!list?.dense.value);
const isNav = computed(() => props.nav || !!list?.nav.value);

function onClick(event: MouseEvent) {
	if (props.disabled === true) return;
	emit('click', event);
}

// DR v-list-item.vue:258-260 keeps a disabled item hoverable (cursor only); the link must not navigate either.
function onClickCapture(event: MouseEvent) {
	if (props.disabled === true) event.preventDefault();
}

// In a list a link or button sits in an `li`; else the item element is the root.
const wrap = computed(() => !!list && kind.value !== 'li');
const Bare: FunctionalComponent = (_, { slots }) => slots['default']?.()[0]; // one root, not a fragment
</script>

<template>
	<component :is="wrap ? 'li' : Bare" v-bind="wrap ? { class: 'contents' } : {}">
		<component
			:is="element"
			v-bind="{ ...$attrs, ...additionalProps }"
			class="v-list-item flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-lg px-3 text-start text-theme-sm"
			:class="[
				// Directus v-list-item.vue:187,189,193: shrinkable, clipped, min height hook.
				isDense ? 'min-h-(--v-list-item-min-height,2rem) py-1' : 'min-h-(--v-list-item-min-height,2.5rem) py-2',
				isNav ? 'font-medium' : undefined,
				isActiveRoute
					? 'active bg-brand-50 text-brand-600 dark:bg-brand-500/[0.12] dark:text-brand-400'
					: disabled
						? 'text-gray-400 dark:text-white/30'
						: 'text-gray-700 dark:text-gray-300',
				{
					[FOCUS]: kind !== 'li',
					'cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5': isLink && !disabled && !isActiveRoute,
					'cursor-not-allowed': disabled,
					'cursor-default': nonEditable,
					'border border-dashed border-gray-300 dark:border-gray-700': dashed,
					'min-h-11 border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]': block && !dashed,
					// Directus v-list-item.vue:300-312,331-333: drag handle cursors and the sortable ghost of block items.
					'[&_.drag-handle]:cursor-grab [&_.drag-handle:active]:cursor-grabbing': block && !disabled,
					'[&.sortable-ghost]:pointer-events-none': block,
				},
			]"
			:download="download"
			@click.capture="onClickCapture"
			@click="onClick"
		>
			<slot />
		</component>
	</component>
</template>
