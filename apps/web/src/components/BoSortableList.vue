<script setup lang="ts" generic="T">
// SortableList row menu recipe (component-specs Tier 3, D-60): vuedraggable with a drag handle as the Directus list
// interfaces (`handle=".drag-handle"`, `force-fallback`), plus a row menu whose "Move up" / "Move down" emit the same
// `update:modelValue` array as a drag (WCAG 2.1.1). `tree` adds "Indent" / "Outdent", emitted as events for the
// tree view to change the parent. After a move, focus returns to the moved row's menu trigger and a live region
// says the new position.
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import Draggable from 'vuedraggable';
import BoIcon from './BoIcon.vue';
import BoMenu, { type BoMenuItem } from './BoMenu.vue';

const props = withDefaults(
	defineProps<{
		modelValue: T[];
		/** Property name or function giving a stable key per item (vuedraggable `item-key`). */
		itemKey: string | ((item: T) => string | number);
		/** No dragging and no move items (sorting off, disabled or non-editable field). */
		disabled?: boolean;
		/** Adds "Indent" / "Outdent" (tree view). */
		tree?: boolean;
		/** This list is below the tree root: "Outdent" is available. */
		nested?: boolean;
		/** Name of a row for the menu label and the announcement (default: its position). */
		itemLabel?: ((item: T, index: number) => string) | undefined;
		/** Row actions of the interface, shown before the move items. */
		rowActions?: ((item: T, index: number) => BoMenuItem[]) | undefined;
	}>(),
	{ disabled: false, tree: false, nested: false, itemLabel: undefined, rowActions: undefined },
);

const emit = defineEmits<{
	'update:modelValue': [value: T[]];
	indent: [index: number];
	outdent: [index: number];
}>();

defineSlots<{ item(props: { element: T; index: number }): unknown }>();

const { t } = useI18n();

const announcement = ref('');
const root = ref<HTMLElement>();

const items = computed({
	get: () => props.modelValue,
	set: (value: T[]) => emit('update:modelValue', value),
});

function keyOf(item: T): string | number {
	return typeof props.itemKey === 'function'
		? props.itemKey(item)
		: (item as Record<string, string | number>)[props.itemKey]!;
}

function labelOf(item: T, index: number): string {
	return props.itemLabel?.(item, index) ?? String(index + 1);
}

function menuItems(item: T, index: number): BoMenuItem[] {
	const actions = props.rowActions?.(item, index) ?? [];

	if (props.disabled) return actions;

	const last = props.modelValue.length - 1;

	const moves: BoMenuItem[] = [
		{ text: t('move_up'), icon: 'arrow_upward', disabled: index === 0, onSelect: () => move(index, index - 1) },
		{ text: t('move_down'), icon: 'arrow_downward', disabled: index === last, onSelect: () => move(index, index + 1) },
	];

	if (props.tree) {
		moves.push(
			{
				text: t('indent_item'),
				icon: 'format_indent_increase',
				disabled: index === 0,
				onSelect: () => emit('indent', index),
			},
			{
				text: t('outdent_item'),
				icon: 'format_indent_decrease',
				disabled: !props.nested,
				onSelect: () => emit('outdent', index),
			},
		);
	}

	return [...actions, ...moves];
}

async function move(from: number, to: number) {
	const next = [...props.modelValue];
	const [item] = next.splice(from, 1) as [T];
	next.splice(to, 0, item);

	emit('update:modelValue', next);
	announcement.value = t('moved_to_position', { item: labelOf(item, from), position: to + 1, total: next.length });

	// The row element is kept (keyed) and moved; Reka also focuses the trigger when the menu closes.
	await nextTick();
	const key = String(keyOf(item));
	root.value?.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(key)}"] .row-menu`)?.focus();
}

const ICON_BTN =
	'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div ref="root">
		<Draggable
			v-model="items"
			tag="ul"
			class="space-y-2"
			:item-key="itemKey"
			handle=".drag-handle"
			:disabled="disabled"
			ghost-class="shadow-theme-lg"
			chosen-class="opacity-50"
			v-bind="{ 'force-fallback': true }"
		>
			<template #item="{ element, index }">
				<li
					:data-row-key="keyOf(element)"
					class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-white/[0.03]"
				>
					<BoIcon
						v-if="!disabled"
						name="drag_handle"
						size="sm"
						class="drag-handle cursor-grab text-gray-500 dark:text-gray-400"
					/>
					<div class="min-w-0 flex-1">
						<slot name="item" :element="element" :index="index" />
					</div>
					<BoMenu v-if="menuItems(element, index).length > 0" :items="menuItems(element, index)" align="end">
						<template #trigger>
							<button
								type="button"
								class="row-menu"
								:class="ICON_BTN"
								:aria-label="t('item_options', { item: labelOf(element, index) })"
							>
								<BoIcon name="more_vert" size="sm" />
							</button>
						</template>
					</BoMenu>
				</li>
			</template>
		</Draggable>
		<div class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</div>
	</div>
</template>
