<script setup lang="ts">
// Spec 020 (Q-44, component-specs "Shim components of app extensions"): a non-modal popover panel on the Reka Popover
// primitives. The `activator` slot is one focusable element (as-child of PopoverTrigger); without it the panel is placed
// against `reference` (an element or a virtual point, e.g. a context menu). Reka closes it on Esc and on a pointer down
// or focus outside, and returns the focus to the trigger. Other attributes and listeners go to PopoverContent
// (`interact-outside`, `open-auto-focus`, `close-auto-focus`, `id`, `class`, ...). Teleported to `body`: a menu
// outlet that exists before a modal dialog opens is marked aria-hidden by the dialog (Reka hideOthers).
import { PopoverArrow, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';

defineOptions({ inheritAttrs: false });

const open = defineModel<boolean>('open', { default: false });

const {
	side = 'bottom',
	align = 'center',
	sideOffset = 8,
	alignOffset = 0,
	arrowPadding = 0,
	reference = undefined,
	arrow = false,
	seamless = false,
} = defineProps<{
	side?: 'top' | 'right' | 'bottom' | 'left';
	align?: 'start' | 'center' | 'end';
	sideOffset?: number;
	alignOffset?: number;
	/** Element or virtual element the panel is placed against when there is no activator slot. */
	reference?: Element | { getBoundingClientRect: () => DOMRect } | undefined;
	/** An arrow pointing at the activator. */
	arrow?: boolean | undefined;
	arrowPadding?: number;
	/** No padding: the content draws its own. */
	seamless?: boolean | undefined;
}>();
</script>

<template>
	<PopoverRoot v-model:open="open">
		<PopoverTrigger v-if="$slots['activator']" as-child>
			<slot name="activator" :open="open" />
		</PopoverTrigger>
		<PopoverPortal>
			<PopoverContent
				v-bind="{ ...$attrs, ...(reference ? { reference } : {}) }"
				:side="side"
				:align="align"
				:side-offset="sideOffset"
				:align-offset="alignOffset"
				:arrow-padding="arrowPadding"
				class="bo-popover z-99999 rounded-xl border border-gray-200 bg-white text-theme-sm text-gray-700 shadow-theme-lg outline-hidden dark:border-gray-800 dark:bg-gray-dark dark:text-gray-400"
			>
				<div
					class="custom-scrollbar max-h-(--reka-popover-content-available-height) overflow-y-auto rounded-[inherit]"
					:class="{ 'p-2': !seamless }"
				>
					<slot :close="() => (open = false)" />
				</div>
				<PopoverArrow v-if="arrow" :width="12" :height="6" class="fill-white dark:fill-gray-dark" />
			</PopoverContent>
		</PopoverPortal>
	</PopoverRoot>
</template>

<style>
/* Directus TransitionBounce on the panel: fade and grow from the activator side; off under reduced motion. */
.bo-popover[data-state='open'] {
	transform-origin: var(--reka-popover-content-transform-origin);
	animation: bo-popover-in 125ms cubic-bezier(0, 0, 0.2, 1);
}

.bo-popover[data-state='closed'] {
	transform-origin: var(--reka-popover-content-transform-origin);
	animation: bo-popover-out 100ms cubic-bezier(0.4, 0, 1, 1);
}

@keyframes bo-popover-in {
	from {
		opacity: 0;
		scale: 0.95;
	}
}

@keyframes bo-popover-out {
	to {
		opacity: 0;
		scale: 0.95;
	}
}

@media (prefers-reduced-motion: reduce) {
	.bo-popover[data-state] {
		animation: none;
	}
}
</style>
