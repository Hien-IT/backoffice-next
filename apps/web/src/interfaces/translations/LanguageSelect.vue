<!-- Ported from directus/app/src/interfaces/translations/language-select.vue -->
<script setup lang="ts">
// Backoffice: the Directus activator is one button holding the prepend and controls icons (nested interactive
// elements); here the bar is a row with the prepend slot, the menu trigger (language name and chevron) and the
// controls slot as siblings, so each control is its own focusable button. Menu: Reka DropdownMenu.
import {
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuRoot,
	DropdownMenuTrigger,
} from 'reka-ui';
import { computed, ref, useId } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import BoProgressLinear from '../../components/BoProgressLinear.vue';

// Backoffice: the Directus `Record<string, any>` items with their known keys named (strict index access).
export type LanguageOption = {
	[key: string]: any;
	text?: any;
	direction?: any;
	value?: any;
	edited?: boolean;
	progress?: number;
	max?: number;
	current?: number;
};

const props = withDefaults(
	defineProps<{
		modelValue?: string | undefined;
		items?: LanguageOption[];
		disabled?: boolean | undefined;
		nonEditable?: boolean | undefined;
		secondary?: boolean | undefined;
		danger?: boolean | undefined;
		/** Backoffice: form linking of the trigger (FORM_FIELD_A11Y): `aria-labelledby` gets the value appended. */
		triggerAttrs?: Record<string, unknown> | undefined;
	}>(),
	{
		modelValue: undefined,
		items: () => [],
		disabled: false,
		nonEditable: false,
		secondary: false,
		danger: false,
		triggerAttrs: () => ({}),
	},
);

defineEmits(['update:modelValue']);

const active = ref(false);

const valueId = useId();

const triggerA11y = computed(() => {
	const labelledby = props.triggerAttrs['aria-labelledby'];
	return { ...props.triggerAttrs, 'aria-labelledby': labelledby ? `${labelledby} ${valueId}` : undefined };
});

const displayValue = computed(() => {
	const item = props.items.find((item) => item.value === props.modelValue);
	return item?.text ?? props.modelValue;
});

const barClass = computed(() => {
	if (props.disabled && !props.nonEditable)
		return 'cursor-not-allowed bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400';
	if (props.danger) return 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400';
	if (props.secondary) return 'bg-blue-light-50 text-blue-light-700 dark:bg-blue-light-500/15 dark:text-blue-light-400';
	return 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400';
});

const percent = (item: LanguageOption) => `${Math.round(((item.current ?? 0) / (item.max ?? 0)) * 100)}%`;

function toggle() {
	active.value = !active.value;
}
</script>

<template>
	<DropdownMenuRoot v-model:open="active">
		<div class="flex h-11 w-full items-center gap-1 rounded-lg ps-2 pe-1" :class="barClass">
			<slot name="prepend" />
			<DropdownMenuTrigger
				v-bind="triggerA11y"
				:disabled="!!disabled && !nonEditable"
				class="flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-start text-sm font-medium disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
			>
				<span :id="valueId" class="min-w-0 flex-1 truncate" data-testid="display-value">{{ displayValue }}</span>
				<BoIcon
					name="expand_more"
					size="sm"
					class="transition-transform motion-reduce:transition-none"
					:class="{ '-scale-y-100': active }"
				/>
			</DropdownMenuTrigger>
			<span class="flex items-center gap-1"><slot name="controls" :active :toggle /></span>
		</div>

		<DropdownMenuPortal>
			<DropdownMenuContent
				align="start"
				:side-offset="4"
				class="z-99999 max-h-(--reka-dropdown-menu-content-available-height) min-w-(--reka-dropdown-menu-trigger-width) space-y-1 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
			>
				<DropdownMenuItem
					v-for="(item, index) in items"
					:key="index"
					class="flex w-full cursor-pointer items-center justify-between gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-theme-sm font-medium text-gray-700 outline-hidden data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-800 dark:text-gray-400 dark:data-[highlighted]:bg-white/5 dark:data-[highlighted]:text-gray-300"
					@select="$emit('update:modelValue', item.value)"
				>
					<span class="flex flex-1 items-center">
						<span
							class="me-1.5 inline-block h-1 w-1 rounded-sm"
							:class="{ 'bg-gray-500': item.edited }"
							aria-hidden="true"
						/>
						{{ item.text }}
						<span v-if="item.edited" class="sr-only">({{ $t('edited') }})</span>
					</span>
					<span class="flex w-24 items-center" :title="percent(item)">
						<BoProgressLinear
							:value="item.progress ?? 0"
							:aria-label="`${item.text ?? item.value}: ${percent(item)}`"
							class="rounded-full"
						/>
					</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenuPortal>
	</DropdownMenuRoot>
</template>
