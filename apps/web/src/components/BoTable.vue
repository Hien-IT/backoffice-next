<!-- Ported from directus/app/src/components/v-table/v-table.vue -->
<script setup lang="ts">
// Backoffice: the simple Table recipe (component-specs "Table, simple"): a real <table> with columns
// { key, label, width, align, sortable }, selection by row key (Directus `selectionUseKeys`), sort and mouse resize
// as v-table / table-header (no keyboard resize, not in Directus), row heights of the Directus `spacing`. Header
// reordering, manual sort and the append slots come with the screens that use them (014).
import { useEventListener } from '@vueuse/core';
import { throttle } from 'lodash-es';
import { computed, ref } from 'vue';
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
	},
);

const emit = defineEmits<{
	'update:modelValue': [keys: Key[]];
	'update:sort': [sort: BoTableSort | null];
	'update:columns': [columns: BoTableColumn[]];
}>();

const ROW_HEIGHTS = { compact: 'h-[29px]', cozy: 'h-[43px]', comfortable: 'h-[58px]' };
const ALIGN = { left: 'text-start', center: 'text-center', right: 'text-end' };
const DEFAULT_WIDTH = 130; // 8.125rem, Directus default column width
const SELECT_WIDTH = 44;
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

const colSpan = computed(() => internalColumns.value.length + 1 + (showSelectColumn.value ? 1 : 0));

const minWidth = computed(
	() =>
		internalColumns.value.reduce((sum, column) => sum + column.width, 0) +
		(showSelectColumn.value ? SELECT_WIDTH : 0),
);

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
					<col v-if="showSelectColumn" :style="{ width: `${SELECT_WIDTH}px` }" />
					<col v-for="column in internalColumns" :key="column.key" :style="{ width: `${column.width}px` }" />
					<col />
				</colgroup>
				<thead class="sticky top-0 z-1 bg-white dark:bg-gray-900">
					<tr class="border-b border-gray-200 dark:border-gray-700">
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
					</tr>
					<tr v-if="loading">
						<th :colspan="colSpan" class="p-0">
							<BoProgressLinear indeterminate :aria-label="loadingText || $t('loading')" />
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
					<tr v-if="loading && rows.length === 0">
						<td
							:colspan="colSpan"
							class="px-5 py-10 text-center text-theme-sm text-gray-500 dark:text-gray-400"
						>
							{{ loadingText || $t('loading') }}
						</td>
					</tr>
					<tr v-else-if="rows.length === 0">
						<td
							:colspan="colSpan"
							class="px-5 py-10 text-center text-theme-sm text-gray-500 dark:text-gray-400"
						>
							<slot name="empty">{{ noItemsText || $t('no_items') }}</slot>
						</td>
					</tr>
					<template v-else>
					<tr
						v-for="row in rows"
						:key="row[rowKey] ?? row['$index']"
						:aria-selected="showSelectColumn ? (getSelectedState(row) ? 'true' : 'false') : undefined"
						class="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.03]"
						:class="[ROW_HEIGHTS[spacing], { 'bg-gray-50 dark:bg-white/[0.03]': getSelectedState(row) }]"
					>
						<td v-if="showSelectColumn" class="px-3 py-0">
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
					</tr>
					</template>
				</tbody>
			</table>
		</div>
	</div>
</template>
