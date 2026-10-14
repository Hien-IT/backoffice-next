<!-- Ported from directus/app/src/interfaces/list-o2m/list-o2m.vue -->
<script setup lang="ts">
// Backoffice: template rewritten with the Bo* components. List layout: BoSortableList (drag handle plus the D-60 row
// menu "Move up" / "Move down"); table layout: BoTable with v-table's manual sort, `click:row` (also Enter on a
// focused row) and `item-append` (link, D-60 move menu while the rows follow the sort field, remove). Rows are keyed
// by `$key` (primary key, else `$index` of a created item) since BoTable selects by key while v-table selects item
// objects. The search input is a plain search (the filter of search-input.vue comes with 014, D-58); pagination is
// previous/next (no v-pagination yet). v-prevent-focusout is not needed (the drawers are Reka dialogs that keep the focus).
// localStorage key `directus-o2m-column-widths-*` -> `backoffice-o2m-column-widths-*` (D-39).
import type { ContentVersion, Filter } from '@directus/types';
import { deepMap, getFieldsFromTemplate } from '@directus/utils';
import { clamp, get, isEmpty, isNil } from 'lodash-es';
import { render } from 'micromustache';
import { computed, inject, ref, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import BoButton from '../../components/BoButton.vue';
import BoIcon from '../../components/BoIcon.vue';
import BoInput from '../../components/BoInput.vue';
import BoMenu, { type BoMenuItem } from '../../components/BoMenu.vue';
import BoNotice from '../../components/BoNotice.vue';
import BoSelect from '../../components/BoSelect.vue';
import BoSortableList from '../../components/BoSortableList.vue';
import BoTable, { type BoTableColumn, type BoTableSort } from '../../components/BoTable.vue';
import DrawerBatch from '../../components/drawers/DrawerBatch.vue';
import DrawerCollection from '../../components/drawers/DrawerCollection.vue';
import DrawerItem from '../../components/drawers/DrawerItem.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { parseFilter } from '../../components/form/utils/parse-filter.ts';
import RenderTemplate from '../../components/render/RenderTemplate.vue';
import {
	type DisplayItem,
	type RelationQueryMultiple,
	useRelationMultiple,
} from '../../composables/use-relation-multiple.ts';
import { useRelationO2M } from '../../composables/use-relation-o2m.ts';
import { useRelationPermissionsO2M } from '../../composables/use-relation-permissions.ts';
import { type APIError, translateAPIError } from '../../lang/index.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { adjustFieldsForDisplays } from '../../utils/adjust-fields-for-displays.ts';
import { getItemRoute } from '../../utils/get-item-route.ts';
import { addRelatedPrimaryKeyToFields } from '../../utils/add-related-primary-key-to-fields.ts';
import BoRemove from '../../components/BoRemove.vue';
import { formatItemsCountPaginated } from '../../utils/format-items-count.ts';
import { renderStringTemplate } from '../../utils/render-string-template.ts';
import { useColumnWidths } from '../../composables/use-column-widths.ts';

// Backoffice: LAYOUTS of @/types/interfaces as string literals.
type Layout = 'list' | 'table';

const props = withDefaults(
	defineProps<{
		value?: (number | string | Record<string, any>)[] | Record<string, any> | null;
		primaryKey: string | number;
		collection: string;
		field: string;
		width?: string;
		disabled?: boolean;
		nonEditable?: boolean;
		version?: ContentVersion | null;
		layout?: Layout;
		tableSpacing?: 'compact' | 'cozy' | 'comfortable';
		fields?: Array<string>;
		template?: string | null;
		enableCreate?: boolean;
		enableSelect?: boolean;
		filter?: Filter | null;
		enableSearchFilter?: boolean;
		enableLink?: boolean;
		limit?: number;
		sort?: string | undefined;
		sortDirection?: '+' | '-' | undefined;
	}>(),
	{
		value: () => [],
		// Backoffice: width and version are optional here (the form always passes them, tests may not).
		width: 'full',
		version: null,
		layout: 'list',
		tableSpacing: 'cozy',
		fields: () => ['id'],
		template: null,
		disabled: false,
		nonEditable: false,
		enableCreate: true,
		enableSelect: true,
		filter: null,
		enableSearchFilter: false,
		enableLink: false,
		limit: 15,
		sort: undefined,
		sortDirection: undefined,
	},
);

const emit = defineEmits<{ input: [value: any] }>();
const { t, n } = useI18n();
const { collection, field, primaryKey, version } = toRefs(props);
const { relationInfo } = useRelationO2M(collection, field);
const fieldsStore = useFieldsStore();
const a11y = inject(FORM_FIELD_A11Y, null);

const { getWidth, updateWidths } = useColumnWidths(
	() => `backoffice-o2m-column-widths-${collection.value}-${field.value}`,
);

const value = computed({
	get: () => props.value,
	set: (val) => {
		emit('input', val);
	},
});

const templateWithDefaults = computed(() => {
	return (
		props.template ||
		relationInfo.value?.relatedCollection.meta?.display_template ||
		`{{${relationInfo.value?.relatedPrimaryKeyField.field}}}`
	);
});

const fields = computed(() => {
	if (!relationInfo.value) return [];

	let displayFields: string[] = [];

	if (props.layout === 'table') {
		displayFields = adjustFieldsForDisplays(props.fields, relationInfo.value.relatedCollection.collection);
	} else {
		displayFields = adjustFieldsForDisplays(
			getFieldsFromTemplate(templateWithDefaults.value),
			relationInfo.value.relatedCollection.collection,
		);
	}

	return addRelatedPrimaryKeyToFields(relationInfo.value.relatedCollection.collection, displayFields);
});

const limit = ref(props.limit);
const page = ref(1);
const search = ref('');
const searchFilter = ref<Filter>();

const manualSort = ref<BoTableSort | null>(
	props.sort && !relationInfo.value?.sortField ? { by: props.sort, desc: props.sortDirection === '-' } : null,
);

const query = computed<RelationQueryMultiple>(() => {
	const q: RelationQueryMultiple = {
		limit: limit.value,
		page: page.value,
		fields: fields.value || ['id'],
	};

	if (!relationInfo.value) {
		return q;
	}

	if (searchFilter.value) {
		q.filter = searchFilter.value;
	}

	if (search.value) {
		q.search = search.value;
	}

	if (manualSort.value) {
		q.sort = [`${manualSort.value.desc ? '-' : ''}${manualSort.value.by}`];
	}

	return q;
});

watch([search, searchFilter, limit], () => {
	page.value = 1;
});

const {
	create,
	update,
	remove,
	select,
	displayItems,
	totalItemCount,
	loading,
	selected,
	isItemSelected,
	isLocalItem,
	getItemEdits,
	error: loadError,
} = useRelationMultiple(value, query, relationInfo, primaryKey, version);

const { createAllowed, deleteAllowed, updateAllowed } = useRelationPermissionsO2M(relationInfo);

const pageCount = computed(() => Math.ceil(totalItemCount.value / limit.value));

const showingCount = computed(() =>
	formatItemsCountPaginated({
		currentItems: totalItemCount.value,
		currentPage: page.value,
		perPage: limit.value,
		isFiltered: !!(search.value || searchFilter.value),
		i18n: { t, n },
	}),
);

const headers = computed<BoTableColumn[]>({
	get: () => {
		if (!relationInfo.value) return [];

		const relatedCollection = relationInfo.value.relatedCollection.collection;

		const contentWidth: Record<string, number> = {};

		(displayItems.value ?? []).forEach((item: Record<string, any>) => {
			props.fields.forEach((key) => {
				if (!contentWidth[key]) {
					contentWidth[key] = 5;
				}

				if (String(item[key]).length > contentWidth[key]) {
					contentWidth[key] = String(item[key]).length;
				}
			});
		});

		return props.fields
			.map((key) => {
				const field = fieldsStore.getField(relatedCollection, key);

				// when user has no permission to this field or junction collection
				if (!field) return null;

				const defaultWidth =
					contentWidth[key] !== undefined && contentWidth[key] < 10 ? contentWidth[key] * 16 + 10 : 144;

				return {
					label: field.name,
					key,
					width: getWidth(key, defaultWidth),
					sortable: !['json'].includes(field.type),
				};
			})
			.filter((h) => h !== null);
	},
	set: (val) => {
		const currentHeaders = headers.value;

		const changed = val.filter((h) => {
			const current = currentHeaders.find((ch) => ch.key === h.key);
			return current && current.width !== h.width;
		});

		if (changed.length > 0) updateWidths(changed.map((h) => ({ value: h.key, width: h.width })));
	},
});

const allowDrag = computed(() => totalItemCount.value <= limit.value && relationInfo.value?.sortField !== undefined);

function sortItems(items: DisplayItem[]) {
	const info = relationInfo.value;
	const sortField = info?.sortField;
	if (!info || !sortField) return;

	const sortedItems = items.map((item, index) => {
		const relatedId = item?.[info.relatedPrimaryKeyField.field];

		const changes: Record<string, any> = {
			$index: item.$index,
			$type: item.$type,
			$edits: item.$edits,
			...getItemEdits(item),
			[sortField]: index + 1,
		};

		if (!isNil(relatedId)) {
			changes[info.relatedPrimaryKeyField.field] = relatedId;
		}

		return changes;
	});

	update(...sortedItems);
}

const selectedPrimaryKeys = computed(() => {
	if (!relationInfo.value) return [];

	const relatedPkField = relationInfo.value.relatedPrimaryKeyField.field;

	return selected.value.map((item) => item[relatedPkField]);
});

const currentlyEditing = ref<string | null>(null);
const selectModalActive = ref(false);
const editsAtStart = ref<Record<string, any>>({});
let newItem = false;

function createItem() {
	currentlyEditing.value = '+';
	editsAtStart.value = {};
	newItem = true;
}

function editItem(item: DisplayItem) {
	if (!relationInfo.value) return;

	const relatedPkField = relationInfo.value.relatedPrimaryKeyField.field;

	newItem = false;
	editsAtStart.value = getItemEdits(item);

	if (item?.$type === 'created' && !isItemSelected(item)) {
		currentlyEditing.value = '+';
	} else {
		currentlyEditing.value = item[relatedPkField];
	}
}

function editRow({ item }: { item: DisplayItem }) {
	editItem(item);
}

function stageEdits(item: Record<string, any>) {
	if (newItem) {
		create(item);
	} else {
		update(item);
	}
}

function cancelEdit() {
	currentlyEditing.value = null;
}

function deleteItem(item: DisplayItem) {
	if (
		page.value === Math.ceil(totalItemCount.value / limit.value) &&
		page.value !== Math.ceil((totalItemCount.value - 1) / limit.value)
	) {
		page.value = Math.max(1, page.value - 1);
	}

	remove(item);
}

const batchEditActive = ref(false);
const { tableRows, selection, selectionKeys } = useTableRows();

const selectedKeys = computed(() => {
	if (!relationInfo.value) return [];

	return selection.value
		.map(
			// use `$index` for newly created items that don’t have a PK yet
			(item) => item[relationInfo.value!.relatedPrimaryKeyField.field] ?? item.$index ?? null,
		)
		.filter((key) => !isNil(key));
});

function stageBatchEdits(edits: Record<string, any>) {
	if (!relationInfo.value) return;

	const relatedPkField = relationInfo.value.relatedPrimaryKeyField.field;

	for (const item of selection.value) {
		const relatedId = get(item, [relatedPkField], null);

		const changes: Record<string, any> = {
			$index: item.$index,
			$type: item.$type,
			$edits: item.$edits,
			...getItemEdits(item),
			...edits,
		};

		if (relatedId !== null) {
			changes[relatedPkField] = relatedId;
		}

		update(changes);
	}

	selection.value = [];
}

const values = inject('values', ref<Record<string, any>>({}));

const customFilter = computed(() => {
	const filter: Filter = {
		_and: [],
	};

	const customFilter = parseFilter(
		deepMap(props.filter, (val: any) => {
			if (val && typeof val === 'string') {
				return render(val, values.value);
			}

			return val;
		}),
	);

	if (!isEmpty(customFilter)) filter._and.push(customFilter);

	if (!relationInfo.value) return filter;

	const selectFilter: Filter = {
		_or: [
			{
				[relationInfo.value.reverseJunctionField.field]: {
					_neq: props.primaryKey,
				},
			},
			{
				[relationInfo.value.reverseJunctionField.field]: {
					_null: true,
				},
			},
		],
	};

	if (selectedPrimaryKeys.value.length > 0) {
		filter._and.push({
			[relationInfo.value.relatedPrimaryKeyField.field]: {
				_nin: selectedPrimaryKeys.value,
			},
		});
	}

	if (props.primaryKey !== '+') filter._and.push(selectFilter);

	return filter;
});

function getLinkForItem(item: DisplayItem) {
	if (relationInfo.value) {
		const primaryKey = get(item, relationInfo.value.relatedPrimaryKeyField.field);

		return getItemRoute(relationInfo.value.relatedCollection.collection, primaryKey);
	}

	return null;
}

const hasSatisfiedUniqueConstraint = computed(() => {
	if (!relationInfo.value) return false;

	const parentCollection = relationInfo.value.relation.related_collection;
	const relatedCollection = relationInfo.value.relatedCollection.collection;

	// Find all M2O fields in the related collection that point to the parent collection and are unique
	const m2oFields = fieldsStore.getFieldsForCollection(relatedCollection).filter((field) => {
		const schema = field.schema;
		return schema?.foreign_key_table === parentCollection && schema?.is_unique === true;
	});

	return m2oFields.length > 0 && totalItemCount.value > 0;
});

// Backoffice: BoTable selects row keys; `$key` is the v-table item-key, or `$index` for a created item without one.
function useTableRows() {
	const selectionKeys = ref<(string | number)[]>([]);

	const tableRows = computed(() => {
		const pkField = relationInfo.value?.relatedPrimaryKeyField.field ?? 'id';
		return displayItems.value.map((item) => ({ ...item, $key: item[pkField] ?? `$index-${item.$index}` }));
	});

	const selection = computed<DisplayItem[]>({
		get: () => tableRows.value.filter((row) => selectionKeys.value.includes(row.$key)),
		set: (rows) => (selectionKeys.value = rows.map((row) => row['$key'])),
	});

	return { tableRows, selection, selectionKeys };
}

// Backoffice: D-60 "Move up" / "Move down" of a table row, the keyboard path of the manual sort drag.
function moveItems(index: number): BoMenuItem[] {
	const last = displayItems.value.length - 1;

	const move = (to: number) => {
		const items = [...displayItems.value];
		const [item] = items.splice(index, 1) as [DisplayItem];
		items.splice(to, 0, item);
		sortItems(items);
	};

	return [
		{ text: t('move_up'), icon: 'arrow_upward', disabled: index === 0, onSelect: () => move(index - 1) },
		{ text: t('move_down'), icon: 'arrow_downward', disabled: index === last, onSelect: () => move(index + 1) },
	];
}

// Backoffice: the row name of the row menu label and the move announcement (D-60).
function itemLabel(item: DisplayItem, index: number): string {
	return renderStringTemplate(templateWithDefaults.value ?? '', item).displayValue.value || String(index + 1);
}

const showTableActions = computed(() => !props.nonEditable || props.enableLink);

// Backoffice: the move menu only while the rows are in sort field order (no other column sort), as the drag.
const tableMoveAllowed = computed(
	() =>
		allowDrag.value &&
		!props.disabled &&
		displayItems.value.length > 1 &&
		(!manualSort.value || manualSort.value.by === relationInfo.value?.sortField),
);

const rowIndex = (row: Record<string, any>) => tableRows.value.findIndex((r) => r.$key === row['$key']);

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const ICON_BTN = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 ${FOCUS}`;
</script>

<template>
	<BoNotice v-if="!relationInfo" type="warning">
		{{ t('relationship_not_setup') }}
	</BoNotice>
	<BoNotice v-else-if="relationInfo.relatedCollection.meta?.singleton" type="warning">
		{{ t('no_singleton_relations') }}
	</BoNotice>
	<div
		v-else
		class="one-to-many"
		role="group"
		:aria-labelledby="a11y?.labelId"
		:aria-describedby="a11y?.describedBy"
		:aria-invalid="a11y?.invalid ? 'true' : undefined"
	>
		<BoNotice v-if="loadError" type="danger" class="mb-3">{{ translateAPIError(loadError as APIError) }}</BoNotice>

		<div
			:class="[
				`layout-${layout}`,
				{ disabled, 'non-editable': nonEditable },
				layout === 'table' ? 'rounded-lg border border-gray-300 p-3.5 dark:border-gray-700' : '',
				layout === 'table' && disabled && !nonEditable ? 'bg-gray-50 dark:bg-gray-900' : '',
			]"
		>
			<div
				v-if="layout === 'table'"
				class="actions top mb-3 flex items-center gap-2"
				:class="[width, { 'flex-wrap': width.includes('half') }]"
			>
				<div class="spacer grow" />

				<div v-if="totalItemCount" class="item-count text-theme-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
					{{ showingCount }}
				</div>

				<template v-if="!nonEditable">
					<div
						v-if="enableSearchFilter && (totalItemCount > 10 || search || searchFilter)"
						class="search"
						:class="{ 'order-first w-full': width.includes('half') }"
					>
						<BoInput
							v-model="search"
							type="search"
							:aria-label="t('search')"
							:placeholder="t('search_items')"
							:disabled
						/>
					</div>

					<BoButton
						v-if="updateAllowed && selectedKeys.length"
						variant="secondary"
						icon="edit"
						:aria-label="t('edit')"
						:disabled
						data-action="batch-edit"
						@click="batchEditActive = true"
					/>

					<BoButton
						v-if="enableSelect && updateAllowed"
						:variant="enableCreate ? 'secondary' : 'primary'"
						icon="playlist_add"
						:aria-label="t('add_existing')"
						:disabled
						data-action="select"
						@click="selectModalActive = true"
					/>

					<BoButton
						v-if="enableCreate && createAllowed"
						icon="add"
						:aria-label="t('create_item')"
						:disabled
						data-action="create"
						@click="createItem"
					/>
				</template>
			</div>

			<BoTable
				v-if="layout === 'table'"
				v-model="selectionKeys"
				v-model:columns="headers"
				:sort="manualSort"
				:disabled="disabled && !nonEditable"
				:loading="loading"
				:rows="tableRows"
				row-key="$key"
				:spacing="tableSpacing"
				:show-select="!disabled && updateAllowed ? 'multiple' : 'none'"
				:show-manual-sort="allowDrag && !disabled"
				:manual-sort-key="relationInfo.sortField"
				show-resize
				@click:row="editRow"
				@update:rows="sortItems"
				@update:sort="manualSort = $event"
			>
				<template v-for="header in headers" :key="header.key" #[`item.${header.key}`]="{ item }">
					<RenderTemplate
						:title="header.key"
						:collection="relationInfo.relatedCollection.collection"
						:item="item"
						:template="`{{${header.key}}}`"
					/>
				</template>

				<template v-if="showTableActions" #header-append>
					<span class="sr-only">{{ t('actions') }}</span>
				</template>

				<template v-if="showTableActions" #item-append="{ item }">
					<div class="item-actions flex items-center justify-end gap-1">
						<template v-if="enableLink">
							<span
								v-if="(disabled && !nonEditable) || item['$type'] === 'created'"
								class="inline-flex h-8 w-8 items-center justify-center text-gray-400 dark:text-gray-600"
							>
								<BoIcon name="launch" size="sm" />
							</span>

							<RouterLink
								v-else
								:to="getLinkForItem(item)!"
								class="item-link"
								:class="ICON_BTN"
								:aria-label="t('navigate_to_item')"
								@keydown.stop
							>
								<BoIcon name="launch" size="sm" />
							</RouterLink>
						</template>

						<BoMenu
							v-if="tableMoveAllowed"
							:items="moveItems(rowIndex(item))"
							align="end"
						>
							<template #trigger>
								<button
									type="button"
									class="row-menu"
									:class="ICON_BTN"
									:aria-label="t('item_options', { item: rowIndex(item) + 1 })"
								>
									<BoIcon name="more_vert" size="sm" />
								</button>
							</template>
						</BoMenu>

						<BoRemove
							v-if="!nonEditable && (deleteAllowed || isLocalItem(item))"
							:disabled
							:class="{ deleted: item['$type'] === 'deleted' }"
							:item-type="item['$type']"
							:item-info="relationInfo"
							:item-is-local="isLocalItem(item)"
							:item-edits="getItemEdits(item)"
							@action="deleteItem(item)"
							@keydown.stop
						/>
					</div>
				</template>
			</BoTable>

			<template v-else-if="loading">
				<div
					v-for="num in clamp(totalItemCount - (page - 1) * limit, 1, limit)"
					:key="num"
					class="mb-2 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-gray-800"
					:class="totalItemCount > 4 ? 'h-10' : 'h-13'"
					aria-hidden="true"
				/>
			</template>

			<template v-else>
				<BoNotice v-if="displayItems.length === 0">
					{{ t('no_items') }}
				</BoNotice>

				<BoSortableList
					:model-value="displayItems"
					:item-key="(item: DisplayItem) => item[relationInfo!.relatedPrimaryKeyField.field] ?? `$index-${item.$index}`"
					:item-label="itemLabel"
					:disabled="disabled || !allowDrag || nonEditable"
					@update:model-value="sortItems($event)"
				>
					<template #item="{ element }">
						<div
							class="flex items-center gap-2"
							:class="{ 'deleted text-error-600 line-through dark:text-error-400': element.$type === 'deleted' }"
						>
							<button
								type="button"
								class="min-w-0 flex-1 rounded text-start text-sm text-gray-800 disabled:cursor-not-allowed dark:text-white/90"
								:class="[FOCUS, totalItemCount > 4 ? 'py-0.5' : 'py-1.5']"
								:disabled="disabled && !nonEditable"
								data-action="edit"
								@click="editItem(element)"
							>
								<RenderTemplate
									:collection="relationInfo.relatedCollection.collection"
									:item="element"
									:template="templateWithDefaults"
								/>
							</button>

							<div v-if="!nonEditable || enableLink" class="item-actions flex items-center gap-1">
								<template v-if="enableLink">
									<span
										v-if="(disabled && !nonEditable) || element.$type === 'created'"
										class="inline-flex h-8 w-8 items-center justify-center text-gray-400 dark:text-gray-600"
									>
										<BoIcon name="launch" size="sm" />
									</span>

									<RouterLink
										v-else
										:to="getLinkForItem(element)!"
										class="item-link"
										:class="ICON_BTN"
										:aria-label="t('navigate_to_item')"
										@keydown.stop
									>
										<BoIcon name="launch" size="sm" />
									</RouterLink>
								</template>

								<BoRemove
									v-if="!nonEditable && (deleteAllowed || isLocalItem(element))"
									:disabled
									:item-type="element.$type"
									:item-info="relationInfo"
									:item-is-local="isLocalItem(element)"
									:item-edits="getItemEdits(element)"
									@action="deleteItem(element)"
								/>
							</div>
						</div>
					</template>
				</BoSortableList>
			</template>

			<template v-if="layout === 'table'">
				<div v-if="pageCount > 1" class="actions mt-3 flex items-center gap-2">
					<div class="pagination flex items-center gap-2 text-theme-sm text-gray-500 dark:text-gray-400">
						<BoButton
							variant="secondary"
							icon="chevron_left"
							:aria-label="t('previous')"
							:disabled="(disabled && !nonEditable) || page <= 1"
							@click="page--"
						/>
						<span aria-live="polite">{{ page }} / {{ pageCount }}</span>
						<BoButton
							variant="secondary"
							icon="chevron_right"
							:aria-label="t('next')"
							:disabled="(disabled && !nonEditable) || page >= pageCount"
							@click="page++"
						/>
					</div>

					<div class="spacer grow" />

					<div v-if="loading === false" class="per-page w-28">
						<BoSelect
							:model-value="String(limit)"
							:label="t('per_page')"
							:disabled="disabled && !nonEditable"
							:items="['10', '20', '30', '50', '100'].map((value) => ({ text: value, value }))"
							@update:model-value="limit = Number($event)"
						/>
					</div>
				</div>
			</template>
			<template v-else>
				<div v-if="!nonEditable || pageCount > 1" class="actions mt-2 flex flex-wrap items-center gap-2">
					<template v-if="!nonEditable">
						<BoButton
							v-if="enableCreate && createAllowed && !hasSatisfiedUniqueConstraint"
							:disabled="disabled"
							data-action="create"
							@click="createItem"
						>
							{{ t('create_new') }}
						</BoButton>

						<BoButton
							v-if="enableSelect && updateAllowed && !hasSatisfiedUniqueConstraint"
							variant="secondary"
							:disabled="disabled"
							data-action="select"
							@click="selectModalActive = true"
						>
							{{ t('add_existing') }}
						</BoButton>
					</template>

					<div class="spacer grow" />

					<div
						v-if="pageCount > 1"
						class="pagination flex items-center gap-2 text-theme-sm text-gray-500 dark:text-gray-400"
					>
						<BoButton
							variant="secondary"
							icon="chevron_left"
							:aria-label="t('previous')"
							:disabled="(disabled && !nonEditable) || page <= 1"
							@click="page--"
						/>
						<span aria-live="polite">{{ page }} / {{ pageCount }}</span>
						<BoButton
							variant="secondary"
							icon="chevron_right"
							:aria-label="t('next')"
							:disabled="(disabled && !nonEditable) || page >= pageCount"
							@click="page++"
						/>
					</div>
				</div>
			</template>
		</div>

		<DrawerItem
			:disabled="disabled"
			:non-editable="nonEditable"
			:active="currentlyEditing !== null"
			:collection="relationInfo.relatedCollection.collection"
			:primary-key="currentlyEditing || '+'"
			:edits="editsAtStart"
			:circular-field="relationInfo.reverseJunctionField.field"
			@input="stageEdits"
			@update:active="cancelEdit"
		/>

		<DrawerCollection
			v-if="!disabled"
			v-model:active="selectModalActive"
			:collection="relationInfo.relatedCollection.collection"
			:filter="customFilter"
			multiple
			@input="select"
		/>

		<DrawerBatch
			v-model:active="batchEditActive"
			:primary-keys="selectedKeys"
			:collection="relationInfo.relatedCollection.collection"
			stage-on-save
			@input="stageBatchEdits"
		/>
	</div>
</template>
