<!-- Ported from directus/app/src/interfaces/list-m2m/list-m2m.vue -->
<script setup lang="ts">
// Backoffice: template rewritten with the Bo* components. List layout: BoSortableList (drag handle plus the D-60 row
// menu "Move up" / "Move down"); table layout: BoTable, whose rows have no click event, append slot or drag handle,
// so a trailing actions column holds the row buttons (edit = row click, link, remove) and, when sorting is allowed,
// the D-60 move menu; a click on a row still opens it like v-table `click:row`. Rows are keyed by `$key` (primary key,
// else `$index` of a created item) since BoTable selects by key while v-table selects item objects. The search input
// is a plain search (the filter of search-input.vue comes with 014, D-58); pagination is previous/next (no
// v-pagination yet). v-prevent-focusout is not needed (the drawers are Reka dialogs that keep the focus).
// Row keys are the junction primary key. localStorage key `directus-m2m-column-widths-*` ->
// `backoffice-m2m-column-widths-*` (D-39). The ported helpers (column widths, items count, related primary keys,
// v-remove) are shared with list-o2m as in Directus.
import type { ContentVersion, Filter } from '@directus/types';
import { deepMap, getFieldsFromTemplate } from '@directus/utils';
import { clamp, get, isEmpty, isNil, merge, set } from 'lodash-es';
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
import { useRelationM2M } from '../../composables/use-relation-m2m.ts';
import { useRelationPermissionsM2M } from '../../composables/use-relation-permissions.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { adjustFieldsForDisplays } from '../../utils/adjust-fields-for-displays.ts';
import { getItemRoute } from '../../utils/get-item-route.ts';
import { addRelatedPrimaryKeyToFields } from '../list-o2m/add-related-primary-key-to-fields.ts';
import BoRemove from '../list-o2m/BoRemove.vue';
import { formatItemsCountPaginated } from '../list-o2m/format-items-count.ts';
import { useColumnWidths } from '../list-o2m/use-column-widths.ts';

// Backoffice: LAYOUTS of @/types/interfaces as string literals.
type Layout = 'list' | 'table';

const props = withDefaults(
	defineProps<{
		value?: (number | string | Record<string, any>)[] | Record<string, any> | null;
		primaryKey: string | number | null;
		collection: string;
		field: string;
		width?: string;
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
		disabled?: boolean;
		nonEditable?: boolean;
		limit?: number;
		allowDuplicates?: boolean;
		junctionFieldLocation?: string;
		junctionFilter?: Filter | null;
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
		allowDuplicates: false,
		junctionFieldLocation: 'bottom',
		junctionFilter: null,
	},
);

const emit = defineEmits<{ input: [value: any] }>();
const { t, n } = useI18n();
const { collection, field, primaryKey, version } = toRefs(props);
const { relationInfo } = useRelationM2M(collection, field);
const fieldsStore = useFieldsStore();
const a11y = inject(FORM_FIELD_A11Y, null);

const value = computed({
	get: () => props.value,
	set: (val) => {
		emit('input', val);
	},
});

const templateWithDefaults = computed(() => {
	if (!relationInfo.value) return null;

	if (props.template) return props.template;

	if (relationInfo.value.junctionCollection.meta?.display_template) {
		return relationInfo.value.junctionCollection.meta.display_template;
	}

	let relatedDisplayTemplate = relationInfo.value.relatedCollection.meta?.display_template;

	if (relatedDisplayTemplate) {
		const regex = /({{.*?}})/g;
		const parts = relatedDisplayTemplate.split(regex).filter((p) => p);

		for (const part of parts) {
			if (part.startsWith('{{') === false) continue;
			const key = part.replace(/{{/g, '').replace(/}}/g, '').trim();
			const newPart = `{{${relationInfo.value.relation.field}.${key}}}`;

			relatedDisplayTemplate = relatedDisplayTemplate.replace(part, newPart);
		}

		return relatedDisplayTemplate;
	}

	return `{{${relationInfo.value.relation.field}.${relationInfo.value.relatedPrimaryKeyField.field}}}`;
});

const fields = computed(() => {
	if (!relationInfo.value) return [];

	let displayFields: string[] = [];
	if (props.layout === 'table') {
		displayFields = adjustFieldsForDisplays(props.fields, relationInfo.value.junctionCollection.collection);
	} else {
		displayFields = adjustFieldsForDisplays(
			getFieldsFromTemplate(templateWithDefaults.value),
			relationInfo.value.junctionCollection.collection,
		);
	}

	return addRelatedPrimaryKeyToFields(relationInfo.value.junctionCollection.collection, displayFields);
});

const limit = ref(props.limit);
const page = ref(1);
const search = ref('');
const searchFilter = ref<Filter>();

const sort = ref<BoTableSort | null>(null);
const junctionFilter = ref<Filter | null>(props.junctionFilter ?? null);

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

	if (junctionFilter.value) {
		if (q.filter) {
			q.filter = { _and: [q.filter, junctionFilter.value] };
		} else {
			q.filter = junctionFilter.value;
		}
	}

	if (search.value) {
		q.search = search.value;
	}

	if (sort.value) {
		q.sort = [`${sort.value.desc ? '-' : ''}${sort.value.by}`];
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
} = useRelationMultiple(value, query, relationInfo, primaryKey, version);

const { createAllowed, updateAllowed, deleteAllowed, selectAllowed } = useRelationPermissionsM2M(relationInfo);

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

const { getWidth, updateWidths } = useColumnWidths(
	() => `backoffice-m2m-column-widths-${collection.value}-${field.value}`,
);

const headers = computed<BoTableColumn[]>({
	get: () => {
		if (!relationInfo.value) return [];

		const junctionCollection = relationInfo.value.junctionCollection.collection;

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
				const field = fieldsStore.getField(junctionCollection, key);

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
		const junctionId = item?.[info.junctionPrimaryKeyField.field];
		const relatedId = item?.[info.junctionField.field]?.[info.relatedPrimaryKeyField.field];

		const changes: Record<string, any> = {
			$index: item.$index,
			$type: item.$type,
			$edits: item.$edits,
			...getItemEdits(item),
			[sortField]: index + 1,
		};

		if (!isNil(junctionId)) {
			changes[info.junctionPrimaryKeyField.field] = junctionId;
		}

		if (!isNil(relatedId)) {
			set(changes, info.junctionField.field + '.' + info.relatedPrimaryKeyField.field, relatedId);
		}

		return changes;
	});

	update(...sortedItems);
}

const selectedPrimaryKeys = computed(() => {
	if (!relationInfo.value) return [];

	const relatedPkField = relationInfo.value.relatedPrimaryKeyField.field;
	const junctionField = relationInfo.value.junctionField.field;

	return selected.value.map((item) => item[junctionField][relatedPkField]);
});

const editModalActive = ref(false);
const currentlyEditing = ref<string | number | null>(null);
const relatedPrimaryKey = ref<string | number | null>(null);
const selectModalActive = ref(false);
const editsAtStart = ref<Record<string, any>>({});
let newItem = false;

function createItem() {
	currentlyEditing.value = null;
	relatedPrimaryKey.value = null;
	editsAtStart.value = {};
	newItem = true;
	editModalActive.value = true;
}

function editItem(item: DisplayItem) {
	if (!relationInfo.value) return;

	const relatedPkField = relationInfo.value.relatedPrimaryKeyField.field;
	const junctionField = relationInfo.value.junctionField.field;
	const junctionPkField = relationInfo.value.junctionPrimaryKeyField.field;

	editsAtStart.value = getItemEdits(item);
	newItem = false;
	editModalActive.value = true;

	if (item?.$type === 'created' && !isItemSelected(item)) {
		currentlyEditing.value = null;
		relatedPrimaryKey.value = null;
	} else {
		currentlyEditing.value = get(item, [junctionPkField], null);
		relatedPrimaryKey.value = get(item, [junctionField, relatedPkField], null);
	}
}

function editRow({ item }: { item: DisplayItem }) {
	editItem(item);
}

function stageEdits(item: Record<string, any>) {
	if (isEmpty(item)) return;

	if (newItem) {
		create(item);
	} else {
		update(item);
	}
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
			(item) => item[relationInfo.value!.junctionPrimaryKeyField.field] ?? item.$index ?? null,
		)
		.filter((key) => !isNil(key));
});

function stageBatchEdits(edits: Record<string, any>) {
	if (!relationInfo.value) return;

	const relatedPkField = relationInfo.value.relatedPrimaryKeyField.field;
	const junctionField = relationInfo.value.junctionField.field;
	const junctionPkField = relationInfo.value.junctionPrimaryKeyField.field;

	for (const item of selection.value) {
		const junctionId = get(item, [junctionPkField], null);
		const relatedId = get(item, [junctionField, relatedPkField], null);

		const changes: Record<string, any> = {
			$index: item.$index,
			$type: item.$type,
			$edits: item.$edits,
			...merge(getItemEdits(item), {
				[junctionField]: {
					...edits,
				},
			}),
		};

		if (junctionId !== null) {
			changes[junctionPkField] = junctionId;
		}

		if (relatedId !== null) {
			set(changes, [junctionField, relatedPkField], relatedId);
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

	if (!relationInfo.value || props.allowDuplicates) return filter;

	const reverseRelation = `$FOLLOW(${relationInfo.value.junctionCollection.collection},${relationInfo.value.junctionField.field})`;

	const selectFilter: Filter = {
		[reverseRelation]: {
			_none: {
				[relationInfo.value.reverseJunctionField.field]: {
					_eq: props.primaryKey,
				},
			},
		},
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
		const primaryKey = get(item, [
			relationInfo.value.junctionField.field,
			relationInfo.value.relatedPrimaryKeyField.field,
		]);

		return getItemRoute(relationInfo.value.relatedCollection.collection, primaryKey);
	}

	return null;
}

// Backoffice: BoTable selects row keys; `$key` is the v-table item-key, or `$index` for a created item without one.
function useTableRows() {
	const selectionKeys = ref<(string | number)[]>([]);

	const tableRows = computed(() => {
		const pkField = relationInfo.value?.junctionPrimaryKeyField.field ?? 'id';
		return displayItems.value.map((item) => ({ ...item, $key: item[pkField] ?? `$index-${item.$index}` }));
	});

	const selection = computed<DisplayItem[]>({
		get: () => tableRows.value.filter((row) => selectionKeys.value.includes(row.$key)),
		set: (rows) => (selectionKeys.value = rows.map((row) => row['$key'])),
	});

	return { tableRows, selection, selectionKeys };
}

// Backoffice: v-table `click:row`; buttons, links, checkboxes and the resize handle keep their own click.
function onTableClick(event: MouseEvent) {
	if (props.disabled && !props.nonEditable) return;

	const target = event.target as HTMLElement;
	if (target.closest('button, a, input, [role="checkbox"], [data-resize-handle]')) return;

	const row = target.closest('tbody > tr');
	if (!row?.parentElement) return;

	const item = displayItems.value[Array.from(row.parentElement.children).indexOf(row)];
	if (item) editRow({ item });
}

// Backoffice: D-60 "Move up" / "Move down" of a table row (v-table manual sort is a mouse drag).
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

const showTableActions = computed(() => !props.nonEditable || props.enableLink);

const tableColumns = computed<BoTableColumn[]>({
	get: () =>
		showTableActions.value
			? [...headers.value, { key: '$actions', label: t('actions'), sortable: false, width: 160 }]
			: headers.value,
	set: (val) => (headers.value = val.filter((column) => column.key !== '$actions')),
});

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
		class="many-to-many"
		role="group"
		:aria-labelledby="a11y?.labelId"
		:aria-describedby="a11y?.describedBy"
		:aria-invalid="a11y?.invalid ? 'true' : undefined"
	>
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
						v-if="enableSelect && selectAllowed"
						:variant="enableCreate ? 'secondary' : 'primary'"
						icon="playlist_add"
						:aria-label="selectAllowed ? t('add_existing') : t('not_allowed')"
						:disabled
						data-action="select"
						@click="selectModalActive = true"
					/>

					<BoButton
						v-if="enableCreate && createAllowed && selectAllowed"
						icon="add"
						:aria-label="createAllowed ? t('create_item') : t('not_allowed')"
						:disabled
						data-action="create"
						@click="createItem"
					/>
				</template>
			</div>

			<!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -- the row buttons give the keyboard path -->
			<div v-if="layout === 'table'" @click="onTableClick">
				<BoTable
					v-model="selectionKeys"
					v-model:columns="tableColumns"
					:sort="sort"
					:disabled="disabled && !nonEditable"
					:loading="loading"
					:rows="tableRows"
					row-key="$key"
					:spacing="tableSpacing"
					:show-select="!disabled && updateAllowed ? 'multiple' : 'none'"
					show-resize
					@update:sort="sort = $event"
				>
					<template v-for="header in headers" :key="header.key" #[`item.${header.key}`]="{ item }">
						<RenderTemplate
							:title="header.key"
							:collection="relationInfo.junctionCollection.collection"
							:item="item"
							:template="`{{${header.key}}}`"
						/>
					</template>

					<template #[`header.$actions`]>
						<span class="sr-only">{{ t('actions') }}</span>
					</template>

					<template #[`item.$actions`]="{ item }">
						<div class="item-actions flex items-center justify-end gap-1">
							<button
								v-if="!(disabled && !nonEditable)"
								type="button"
								:class="ICON_BTN"
								:aria-label="t('edit_item')"
								data-action="edit"
								@click="editRow({ item })"
							>
								<BoIcon name="edit" size="sm" />
							</button>

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
								v-if="allowDrag && !disabled && displayItems.length > 1"
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
			</div>

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
					:item-key="
						(item: DisplayItem) => item[relationInfo!.junctionPrimaryKeyField.field] ?? `$index-${item.$index}`
					"
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
									:collection="relationInfo.junctionCollection.collection"
									:item="element"
									:template="templateWithDefaults ?? ''"
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
							v-if="enableCreate && createAllowed"
							:disabled="disabled"
							data-action="create"
							@click="createItem"
						>
							{{ t('create_new') }}
						</BoButton>

						<BoButton
							v-if="enableSelect && selectAllowed"
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
			v-model:active="editModalActive"
			:disabled="disabled"
			:non-editable="nonEditable"
			:collection="relationInfo.junctionCollection.collection"
			:primary-key="currentlyEditing || '+'"
			:related-primary-key="relatedPrimaryKey || '+'"
			:junction-field="relationInfo.junctionField.field"
			:edits="editsAtStart"
			:circular-field="relationInfo.reverseJunctionField.field"
			:junction-field-location="junctionFieldLocation"
			@input="stageEdits"
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
