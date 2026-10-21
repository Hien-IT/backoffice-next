<script setup lang="ts">
import {
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectItemIndicator,
	SelectItemText,
	SelectLabel,
	SelectPortal,
	SelectRoot,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
	SelectViewport,
} from 'reka-ui';
import { computed, ref, useId } from 'vue';
import BoIcon from './BoIcon.vue';

/** `color`: a color dot (or the icon color); `children`: a group (spec 020 VSelect, recipe "Select groups"), whose
 * header is a choice too when `selectable`; `divider`: a separator in place of the item (its text and value unused). */
export type BoSelectItem = {
	text: string;
	value: string;
	icon?: string | undefined;
	color?: string | null | undefined;
	disabled?: boolean | undefined;
	selectable?: boolean | undefined;
	children?: BoSelectItem[] | null | undefined;
	divider?: boolean | undefined;
};
type Row = { kind: 'item' | 'label' | 'divider'; item: BoSelectItem; depth: number };

const {
	modelValue,
	items,
	disabled = false,
	id: idProp,
	showDeselect = false,
} = defineProps<{
	modelValue?: string | null;
	/** `icon`: an icon before the text, in the list and in the trigger (Directus v-select `item-icon`). */
	items: BoSelectItem[];
	/** Directus v-select `show-deselect`: a "Deselect" row first, which emits `deselect`. */
	showDeselect?: boolean;
	label?: string;
	placeholder?: string;
	disabled?: boolean;
	/** Id of the trigger, for a label outside the component (a form field). */
	id?: string | undefined;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string]; deselect: [] }>();

/** Open state; with the `trigger` slot ({ open, toggle }) the caller renders its own trigger (spec 020 VSelect preview). */
const open = defineModel<boolean>('open', { default: false });
const anchor = ref<HTMLElement>();

// Reka Select items cannot have an empty value: the "Deselect" row uses this one and emits `deselect`.
const DESELECT = '__bo_deselect__';
const findItem = (list: BoSelectItem[]): BoSelectItem | undefined => {
	for (const item of list.filter((choice) => !choice.divider)) {
		const found = item.value === modelValue ? item : item.children && findItem(item.children);
		if (found) return found;
	}
	return undefined;
};
// The trigger shows the chosen item with its icon (Directus v-select): Reka SelectValue would print the item text
// content, where an icon is its ligature name ("table_rows Table").
const selectedItem = computed(() => findItem(items));

/** A group and its nested groups as rows: the header (a choice when `selectable`), then its children indented. */
function groupRows(item: BoSelectItem, depth: number): Row[] {
	return [
		{ kind: item.selectable ? 'item' : 'label', item, depth },
		...item.children!.flatMap((child): Row[] =>
			child.children
				? groupRows(child, depth + 1)
				: [{ kind: child.divider ? 'divider' : 'item', item: child, depth: depth + 1 }],
		),
	];
}

function toggle() {
	if (!disabled && items.length > 0) open.value = !open.value;
}

// With a caller trigger, focus goes back to it (Reka would focus its hidden trigger).
function onCloseAutoFocus(event: Event) {
	if (!anchor.value) return;
	event.preventDefault();
	(
		anchor.value.querySelector<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])') ?? anchor.value
	).focus();
}

const onUpdate = (value: unknown) => (value === DESELECT ? emit('deselect') : emit('update:modelValue', String(value)));

const id = idProp ?? useId();

const ITEM =
	'relative flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-theme-sm font-medium text-gray-700 outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 data-[highlighted]:bg-gray-100 data-[state=checked]:bg-brand-50 data-[state=checked]:text-brand-600 dark:text-gray-300 dark:data-[disabled]:text-white/15 dark:data-[highlighted]:bg-white/5 dark:data-[state=checked]:bg-brand-500/15 dark:data-[state=checked]:text-brand-400';
// Recipe "Select groups" (component-specs, Q-44): group label and the 10 px color dot.
const LABEL = 'px-3 pt-2 pb-1 text-theme-xs font-medium uppercase text-gray-500 dark:text-gray-400';
const DOT = 'size-2.5 shrink-0 rounded-full';
// component-specs Select trigger = FIELD + FIELD_DISABLED.
const TRIGGER =
	'flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-gray-500 bg-transparent px-4 py-2.5 text-start text-sm text-gray-800 shadow-theme-xs focus:border-brand-500 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400 data-[placeholder]:text-gray-500 dark:border-gray-500 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-400 dark:data-[placeholder]:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:border-gray-800 dark:disabled:bg-white/[0.03]';
</script>

<template>
	<div>
		<label v-if="label" :for="id" class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">
			{{ label }}
		</label>
		<!-- No items: nothing to choose, so the trigger is disabled (empty state). -->
		<SelectRoot
			v-model:open="open"
			:model-value="modelValue ?? ''"
			:disabled="disabled || items.length === 0"
			@update:model-value="onUpdate"
		>
			<template v-if="$slots['trigger']">
				<div ref="anchor" class="inline-block max-w-full">
					<slot name="trigger" :open="open" :toggle="toggle" />
				</div>
				<!-- Positions the list on the caller trigger; not reachable (the caller trigger is). -->
				<SelectTrigger v-bind="anchor ? { reference: anchor } : {}" tabindex="-1" aria-hidden="true" class="sr-only" />
			</template>
			<SelectTrigger v-else :id="id" :class="TRIGGER">
				<span v-if="$slots['prepend']" data-prepend class="flex text-gray-500 dark:text-gray-400">
					<slot name="prepend" />
				</span>
				<SelectValue :placeholder="placeholder ?? ''" class="flex min-w-0 flex-1 items-center gap-2 truncate">
					<template v-if="selectedItem">
						<BoIcon
							v-if="selectedItem.icon"
							:name="selectedItem.icon"
							size="sm"
							class="shrink-0"
							:style="selectedItem.color ? { color: selectedItem.color } : {}"
						/>
						<span
							v-else-if="selectedItem.color"
							:class="DOT"
							:style="{ backgroundColor: selectedItem.color }"
							aria-hidden="true"
						/>
						<span class="truncate">{{ selectedItem.text }}</span>
					</template>
					<template v-else>{{ placeholder ?? '' }}</template>
				</SelectValue>
				<BoIcon name="expand_more" size="sm" class="text-gray-500 dark:text-gray-400" />
				<slot name="append" />
			</SelectTrigger>
			<SelectPortal>
				<SelectContent
					position="popper"
					:side-offset="4"
					class="z-99999 max-h-(--reka-select-content-available-height) min-w-(--reka-select-trigger-width) overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
					@close-auto-focus="onCloseAutoFocus"
				>
					<SelectViewport class="custom-scrollbar">
						<template v-if="showDeselect">
							<SelectItem :value="DESELECT" :disabled="!modelValue" :class="ITEM">
								<SelectItemText>{{ $t('deselect') }}</SelectItemText>
								<BoIcon name="close" size="sm" />
							</SelectItem>
							<SelectSeparator class="my-1 h-px bg-gray-200 dark:bg-gray-800" />
						</template>
						<template v-for="(item, index) in items" :key="item.divider ? `divider-${index}` : item.value">
							<SelectSeparator v-if="item.divider" class="my-1 h-px bg-gray-200 dark:bg-gray-800" />
							<SelectGroup v-else-if="item.children">
								<template v-for="(row, rowIndex) in groupRows(item, 0)" :key="rowIndex">
									<SelectSeparator v-if="row.kind === 'divider'" class="my-1 h-px bg-gray-200 dark:bg-gray-800" />
									<SelectLabel
										v-else-if="row.kind === 'label'"
										:class="LABEL"
										:style="{ paddingInlineStart: `${0.75 + row.depth}rem` }"
									>
										{{ row.item.text }}
									</SelectLabel>
									<SelectItem
										v-else
										:value="row.item.value"
										:disabled="!!row.item.disabled"
										:class="ITEM"
										:style="{ paddingInlineStart: `${0.75 + row.depth}rem` }"
									>
										<SelectItemText class="flex items-center gap-2">
											<BoIcon
												v-if="row.item.icon"
												:name="row.item.icon"
												size="sm"
												class="shrink-0 text-gray-500 dark:text-gray-400"
												:style="row.item.color ? { color: row.item.color } : {}"
											/>
											<span
												v-else-if="row.item.color"
												:class="DOT"
												:style="{ backgroundColor: row.item.color }"
												aria-hidden="true"
											/>
											{{ row.item.text }}
										</SelectItemText>
										<SelectItemIndicator><BoIcon name="check" size="sm" /></SelectItemIndicator>
									</SelectItem>
								</template>
							</SelectGroup>
							<SelectItem v-else :value="item.value" :disabled="!!item.disabled" :class="ITEM">
								<SelectItemText class="flex items-center gap-2">
									<BoIcon
										v-if="item.icon"
										:name="item.icon"
										size="sm"
										class="shrink-0"
										:style="item.color ? { color: item.color } : {}"
									/>
									<span
										v-else-if="item.color"
										:class="DOT"
										:style="{ backgroundColor: item.color }"
										aria-hidden="true"
									/>
									{{ item.text }}
								</SelectItemText>
								<SelectItemIndicator><BoIcon name="check" size="sm" /></SelectItemIndicator>
							</SelectItem>
						</template>
					</SelectViewport>
				</SelectContent>
			</SelectPortal>
		</SelectRoot>
	</div>
</template>
