<!-- Ported from directus/app/src/components/v-table/v-table.vue -->
<script setup lang="ts">
// Backoffice: the simple Table recipe (component-specs "Table, simple"): a real <table> with columns
// { key, label, width, align, sortable }, selection by row key (Directus `selectionUseKeys`), sort and mouse resize
// as v-table / table-header (no keyboard resize, not in Directus), row heights of the Directus `spacing`, manual sort
// (drag handle column, `update:rows` with the reordered rows as v-table `update:items`; mouse only as in Directus, the
// callers give a keyboard path), `click:row` and the `item-append` / `header-append` slots. Header reordering comes
// with the screens that use it (014).
import { useEventListener } from '@vueuse/core';
import { throttle } from 'lodash-es';
import { computed, getCurrentInstance, ref, useSlots } from 'vue';
import Draggable from 'vuedraggable';
import BoCheckbox from './BoCheckbox.vue';
import BoIcon from './BoIcon.vue';
import BoProgressLinear from './BoProgressLinear.vue';

export type BoTableColumn = {
	key: string;
	label: string;
	width?: number | null;
	align?: 'left' | 'center' | 'right';
	sortable?: boolean;
};

export type BoTableSort = { by: string | null; desc: boolean };

type Row = Record<string, any>;
type Key = string | number;

const props = withDefaults(
	defineProps<{
		columns: BoTableColumn[];
		rows: Row[];
		rowKey?: string;
		sort?: BoTableSort | null;
		mustSort?: boolean;
		showSelect?: 'none' | 'one' | 'multiple';
		showResize?: boolean;
		/** Selected row keys */
		modelValue?: Key[];
		loading?: boolean;
		loadingText?: string | undefined;
		noItemsText?: string | undefined;
		spacing?: 'compact' | 'cozy' | 'comfortable';
		caption?: string | undefined;
		disabled?: boolean;
		/** Shows the drag handle column and its header toggle (v-table `showManualSort`). */
		showManualSort?: boolean;
		/** Rows can be dragged while the table is sorted by this key (v-table `manualSortKey`). */
		manualSortKey?: string | undefined;
		/** Width in px of the `item-append` column (v-table sizes it to its content). */
		appendWidth?: number;
	}>(),
	{
		rowKey: 'id',
		sort: null,
		mustSort: false,
		showSelect: 'none',
		showResize: false,
		modelValue: () => [],
		loading: false,
		loadingText: undefined,
		noItemsText: undefined,
		spacing: 'cozy',
		caption: undefined,
		disabled: false,
		showManualSort: false,
		manualSortKey: undefined,
		appendWidth: 160,
	},
);

const emit = defineEmits<{
	'update:modelValue': [keys: Key[]];
	'update:sort': [sort: BoTableSort | null];
	'update:columns': [columns: BoTableColumn[]];
	'update:rows': [rows: Row[]];
	'click:row': [payload: { item: Row; event: Event }];
}>();

const slots = useSlots();
const hasItemAppendSlot = computed(() => slots['item-append'] !== undefined);

// v-table `clickable`: a row is clickable (and focusable) when the caller listens to `click:row`.
const instance = getCurrentInstance();
const hasClickListener = computed(() => !props.disabled && !!instance?.vnode.props?.['onClick:row']);

const ROW_HEIGHTS = { compact: 'h-[29px]', cozy: 'h-[43px]', comfortable: 'h-[58px]' };
const ALIGN = { left: 'text-start', center: 'text-center', right: 'text-end' };
const DEFAULT_WIDTH = 130; // 8.125rem, Directus default column width
const SELECT_WIDTH = 44;
const MANUAL_SORT_WIDTH = 40;
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';

const internalColumns = computed(() =>
	props.columns.map((column) => ({
		align: 'left' as const,
		sortable: true,
		...column,
		width: column.width ? Math.max(24, column.width) : DEFAULT_WIDTH,
	})),
);

const internalSort = computed<BoTableSort>(() => props.sort ?? { by: null, desc: false });

const showSelectColumn = computed(() => props.showSelect !== 'none' && !props.disabled);

const colSpan = computed(
	() =>
		internalColumns.value.length +
		1 +
		(showSelectColumn.value ? 1 : 0) +
		(props.showManualSort ? 1 : 0) +
		(hasItemAppendSlot.value ? 1 : 0),
);

const minWidth = computed(
	() =>
		internalColumns.value.reduce((sum, column) => sum + column.width, 0) +
		(showSelectColumn.value ? SELECT_WIDTH : 0) +
		(props.showManualSort ? MANUAL_SORT_WIDTH : 0) +
		(hasItemAppendSlot.value ? props.appendWidth : 0),
);

const sortedManually = computed(() => !!props.manualSortKey && internalSort.value.by === props.manualSortKey);

function rowKeyOf(row: Row): Key {
	return row[props.rowKey] ?? row['$index'];
}

// table-header.vue toggleManualSort
function toggleManualSort() {
	if (sortedManually.value) {
		emit('update:sort', null);
	} else {
		emit('update:sort', { by: props.manualSortKey!, desc: false });
	}
}

// v-table.vue row `@click` and table-row.vue onKeydown
function onRowClick(row: Row, event: Event) {
	if (hasClickListener.value) emit('click:row', { item: row, event });
}

function onRowKeydown(row: Row, event: KeyboardEvent) {
	if (event.metaKey) return;
	if ((event.target as HTMLElement)?.tagName === 'TR' && ['Enter', ' '].includes(event.key)) onRowClick(row, event);
}

const allItemsSelected = computed<boolean>(() => {
	return props.loading === false && props.rows.length > 0 && props.modelValue.length === props.rows.length;
});

const someItemsSelected = computed<boolean>(() => {
	return props.modelValue.length > 0 && allItemsSelected.value === false;
});

function getSelectedState(row: Row) {
	return props.modelValue.includes(row[props.rowKey]);
}

function onItemSelected(row: Row, value: boolean) {
	if (props.disabled) return;

	let selection = [...props.modelValue];

	if (value === true) {
		selection.push(row[props.rowKey]);
	} else {
		selection = selection.filter((key) => key !== row[props.rowKey]);
	}

	if (props.showSelect === 'one') {
		selection = selection.slice(-1);
	}

	emit('update:modelValue', selection);
}

function onToggleSelectAll(value: boolean) {
	if (props.disabled) return;
	emit('update:modelValue', value ? props.rows.map((row) => row[props.rowKey]) : []);
}

function ariaSort(column: BoTableColumn) {
	if (column.sortable === false) return undefined;
	if (internalSort.value.by !== column.key) return 'none';
	return internalSort.value.desc ? 'descending' : 'ascending';
}

// table-header.vue changeSort
function changeSort(column: BoTableColumn) {
	if (column.sortable === false || props.disabled) return;
	if (resizing.value === true) return;

	let newSort: BoTableSort;

	if (column.key === internalSort.value.by) {
		if (props.mustSort) {
			newSort = { by: internalSort.value.by, desc: !internalSort.value.desc };
		} else if (internalSort.value.desc === false) {
			newSort = { by: internalSort.value.by, desc: true };
		} else {
			newSort = { by: null, desc: false };
		}
	} else {
		newSort = { by: column.key, desc: false };
	}

	// v-table.vue updateSort
	emit('update:sort', newSort.by ? newSort : null);
}

// table-header.vue column resize (mouse only)
const resizing = ref(false);
const resizeStartX = ref(0);
const resizeStartWidth = ref(0);
const resizeKey = ref<string | null>(null);
const resizeRtl = ref(false);

useEventListener(window, 'pointermove', throttle(onPointerMove, 40));
useEventListener(window, 'pointerup', onPointerUp);

function onResizeHandleDown(column: BoTableColumn, event: PointerEvent) {
	const parent = (event.target as HTMLElement).parentElement as HTMLTableCellElement;
	resizing.value = true;
	resizeStartX.value = event.pageX;
	resizeStartWidth.value = parent.offsetWidth;
	resizeKey.value = column.key;
	resizeRtl.value = getComputedStyle(parent).direction === 'rtl';
}

function onPointerMove(event: PointerEvent) {
	if (resizing.value !== true) return;

	const deltaX = event.pageX - resizeStartX.value;
	const newWidth = resizeStartWidth.value + (resizeRtl.value ? -deltaX : deltaX);

	emit(
		'update:columns',
		props.columns.map((column) => (column.key === resizeKey.value ? { ...column, width: Math.max(32, newWidth) } : column)),
	);
}

function onPointerUp() {
	// Cleared after the click that follows pointerup, so the header button does not sort at the end of a resize.
	if (resizing.value === true) setTimeout(() => (resizing.value = false));
}
</script>

<template>
	<div
		class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]"
		:class="{ 'select-none': resizing }"
	>
		<div class="custom-scrollbar max-w-full overflow-x-auto">
			<table
				class="w-full table-fixed"
				:style="{ minWidth: `${minWidth}px` }"
				:aria-busy="loading ? 'true' : undefined"
			>
				<caption v-if="caption" class="sr-only">{{ caption }}</caption>
				<colgroup>
					<col v-if="showManualSort" :style="{ width: `${MANUAL_SORT_WIDTH}px` }" />
					<col v-if="showSelectColumn" :style="{ width: `${SELECT_WIDTH}px` }" />
					<col v-for="column in internalColumns" :key="column.key" :style="{ width: `${column.width}px` }" />
					<col />
					<col v-if="hasItemAppendSlot" :style="{ width: `${appendWidth}px` }" />
				</colgroup>
				<thead class="sticky top-0 z-1 bg-white dark:bg-gray-900">
					<tr class="border-b border-gray-200 dark:border-gray-700">
						<th v-if="showManualSort" scope="col" class="px-1 py-3 text-start">
							<button
								type="button"
								class="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/5"
								:class="[
									FOCUS,
									sortedManually ? 'text-brand-500 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400',
								]"
								:aria-label="$t('toggle_manual_sorting')"
								:aria-pressed="sortedManually ? 'true' : 'false'"
								:title="$t('toggle_manual_sorting')"
								:disabled="disabled || !manualSortKey"
								@click="toggleManualSort"
							>
								<BoIcon name="sort" size="sm" />
							</button>
						</th>
						<th v-if="showSelectColumn" scope="col" class="px-3 py-3 text-start">
							<BoCheckbox
								v-if="showSelect === 'multiple'"
								:model-value="allItemsSelected"
								:indeterminate="someItemsSelected"
								:aria-label="$t('select_all')"
								@update:model-value="onToggleSelectAll"
							/>
						</th>
						<th
							v-for="column in internalColumns"
							:key="column.key"
							scope="col"
							:aria-sort="ariaSort(column)"
							class="group relative truncate px-3 py-3 text-theme-xs font-medium text-gray-500 dark:text-gray-400"
							:class="ALIGN[column.align ?? 'left']"
						>
							<button
								v-if="column.sortable !== false && !disabled"
								type="button"
								class="inline-flex max-w-full items-center gap-1 rounded"
								:class="FOCUS"
								@click="changeSort(column)"
							>
								<span class="truncate"><slot :name="`header.${column.key}`" :column="column">{{ column.label }}</slot></span>
								<BoIcon
									:name="internalSort.by === column.key && internalSort.desc ? 'arrow_downward' : 'arrow_upward'"
									size="sm"
									class="text-gray-500 transition-opacity motion-reduce:transition-none dark:text-gray-400"
									:class="
										internalSort.by === column.key
											? 'opacity-100'
											: 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
									"
								/>
							</button>
							<slot v-else :name="`header.${column.key}`" :column="column">{{ column.label }}</slot>
							<span
								v-if="showResize"
								aria-hidden="true"
								class="absolute -end-1 top-0 z-1 h-full w-2 cursor-col-resize after:absolute after:inset-y-2 after:start-1/2 after:w-px after:bg-gray-200 hover:after:bg-brand-500 dark:after:bg-gray-800 dark:hover:after:bg-brand-400"
								data-resize-handle
								@pointerdown="onResizeHandleDown(column, $event)"
							/>
						</th>
						<th aria-hidden="true" class="p-0" />
						<th v-if="hasItemAppendSlot" scope="col" class="p-0">
							<slot name="header-append" />
						</th>
					</tr>
					<tr v-if="loading">
						<th :colspan="colSpan" class="p-0">
							<BoProgressLinear indeterminate :aria-label="loadingText || $t('loading')" />
						</th>
					</tr>
				</thead>
				<tbody v-if="loading && rows.length === 0">
					<tr>
						<td
							:colspan="colSpan"
							class="px-5 py-10 text-center text-theme-sm text-gray-500 dark:text-gray-400"
						>
							{{ loadingText || $t('loading') }}
						</td>
					</tr>
				</tbody>
				<tbody v-else-if="rows.length === 0">
					<tr>
						<td
							:colspan="colSpan"
							class="px-5 py-10 text-center text-theme-sm text-gray-500 dark:text-gray-400"
						>
							<slot name="empty">{{ noItemsText || $t('no_items') }}</slot>
						</td>
					</tr>
				</tbody>
				<Draggable
					v-else
					:model-value="rows"
					tag="tbody"
					class="divide-y divide-gray-200 dark:divide-gray-700"
					:item-key="rowKeyOf"
					handle=".drag-handle"
					:disabled="disabled || !showManualSort || !sortedManually"
					chosen-class="opacity-50"
					v-bind="{ 'force-fallback': true }"
					@update:model-value="emit('update:rows', $event)"
				>
					<template #item="{ element: row }">
						<tr
							:aria-selected="showSelectColumn ? (getSelectedState(row) ? 'true' : 'false') : undefined"
							:tabindex="hasClickListener ? 0 : undefined"
							class="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.03]"
							:class="[
								ROW_HEIGHTS[spacing],
								{ 'bg-gray-50 dark:bg-white/[0.03]': getSelectedState(row) },
								hasClickListener ? ['cursor-pointer', FOCUS, 'focus-visible:-outline-offset-2'] : '',
							]"
							@click="onRowClick(row, $event)"
							@keydown="onRowKeydown(row, $event)"
						>
							<!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events -- only stops the row click -->
							<td v-if="showManualSort" class="px-1 py-0 text-center" @click.stop>
								<BoIcon
									name="drag_handle"
									size="sm"
									class="drag-handle"
									:class="
										sortedManually
											? 'cursor-grab text-gray-500 dark:text-gray-400'
											: 'cursor-not-allowed text-gray-300 dark:text-gray-600'
									"
								/>
							</td>
							<!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events -- only stops the row click -->
							<td v-if="showSelectColumn" class="px-3 py-0" @click.stop>
								<BoCheckbox
									:model-value="getSelectedState(row)"
									:aria-label="$t('select_item')"
									@update:model-value="onItemSelected(row, $event)"
								/>
							</td>
							<td
								v-for="column in internalColumns"
								:key="column.key"
								class="truncate px-3 py-0 text-theme-sm text-gray-500 dark:text-gray-400"
								:class="ALIGN[column.align ?? 'left']"
							>
								<slot :name="`item.${column.key}`" :item="row">{{ row[column.key] }}</slot>
							</td>
							<td class="p-0" />
							<!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events -- only stops the row click -->
							<td v-if="hasItemAppendSlot" class="px-2 py-0" @click.stop>
								<slot name="item-append" :item="row" />
							</td>
						</tr>
					</template>
				</Draggable>
			</table>
		</div>
	</div>
</template>
