<script setup lang="ts">
import {
	SelectContent,
	SelectItem,
	SelectItemIndicator,
	SelectItemText,
	SelectPortal,
	SelectRoot,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
	SelectViewport,
} from 'reka-ui';
import { computed, useId } from 'vue';
import BoIcon from './BoIcon.vue';

const {
	modelValue,
	items,
	disabled = false,
	id: idProp,
	showDeselect = false,
} = defineProps<{
	modelValue?: string | null;
	/** `icon`: an icon before the text, in the list and in the trigger (Directus v-select `item-icon`). */
	items: { text: string; value: string; icon?: string; disabled?: boolean }[];
	/** Directus v-select `show-deselect`: a "Deselect" row first, which emits `deselect`. */
	showDeselect?: boolean;
	label?: string;
	placeholder?: string;
	disabled?: boolean;
	/** Id of the trigger, for a label outside the component (a form field). */
	id?: string | undefined;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string]; deselect: [] }>();

// Reka Select items cannot have an empty value: the "Deselect" row uses this one and emits `deselect`.
const DESELECT = '__bo_deselect__';
// The trigger shows the chosen item with its icon (Directus v-select): Reka SelectValue would print the item text
// content, where an icon is its ligature name ("table_rows Table").
const selectedItem = computed(() => items.find((item) => item.value === modelValue));

const onUpdate = (value: unknown) => (value === DESELECT ? emit('deselect') : emit('update:modelValue', String(value)));

const id = idProp ?? useId();

const ITEM =
	'relative flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-theme-sm font-medium text-gray-700 outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 data-[highlighted]:bg-gray-100 data-[state=checked]:bg-brand-50 data-[state=checked]:text-brand-600 dark:text-gray-300 dark:data-[disabled]:text-white/15 dark:data-[highlighted]:bg-white/5 dark:data-[state=checked]:bg-brand-500/15 dark:data-[state=checked]:text-brand-400';
// component-specs Select trigger = FIELD + FIELD_DISABLED.
const TRIGGER =
	'flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-gray-500 bg-transparent px-4 py-2.5 text-start text-sm text-gray-800 shadow-theme-xs focus:border-brand-500 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400 data-[placeholder]:text-gray-500 dark:border-gray-500 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-400 dark:data-[placeholder]:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:border-gray-800 dark:disabled:bg-white/[0.03]';
</script>

<template>
	<div>
		<label v-if="label" :for="id" class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
			{{ label }}
		</label>
		<!-- No items: nothing to choose, so the trigger is disabled (empty state). -->
		<SelectRoot
			:model-value="modelValue ?? ''"
			:disabled="disabled || items.length === 0"
			@update:model-value="onUpdate"
		>
			<SelectTrigger :id="id" :class="TRIGGER">
				<SelectValue :placeholder="placeholder ?? ''" class="flex min-w-0 items-center gap-2 truncate">
					<template v-if="selectedItem">
						<BoIcon v-if="selectedItem.icon" :name="selectedItem.icon" size="sm" class="shrink-0" />
						<span class="truncate">{{ selectedItem.text }}</span>
					</template>
					<template v-else>{{ placeholder ?? '' }}</template>
				</SelectValue>
				<BoIcon name="expand_more" size="sm" class="text-gray-500 dark:text-gray-400" />
			</SelectTrigger>
			<SelectPortal>
				<SelectContent
					position="popper"
					:side-offset="4"
					class="z-99999 max-h-(--reka-select-content-available-height) min-w-(--reka-select-trigger-width) overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
				>
					<SelectViewport class="custom-scrollbar">
						<template v-if="showDeselect">
							<SelectItem :value="DESELECT" :disabled="!modelValue" :class="ITEM">
								<SelectItemText>{{ $t('deselect') }}</SelectItemText>
								<BoIcon name="close" size="sm" />
							</SelectItem>
							<SelectSeparator class="my-1 h-px bg-gray-200 dark:bg-gray-800" />
						</template>
						<SelectItem
							v-for="item in items"
							:key="item.value"
							:value="item.value"
							:disabled="!!item.disabled"
							:class="ITEM"
						>
							<SelectItemText class="flex items-center gap-2">
								<BoIcon v-if="item.icon" :name="item.icon" size="sm" class="shrink-0" />
								{{ item.text }}
							</SelectItemText>
							<SelectItemIndicator><BoIcon name="check" size="sm" /></SelectItemIndicator>
						</SelectItem>
					</SelectViewport>
				</SelectContent>
			</SelectPortal>
		</SelectRoot>
	</div>
</template>
