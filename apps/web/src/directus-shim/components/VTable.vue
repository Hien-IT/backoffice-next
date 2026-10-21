<!-- Ported from directus/app/src/components/v-table/v-table.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): v-table on BoTable. Headers `{ text, value, ... }` become columns
// `{ label, key, ... }` and back on `update:headers` (the caller's header objects with the new width and order); items
// are the rows, `itemKey` the row key. BoTable selects by key; Directus selects row objects unless `selectionUseKeys`,
// so the selection is mapped both ways here, with `item-selected` for each row that changed (onItemSelected). Rows are
// clickable (and focusable) when `clickable` and not `disabled`, as v-table (BoTable `clickable`). Slot props are the Directus ones
// (`header` for the header slots, `item` for the cells); `footer` goes below the table. `inline` has no effect: BoTable
// is always the bordered box of an inline v-table.
import { computed } from 'vue';
import BoTable, { type BoTableColumn } from '../../components/BoTable.vue';

// Directus v-table.vue:370-374, table-header.vue:406: a height given by the extension scrolls the table, the header
// sticks at the offset hook (with fixedHeader the inner BoTable box scrolls instead).
type Alignment = 'left' | 'center' | 'right';
type HeaderRaw = {
	text: string;
	value: string;
	description?: string | null;
	align?: Alignment;
	sortable?: boolean;
	width?: number | null;
	[key: string]: any;
};
type Item = Record<string, any>;
type Key = string | number;
type Sort = { by: string | null; desc: boolean };

const props = withDefaults(
	defineProps<{
		headers: HeaderRaw[];
		items: Item[];
		itemKey?: string;
		sort?: Sort | null | undefined;
		mustSort?: boolean;
		showSelect?: 'none' | 'one' | 'multiple';
		showResize?: boolean;
		showManualSort?: boolean;
		manualSortKey?: string | undefined;
		allowHeaderReorder?: boolean;
		modelValue?: any[];
		fixedHeader?: boolean;
		loading?: boolean;
		loadingText?: string | undefined;
		noItemsText?: string | undefined;
		rowHeight?: number;
		selectionUseKeys?: boolean;
		inline?: boolean;
		disabled?: boolean;
		clickable?: boolean;
	}>(),
	{
		itemKey: 'id',
		sort: undefined,
		mustSort: false,
		showSelect: 'none',
		showResize: false,
		showManualSort: false,
		manualSortKey: undefined,
		allowHeaderReorder: false,
		modelValue: () => [],
		fixedHeader: false,
		loading: false,
		loadingText: undefined,
		noItemsText: undefined,
		rowHeight: 48,
		selectionUseKeys: false,
		inline: false,
		disabled: false,
		clickable: true,
	},
);

const emit = defineEmits([
	'click:row',
	'update:sort',
	'update:items',
	'item-selected',
	'update:modelValue',
	'manual-sort',
	'update:headers',
]);

// v-table HeaderDefaults
const toHeader = (header: HeaderRaw) => ({
	align: 'left' as Alignment,
	sortable: true,
	width: null,
	description: null,
	...header,
});

const columns = computed<BoTableColumn[]>(() =>
	props.headers.map((header) => ({
		key: header.value,
		label: header.text,
		width: header.width ?? null,
		align: header.align ?? 'left',
		sortable: header.sortable ?? true,
		description: header.description ?? null,
	})),
);

function onUpdateColumns(next: BoTableColumn[]) {
	emit(
		'update:headers',
		next.map((column) => {
			const header = props.headers.find((existing) => existing.value === column.key)!;
			return column.width === (header.width ?? null) ? header : { ...header, width: column.width };
		}),
	);
}

// An unsaved row (no key, only `$index`) is matched by `$index`, as v-table itemHasNoKeyYet.
const keyOf = (item: Item): Key => item[props.itemKey] ?? item['$index'];

const selectedKeys = computed<Key[]>(() =>
	props.selectionUseKeys ? props.modelValue : props.modelValue.map((item: Item) => keyOf(item)),
);

function onUpdateSelection(keys: Key[]) {
	const before = new Set(selectedKeys.value);
	const after = new Set(keys);

	for (const item of props.items) {
		const key = keyOf(item);
		if (before.has(key) !== after.has(key)) emit('item-selected', { item, value: after.has(key) });
	}

	if (props.selectionUseKeys) return emit('update:modelValue', keys);

	// Keep the selected objects the caller holds (rows of another page), add the rows picked here.
	const known = new Map<Key, Item>(props.modelValue.map((item: Item) => [keyOf(item), item]));
	for (const item of props.items) if (!known.has(keyOf(item))) known.set(keyOf(item), item);

	emit(
		'update:modelValue',
		keys.map((key) => known.get(key)),
	);
}

function slotProps(name: string, scope: Record<string, any>) {
	if (name.startsWith('header.') || name === 'header-context-menu') {
		const header = props.headers.find((existing) => existing.value === scope['column']?.key);
		return { header: header ? toHeader(header) : scope['column'] };
	}

	return scope;
}
</script>

<template>
	<div
		class="v-table relative overflow-y-auto [&_thead]:top-(--v-table-sticky-offset-top,0)"
		:class="fixedHeader ? 'flex max-h-full min-h-0 flex-col' : undefined"
	>
		<BoTable
			:columns="columns"
			:rows="items"
			:row-key="itemKey"
			:sort="sort ?? null"
			:must-sort="mustSort"
			:show-select="showSelect"
			:show-resize="showResize"
			:show-manual-sort="showManualSort"
			:manual-sort-key="manualSortKey"
			:allow-header-reorder="allowHeaderReorder"
			:model-value="selectedKeys"
			:fixed-header="fixedHeader"
			:loading="loading"
			:loading-text="loadingText"
			:no-items-text="noItemsText"
			:row-height="rowHeight"
			:disabled="disabled"
			:clickable="clickable"
			@click:row="$emit('click:row', $event)"
			@update:model-value="onUpdateSelection"
			@update:sort="$emit('update:sort', $event)"
			@update:columns="onUpdateColumns"
			@update:rows="$emit('update:items', $event)"
			@manual-sort="$emit('manual-sort', $event)"
		>
			<template v-for="(_, name) in $slots" #[name]="scope">
				<slot v-if="name !== 'footer'" :name="name" v-bind="slotProps(String(name), scope || {})" />
			</template>
		</BoTable>
		<slot name="footer" />
	</div>
</template>
