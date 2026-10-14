<script setup lang="ts">
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';

// Reka traps focus inside, closes on Esc and outside click, and returns focus to the element that opened it.
const open = defineModel<boolean>('open', { default: false });

defineProps<{ title: string; description?: string }>();
</script>

<template>
	<DialogRoot v-model:open="open">
		<DialogPortal>
			<DialogOverlay class="fixed inset-0 z-99999 bg-gray-400/50 backdrop-blur-[32px]" />
			<DialogContent
				class="no-scrollbar fixed top-1/2 left-1/2 z-99999 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[700px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-4 lg:p-11 dark:bg-gray-900"
				v-bind="description ? {} : { 'aria-describedby': undefined }"
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
