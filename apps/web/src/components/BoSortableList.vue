<script setup lang="ts" generic="T">
// SortableList row menu recipe (component-specs Tier 3, D-60): vuedraggable with a drag handle as the Directus list
// interfaces (`handle=".drag-handle"`, `force-fallback`), plus a row menu whose "Move up" / "Move down" emit the same
// `update:modelValue` array as a drag (WCAG 2.1.1). `tree` adds "Indent" / "Outdent", emitted as events for the
// tree view to change the parent. After a move, focus returns to the moved row's menu trigger and a live region
// says the new position. `group` shares a vuedraggable group between nested lists (mouse drag across levels, whose
// `added` / `removed` vuedraggable `change` events are passed on); `update:modelValue` is only a reorder inside the
// list. `itemDisabled` rows (e.g. deleted ones) cannot be dragged or moved (Directus `draggable=".draggable"`).
import { moveInArray } from '@directus/utils';
import { nextTick, ref } from 'vue';
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
		/** vuedraggable `group`: lists with the same group exchange rows by mouse drag. */
		group?: string | undefined;
		/** Rows that cannot be dragged or moved. */
		itemDisabled?: ((item: T) => boolean) | undefined;
		/** Classes of the list (default a vertical stack; the field grid of 016 uses a two-column grid). */
		listClass?: string;
		/** Extra classes of a row (e.g. its column span in a grid). */
		rowClass?: ((item: T) => string | undefined) | undefined;
		/** "Indent" is enabled for this row (default: any row but the first). */
		canIndent?: ((item: T, index: number) => boolean) | undefined;
	}>(),
	{
		disabled: false,
		tree: false,
		nested: false,
		itemLabel: undefined,
		rowActions: undefined,
		group: undefined,
		itemDisabled: undefined,
		listClass: 'space-y-2',
		rowClass: undefined,
		canIndent: undefined,
	},
);

/** The vuedraggable `change` event. */
type SortableChange<T> =
	| { added: { newIndex: number; element: T } }
	| { removed: { oldIndex: number; element: T } }
	| { moved: { oldIndex: number; newIndex: number; element: T } };

const emit = defineEmits<{
	'update:modelValue': [value: T[]];
	indent: [index: number];
	outdent: [index: number];
	change: [event: SortableChange<T>];
}>();

defineSlots<{ item(props: { element: T; index: number }): unknown }>();

const { t } = useI18n();

const announcement = ref('');
const root = ref<HTMLElement>();

function onChange(event: SortableChange<T>) {
	if ('moved' in event) {
		emit('update:modelValue', moveInArray(props.modelValue, event.moved.oldIndex, event.moved.newIndex));
	}

	emit('change', event);
}

function draggable(item: T): boolean {
	return !props.disabled && !props.itemDisabled?.(item);
}

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

	if (!draggable(item)) return actions;

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
				disabled: props.canIndent ? !props.canIndent(item, index) : index === 0,
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
			:model-value="modelValue"
			tag="ul"
			:class="[listClass, { 'min-h-3': group }]"
			:item-key="itemKey"
			handle=".drag-handle"
			draggable=".draggable"
			:group="group"
			:disabled="disabled"
			ghost-class="shadow-theme-lg"
			chosen-class="opacity-50"
			v-bind="{ 'force-fallback': true }"
			@change="onChange"
		>
			<template #item="{ element, index }">
				<li
					:data-row-key="keyOf(element)"
					class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-white/[0.03]"
					:class="[{ draggable: draggable(element) }, rowClass?.(element)]"
				>
					<BoIcon
						v-if="draggable(element)"
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
