<script setup lang="ts">
import {
	SelectContent,
	SelectItem,
	SelectItemText,
	SelectPortal,
	SelectRoot,
	SelectTrigger,
	SelectValue,
	SelectViewport,
} from 'reka-ui';
import { useId } from 'vue';
import BoIcon from './BoIcon.vue';

const { items, disabled = false } = defineProps<{
	modelValue?: string | null;
	items: { text: string; value: string }[];
	label?: string;
	placeholder?: string;
	disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const id = useId();
</script>

<template>
	<div class="flex flex-col gap-eh-1">
		<label v-if="label" :for="id" class="text-eh-sm font-semibold text-eh-text-primary">{{ label }}</label>
		<!-- No items: nothing to choose, so the trigger is disabled (empty state). -->
		<SelectRoot
			:model-value="modelValue ?? ''"
			:disabled="disabled || items.length === 0"
			@update:model-value="emit('update:modelValue', String($event))"
		>
			<SelectTrigger
				:id="id"
				class="flex h-eh-10 w-full items-center justify-between gap-eh-2 rounded-eh-md border border-eh-border bg-eh-surface-default px-eh-3 text-eh-base text-eh-text-primary disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-eh-text-secondary"
			>
				<SelectValue :placeholder="placeholder ?? ''" class="truncate" />
				<BoIcon name="expand_more" size="sm" />
			</SelectTrigger>
			<SelectPortal>
				<SelectContent
					position="popper"
					:side-offset="4"
					class="z-50 max-h-(--reka-select-content-available-height) min-w-(--reka-select-trigger-width) overflow-hidden rounded-eh-md border border-eh-border bg-eh-surface-default p-eh-1 shadow-eh-sm"
				>
					<SelectViewport>
						<SelectItem
							v-for="item in items"
							:key="item.value"
							:value="item.value"
							class="flex cursor-pointer items-center rounded-eh-sm px-eh-3 py-eh-2 text-eh-sm text-eh-text-primary outline-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-eh-surface-subtle data-[state=checked]:font-semibold"
						>
							<SelectItemText>{{ item.text }}</SelectItemText>
						</SelectItem>
					</SelectViewport>
				</SelectContent>
			</SelectPortal>
		</SelectRoot>
	</div>
</template>
