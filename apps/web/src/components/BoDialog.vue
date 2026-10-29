<script setup lang="ts">
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import { watch } from 'vue';

// Reka traps focus inside, closes on Esc and outside click, and returns focus to the element that opened it.
// `persistent` keeps it open on an outside click, Esc still closes (DR `v-dialog persistent`).
const open = defineModel<boolean>('open', { default: false });

defineProps<{ title: string; description?: string; persistent?: boolean }>();

// Backoffice (FR-094, D-197): opened from a menu item, Reka records that item, which is gone on close, and sends the
// focus to the body. Recorded here when the dialog opens; a menu item is replaced by its menu trigger (aria-labelledby).
let returnFocus: HTMLElement | null = null;

watch(
	open,
	(isOpen) => {
		if (!isOpen) return;
		const active = document.activeElement as HTMLElement | null;
		const menu = active?.closest('[role="menu"]');
		returnFocus = (menu && document.getElementById(menu.getAttribute('aria-labelledby') ?? '')) || active;
	},
	{ flush: 'sync', immediate: true },
);

function onCloseAutoFocus(event: Event) {
	if (returnFocus?.isConnected && returnFocus !== document.body) {
		event.preventDefault();
		returnFocus.focus();
	}

	returnFocus = null;
}
</script>

<template>
	<DialogRoot v-model:open="open">
		<DialogPortal>
			<DialogOverlay class="fixed inset-0 z-99999 bg-gray-900/40 backdrop-blur-[2px] dark:bg-gray-950/60" />
			<DialogContent
				class="no-scrollbar fixed top-1/2 left-1/2 z-99999 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[700px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-4 lg:p-11 dark:border dark:border-gray-800 dark:bg-gray-900"
				v-bind="description ? {} : { 'aria-describedby': undefined }"
				@interact-outside="persistent && $event.preventDefault()"
				@close-auto-focus="onCloseAutoFocus"
			>
				<DialogTitle class="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ title }}</DialogTitle>
				<DialogDescription v-if="description" class="mb-6 text-sm text-gray-500 lg:mb-7 dark:text-gray-400">
					{{ description }}
				</DialogDescription>
				<div v-if="$slots['default']" class="custom-scrollbar overflow-y-auto p-2"><slot /></div>
				<div v-if="$slots['actions']" class="mt-6 flex items-center gap-3 px-2 lg:justify-end">
					<slot name="actions" />
				</div>
			</DialogContent>
		</DialogPortal>
	</DialogRoot>
</template>
