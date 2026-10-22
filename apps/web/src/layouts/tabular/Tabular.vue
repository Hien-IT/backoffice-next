<!-- Ported from directus/app/src/layouts/tabular/tabular.vue -->
<script setup lang="ts">
// Backoffice: BoTable (recipe "Data table and pagination (Q-2)") instead of v-table: the header menu is a Reka
// Dropdown menu with radio items for sort and alignment, plus "Move left" / "Move right" and a width input (keyboard
// path of the header drag and resize, D-69); manual sort keeps the row drag and adds a row menu "Move up" / "Move down"
// while the table is sorted manually (D-69); the footer is BoPagination + BoSelect (no skeleton loader while the count
// loads: the pagination shows once the count is there); `useShortcut('meta+a')` is a keydown on the table box.
import type { AppCollection, Field, Filter, Item, PrimaryKey, ShowSelect } from '@directus/types';
import {
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	PopoverContent,
	PopoverPortal,
	PopoverRoot,
	PopoverTrigger,
} from 'reka-ui';
import { computed, inject, ref, type Ref, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../components/BoIcon.vue';
import BoMenu from '../../components/BoMenu.vue';
import BoPagination from '../../components/BoPagination.vue';
import BoSelect from '../../components/BoSelect.vue';
import BoTable, { type BoTableColumn } from '../../components/BoTable.vue';
import FieldList from '../../components/FieldList.vue';
import RenderDisplay from '../../components/render/RenderDisplay.vue';
import { useAliasFields } from '../../composables/use-alias-fields.ts';
import type { ManualSortData } from '../../composables/use-items.ts';
import { usePageSize } from '../../composables/use-page-size.ts';
import { useCollectionPermissions } from '../../composables/use-permissions/index.ts';
import type { Alignment, HeaderRaw, Sort } from './types.ts';

defineOptions({ name: 'LayoutTabular', inheritAttrs: false });

interface Props {
	collection: string;
	selection?: PrimaryKey[];
	readonly: boolean;
	tableHeaders: HeaderRaw[];
	showSelect?: ShowSelect;
	items: Item[];
	loading: boolean;
	loadingItemCount: boolean;
	error?: any;
	totalPages: number;
	tableSort?: { by: string; desc: boolean } | null | undefined;
	onRowClick: ({ item, event }: { item: Item; event: MouseEvent }) => void;
	tableRowHeight: number;
	page: number;
	toPage: (newPage: number) => void;
	itemCount?: number | null | undefined;
	fields: string[];
	limit: number;
	primaryKeyField?: Field | null | undefined;
	info?: AppCollection | null | undefined;
	sortField?: string | null | undefined;
	changeManualSort: (data: ManualSortData) => Promise<void>;
	resetPresetAndRefresh: () => Promise<void>;
	selectAll: () => void;
	filterUser?: Filter | null | undefined;
	search?: string | null | undefined;
	onSortChange: (newSort: Sort | null) => void;
	onAlignChange?: (field: string, align: Alignment) => void;
}

const props = withDefaults(defineProps<Props>(), {
	selection: () => [],
	showSelect: 'none',
	error: null,
	itemCount: undefined,
	tableSort: undefined,
	primaryKeyField: undefined,
	info: undefined,
	sortField: undefined,
	filterUser: undefined,
	search: undefined,
	onAlignChange: () => undefined,
});

const emit = defineEmits<{
	'update:selection': [value: PrimaryKey[]];
	'update:tableHeaders': [value: HeaderRaw[]];
	'update:limit': [value: number];
	'update:fields': [value: string[]];
}>();

const { t } = useI18n();

const { collection } = toRefs(props);

const { sortAllowed } = useCollectionPermissions(collection);

const limitWritable = computed({
	get: () => props.limit,
	set: (value: number) => emit('update:limit', value),
});

const fieldsWritable = computed({
	get: () => props.fields,
	set: (value: string[]) => emit('update:fields', value),
});

const mainElement = inject<Ref<Element | undefined> | undefined>('main-element', undefined);

watch(
	() => props.page,
	() => mainElement?.value?.scrollTo({ top: 0, behavior: 'smooth' }),
);

// useShortcut('meta+a', selectAll, table): only while the focus is in the table, not in a text field.
function onKeydown(event: KeyboardEvent) {
	if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'a') return;
	if ((event.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')) return;
	event.preventDefault();
	props.selectAll();
}

const { sizes: pageSizes, selected: selectedSize } = usePageSize<{ text: string; value: string }>(
	[25, 50, 100, 250, 500, 1000],
	(value) => ({ text: String(value), value: String(value) }),
	props.limit,
);

if (limitWritable.value !== selectedSize) {
	limitWritable.value = selectedSize;
}

const { getFromAliasedItem } = useAliasFields(fieldsWritable, collection);

function addField(fieldKey: string) {
	fieldsWritable.value = [...fieldsWritable.value, fieldKey];
}

function removeField(fieldKey: string) {
	fieldsWritable.value = fieldsWritable.value.filter((field) => field !== fieldKey);
}

/* ------------------------------------------------------------------ columns (v-model:headers of v-table) */

const headersByKey = computed(() => new Map(props.tableHeaders.map((header) => [header.value, header])));

const columns = computed<BoTableColumn[]>(() =>
	props.tableHeaders.map((header) => ({
		key: header.value,
		label: header.text,
		width: header.width ?? null,
		align: header.align ?? 'left',
		sortable: header.sortable !== false,
		description: header.description ?? null,
	})),
);

// The `field` part of a header (tabular/index.ts useTable) as RenderDisplay props.
function displayProps(key: string) {
	const field = headersByKey.value.get(key)!['field'];

	return {
		display: field.display,
		options: field.displayOptions,
		interface: field.interface,
		interfaceOptions: field.interfaceOptions,
		type: field.type,
		collection: field.collection,
		field: field.field,
	};
}

function onColumnsUpdate(next: BoTableColumn[]) {
	emit(
		'update:tableHeaders',
		next.map((column) => ({ ...headersByKey.value.get(column.key)!, width: column.width ?? null })),
	);
}

function moveColumn(index: number, offset: -1 | 1) {
	const next = [...props.tableHeaders];
	[next[index], next[index + offset]] = [next[index + offset]!, next[index]!];
	emit('update:tableHeaders', next);
}

// Minimum width 32 px as the table-header.vue resize.
function setWidth(index: number, event: Event) {
	const width = Number((event.target as HTMLInputElement).value);
	if (!Number.isFinite(width) || width <= 0) return;
	emit(
		'update:tableHeaders',
		props.tableHeaders.map((header, i) =>
			i === index ? { ...header, width: Math.max(32, Math.round(width)) } : header,
		),
	);
}

// Keys typed in the width input stay in the input (no typeahead of the menu); arrows and Esc still move or close.
function onWidthKeydown(index: number, event: KeyboardEvent) {
	if (event.key === 'Enter') setWidth(index, event);
	if (!['ArrowUp', 'ArrowDown', 'Escape', 'Tab'].includes(event.key)) event.stopPropagation();
}

function sortValue(key: string) {
	if (props.tableSort?.by !== key) return '';
	return props.tableSort.desc ? 'desc' : 'asc';
}

/* ------------------------------------------------------------------ manual sort row menu (D-69) */

const sortedManually = computed(() => !!props.sortField && props.tableSort?.by === props.sortField);
const moveAnnouncement = ref('');

function pkOf(item: Item): PrimaryKey {
	return item[props.primaryKeyField?.field ?? 'id'];
}

function rowMoves(item: Item) {
	const index = props.items.indexOf(item);
	const last = props.items.length - 1;

	const move = async (to: number) => {
		await props.changeManualSort({ item: pkOf(item), to: pkOf(props.items[to]!) });
		moveAnnouncement.value = t('moved_to_position', { item: pkOf(item), position: to + 1, total: props.items.length });
	};

	return [
		{ text: t('move_up'), icon: 'arrow_upward', disabled: index <= 0, onSelect: () => move(index - 1) },
		{ text: t('move_down'), icon: 'arrow_downward', disabled: index === last, onSelect: () => move(index + 1) },
	];
}

const ICON_BTN =
	'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
// h-7 instead of the ICON_BTN h-8: the row menu button fits the compact row (29 px).
const ROW_BTN = ICON_BTN.replace('h-8 w-8', 'h-7 w-7');
const ITEM =
	'flex w-full cursor-pointer items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-start text-theme-sm font-medium text-gray-700 outline-hidden data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-800 data-[state=checked]:menu-dropdown-item-active dark:text-gray-400 dark:data-[disabled]:text-white/15 dark:data-[highlighted]:bg-white/5 dark:data-[highlighted]:text-gray-300';
const ITEM_ICON = 'text-gray-500 dark:text-gray-400';
const SEPARATOR = 'my-1 border-t border-gray-200 dark:border-gray-800';
const POPOVER =
	'z-99999 max-h-(--reka-popover-content-available-height) w-80 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg custom-scrollbar dark:border-gray-800 dark:bg-gray-dark';
</script>

<template>
	<div class="flex h-full min-h-0 flex-col">
		<!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -- meta+a shortcut of the table, as useShortcut -->
		<div v-if="loading || (items.length > 0 && !error)" class="flex min-h-0 flex-col" @keydown="onKeydown">
			<BoTable
				:model-value="selection"
				:columns="columns"
				:rows="items"
				:row-key="primaryKeyField?.field ?? 'id'"
				:sort="tableSort ?? null"
				must-sort
				fixed-header
				show-resize
				allow-header-reorder
				:show-select="showSelect"
				:loading="loading"
				:row-height="tableRowHeight"
				:caption="info?.name ?? collection"
				:show-manual-sort="sortAllowed"
				:manual-sort-key="sortField ?? undefined"
				:append-width="48"
				@update:model-value="emit('update:selection', $event)"
				@update:columns="onColumnsUpdate"
				@update:sort="onSortChange"
				@click:row="onRowClick($event as { item: Item; event: MouseEvent })"
				@manual-sort="changeManualSort"
			>
				<template v-for="column in columns" :key="column.key" #[`item.${column.key}`]="{ item }">
					<RenderDisplay v-bind="displayProps(column.key)" :value="getFromAliasedItem(item, column.key)" />
				</template>

				<template #header-context-menu="{ column, index }">
					<DropdownMenuRadioGroup
						:model-value="sortValue(column.key)"
						@update:model-value="onSortChange({ by: column.key, desc: $event === 'desc' })"
					>
						<DropdownMenuRadioItem value="asc" :disabled="column.sortable === false" :class="ITEM">
							<BoIcon name="sort" size="sm" class="-scale-y-100" :class="ITEM_ICON" />
							{{ $t('sort_asc') }}
						</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="desc" :disabled="column.sortable === false" :class="ITEM">
							<BoIcon name="sort" size="sm" :class="ITEM_ICON" />
							{{ $t('sort_desc') }}
						</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>

					<DropdownMenuSeparator :class="SEPARATOR" />

					<DropdownMenuRadioGroup
						:model-value="column.align ?? 'left'"
						@update:model-value="onAlignChange?.(column.key, $event as Alignment)"
					>
						<DropdownMenuRadioItem value="left" :class="ITEM">
							<BoIcon name="format_align_left" size="sm" :class="ITEM_ICON" />
							{{ $t('left_align') }}
						</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="center" :class="ITEM">
							<BoIcon name="format_align_center" size="sm" :class="ITEM_ICON" />
							{{ $t('center_align') }}
						</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="right" :class="ITEM">
							<BoIcon name="format_align_right" size="sm" :class="ITEM_ICON" />
							{{ $t('right_align') }}
						</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>

					<DropdownMenuSeparator :class="SEPARATOR" />

					<DropdownMenuItem :disabled="index === 0" :class="ITEM" @select="moveColumn(index, -1)">
						<BoIcon name="arrow_back" size="sm" :class="ITEM_ICON" />
						{{ $t('move_left') }}
					</DropdownMenuItem>
					<DropdownMenuItem :disabled="index === columns.length - 1" :class="ITEM" @select="moveColumn(index, 1)">
						<BoIcon name="arrow_forward" size="sm" :class="ITEM_ICON" />
						{{ $t('move_right') }}
					</DropdownMenuItem>
					<div class="flex items-center gap-3 px-3 py-2 text-theme-sm font-medium text-gray-700 dark:text-gray-400">
						<span aria-hidden="true">{{ $t('field_width') }}</span>
						<DropdownMenuItem as-child @select="$event.preventDefault()">
							<input
								type="number"
								min="32"
								:value="column.width"
								:aria-label="$t('field_width')"
								class="h-8 w-24 rounded-lg border border-gray-300 bg-transparent px-2 text-theme-sm text-gray-800 outline-hidden focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10 data-[highlighted]:border-brand-500 dark:border-gray-700 dark:text-white/90"
								@change="setWidth(index, $event)"
								@keydown="onWidthKeydown(index, $event)"
							/>
						</DropdownMenuItem>
					</div>

					<DropdownMenuSeparator :class="SEPARATOR" />

					<DropdownMenuItem :class="ITEM" @select="removeField(column.key)">
						<BoIcon name="remove" size="sm" :class="ITEM_ICON" />
						{{ $t('hide_field') }}
					</DropdownMenuItem>
				</template>

				<template #header-append>
					<PopoverRoot>
						<PopoverTrigger :class="ICON_BTN" :aria-label="$t('add_field')" :title="$t('add_field')">
							<BoIcon name="add" size="sm" />
						</PopoverTrigger>
						<PopoverPortal>
							<PopoverContent :side-offset="4" align="end" :collision-padding="8" :class="POPOVER">
								<FieldList
									:collection="collection"
									:disabled-fields="fields"
									:allow-select-all="false"
									@add="addField($event[0]!)"
								/>
							</PopoverContent>
						</PopoverPortal>
					</PopoverRoot>
				</template>

				<template v-if="sortAllowed && sortedManually" #item-append="{ item }">
					<div class="flex items-center justify-end">
						<BoMenu :items="rowMoves(item)" align="end">
							<template #trigger>
								<button
									type="button"
									class="row-menu"
									:class="ROW_BTN"
									:aria-label="t('item_options', { item: pkOf(item) })"
								>
									<BoIcon name="more_vert" size="sm" />
								</button>
							</template>
						</BoMenu>
					</div>
				</template>
			</BoTable>

			<span class="sr-only" aria-live="polite" aria-atomic="true">{{ moveAnnouncement }}</span>

			<div
				class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 pt-3 dark:border-gray-800"
			>
				<BoPagination
					v-if="totalPages > 1"
					:length="totalPages"
					:label="info?.name ?? collection"
					:model-value="page"
					@update:model-value="toPage"
				/>
				<span v-else />

				<BoSelect
					v-if="loading === false && (items.length >= 25 || limit < 25)"
					class="flex items-center gap-2 text-theme-sm text-gray-500 dark:text-gray-400 [&>button]:w-24 [&>label]:mb-0"
					:label="$t('per_page')"
					:model-value="`${limit}`"
					:items="pageSizes"
					@update:model-value="limitWritable = +$event"
				/>
			</div>
		</div>

		<slot v-else-if="error" name="error" :error="error" :reset="resetPresetAndRefresh" />
		<slot v-else-if="itemCount === 0 && (filterUser || search)" name="no-results" />
		<slot v-else-if="itemCount === 0" name="no-items" />
	</div>
</template>
