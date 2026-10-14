<script setup lang="ts">
// "N items" menu recipe (design-system component-specs, Tier 3): the Reka Popover that replaces the Directus
// `v-menu show-arrow` with a click activator in the relational and JSON displays. Attributes go to the trigger.
import { PopoverArrow, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';

defineOptions({ inheritAttrs: false });

defineProps<{
	disabled?: boolean;
	/** Replaces the recipe trigger classes (e.g. an icon button). */
	triggerClass?: string;
}>();

const TRIGGER =
	'inline-flex items-center gap-1 rounded text-theme-sm text-gray-700 underline decoration-dotted underline-offset-4 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:pointer-events-none disabled:text-gray-500 disabled:no-underline dark:text-gray-400 dark:hover:text-gray-300 dark:focus-visible:outline-brand-400';
const POPOVER =
	'z-99999 max-h-(--reka-popover-content-available-height) min-w-48 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg custom-scrollbar dark:border-gray-800 dark:bg-gray-dark';

// Reka's own auto focus targets the popper wrapper, which has no tabindex: focus the content so Tab reaches the links
// inside (same fix as UserPopover).
function onOpenAutoFocus(event: Event) {
	event.preventDefault();
	(event.target as HTMLElement).querySelector<HTMLElement>('[role="dialog"]')?.focus();
}
</script>

<template>
	<PopoverRoot>
		<!-- Directus stops the click so a table row under the display does not open. -->
		<PopoverTrigger v-bind="$attrs" :class="triggerClass ?? TRIGGER" :disabled="disabled" @click.stop>
			<slot name="trigger" />
		</PopoverTrigger>

		<PopoverPortal>
			<PopoverContent
				:side-offset="4"
				align="start"
				:collision-padding="8"
				:class="POPOVER"
				@open-auto-focus="onOpenAutoFocus"
			>
				<slot />
				<PopoverArrow class="fill-white dark:fill-gray-dark" />
			</PopoverContent>
		</PopoverPortal>
	</PopoverRoot>
</template>
