<script setup lang="ts">
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';

// Reka traps focus inside, closes on Esc and outside click, and returns focus to the element that opened it.
const open = defineModel<boolean>('open', { default: false });

defineProps<{ title: string; description?: string }>();
</script>

<template>
	<DialogRoot v-model:open="open">
		<DialogPortal>
			<DialogOverlay class="fixed inset-0 z-50 bg-eh-neutral-900/50" />
			<DialogContent
				class="fixed inset-x-eh-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-eh-lg bg-eh-surface-default p-eh-6 text-eh-text-primary shadow-eh-sm"
				v-bind="description ? {} : { 'aria-describedby': undefined }"
			>
				<DialogTitle class="text-eh-xl font-semibold">{{ title }}</DialogTitle>
				<DialogDescription v-if="description" class="mt-eh-2 text-eh-sm text-eh-text-secondary">
					{{ description }}
				</DialogDescription>
				<div v-if="$slots['default']" class="mt-eh-4"><slot /></div>
				<div v-if="$slots['actions']" class="mt-eh-6 flex justify-end gap-eh-2"><slot name="actions" /></div>
			</DialogContent>
		</DialogPortal>
	</DialogRoot>
</template>
