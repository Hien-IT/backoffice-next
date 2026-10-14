<!--
  EXAMPLE ONLY (design-system/components): not production code. Reka UI Select (exports checked against
  reka-ui 2.8.2) styled with the TailAdmin input recipe from src/components/forms/FormElements/SelectInput.vue
  and InputState.vue (MIT, © TailAdmin, see ../LICENSE-TailAdmin.md), with the final Backoffice values of
  docs/component-specs.md (FIELD, FIELD_INVALID, FIELD_DISABLED, FOCUS): gray-500 border and placeholder, error-600
  text, focus-visible outline, linked label, hint/error and the empty state.
-->
<script setup lang="ts">
import { computed, useId } from 'vue';
import {
	SelectContent,
	SelectItem,
	SelectItemIndicator,
	SelectItemText,
	SelectPortal,
	SelectRoot,
	SelectTrigger,
	SelectValue,
	SelectViewport,
} from 'reka-ui';

const props = defineProps<{
	modelValue?: string;
	options: Array<{ label: string; value: string; disabled?: boolean }>;
	label: string;
	placeholder?: string;
	hint?: string;
	error?: string;
	disabled?: boolean;
	required?: boolean;
	emptyText?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const id = useId();
const messageId = `${id}-message`;
const message = computed(() => props.error || props.hint);

const triggerClass = computed(() => [
	'flex h-11 w-full items-center justify-between gap-2 rounded-lg border bg-transparent px-4 py-2.5 text-start text-sm text-gray-800 shadow-theme-xs',
	'focus:outline-hidden focus:ring-3 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-gray-900 dark:text-white/90',
	'data-[placeholder]:text-gray-500 dark:data-[placeholder]:text-gray-400',
	'disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:border-gray-800 dark:disabled:bg-white/[0.03]',
	props.error
		? 'border-error-600 focus:border-error-600 focus:ring-error-500/10 focus-visible:outline-error-600 dark:border-error-400 dark:focus:border-error-400 dark:focus-visible:outline-error-400'
		: 'border-gray-500 focus:border-brand-500 focus:ring-brand-500/10 focus-visible:outline-brand-500 dark:border-gray-500 dark:focus:border-brand-400 dark:focus-visible:outline-brand-400',
]);
</script>

<template>
	<div>
		<label
			:for="id"
			class="mb-1.5 block text-sm font-medium"
			:class="disabled ? 'text-gray-300 dark:text-white/15' : 'text-gray-700 dark:text-gray-400'"
		>
			{{ label }}
			<span v-if="required" class="text-error-600 dark:text-error-400" aria-hidden="true">*</span>
		</label>

		<SelectRoot
			:model-value="modelValue"
			:disabled="disabled"
			:required="required"
			@update:model-value="(value) => emit('update:modelValue', String(value))"
		>
			<SelectTrigger
				:id="id"
				:class="triggerClass"
				:aria-invalid="error ? 'true' : undefined"
				:aria-describedby="message ? messageId : undefined"
			>
				<SelectValue :placeholder="placeholder" class="truncate" />
				<svg
					class="size-5 shrink-0 stroke-current text-gray-500 dark:text-gray-400"
					viewBox="0 0 20 20"
					fill="none"
					aria-hidden="true"
				>
					<path
						d="M4.79175 7.396L10.0001 12.6043L15.2084 7.396"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</SelectTrigger>

			<SelectPortal>
				<!-- Panel recipe: TailAdmin DropdownMenu (rounded-2xl, border, shadow, dark:bg-gray-dark). -->
				<SelectContent
					position="popper"
					:side-offset="4"
					class="z-99999 max-h-(--reka-select-content-available-height) min-w-(--reka-select-trigger-width) overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
				>
					<SelectViewport class="custom-scrollbar">
						<p v-if="!options.length" class="px-3 py-2 text-theme-sm text-gray-500 dark:text-gray-400">
							{{ emptyText ?? 'No options' }}
						</p>
						<SelectItem
							v-for="option in options"
							:key="option.value"
							:value="option.value"
							:disabled="option.disabled"
							class="relative flex cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-theme-sm font-medium text-gray-700 outline-hidden data-[highlighted]:bg-gray-100 data-[state=checked]:bg-brand-50 data-[state=checked]:text-brand-600 data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 dark:text-gray-300 dark:data-[highlighted]:bg-white/5 dark:data-[state=checked]:bg-brand-500/15 dark:data-[state=checked]:text-brand-400 dark:data-[disabled]:text-white/15"
						>
							<SelectItemText>{{ option.label }}</SelectItemText>
							<SelectItemIndicator aria-hidden="true">
								<svg class="size-4 stroke-current" viewBox="0 0 14 14" fill="none">
									<path
										d="M11.6666 3.5L5.24992 9.91667L2.33325 7"
										stroke-width="1.94"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							</SelectItemIndicator>
						</SelectItem>
					</SelectViewport>
				</SelectContent>
			</SelectPortal>
		</SelectRoot>

		<p
			v-if="message"
			:id="messageId"
			class="mt-1.5 text-theme-xs"
			:class="error ? 'text-error-600 dark:text-error-400' : 'text-gray-500 dark:text-gray-400'"
		>
			{{ message }}
		</p>
	</div>
</template>
