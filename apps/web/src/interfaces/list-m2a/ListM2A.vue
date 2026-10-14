<!-- Ported from directus/app/src/interfaces/list-m2a/list-m2a.vue -->
<script setup lang="ts">
// Backoffice: rows are BoSortableList (SortableList row menu recipe, D-60): drag handle plus a row menu with the
// v-remove action (remove-action.ts, confirmation dialog here) and Move up / Move down, which emit the same sorted
// array as a drag (sortItems). The row content is a button that opens the item drawer. VPagination is the
// previous / next pair of DrawerCollection. A junction collection missing from the collections store (no read
// permission) shows `relationship_not_setup` instead of throwing. `version` defaults to null (the form may pass
// undefined, which use-relation-multiple would read as a version). v-prevent-focusout is not needed (portals).
import type { ContentVersion, Filter } from '@directus/types';
import { getFieldsFromTemplate } from '@directus/utils';
import { clamp, get, isEmpty, isNil, set } from 'lodash-es';
import { computed, inject, ref, toRefs, unref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../components/BoButton.vue';
import BoDialog from '../../components/BoDialog.vue';
import BoIcon from '../../components/BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../../components/BoMenu.vue';
import BoNotice from '../../components/BoNotice.vue';
import BoSelect from '../../components/BoSelect.vue';
import BoSortableList from '../../components/BoSortableList.vue';
import DrawerCollection from '../../components/drawers/DrawerCollection.vue';
import DrawerItem from '../../components/drawers/DrawerItem.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import RenderTemplate from '../../components/render/RenderTemplate.vue';
import { useRelationM2A } from '../../composables/use-relation-m2a.ts';
import {
	type DisplayItem,
	type RelationQueryMultiple,
	useRelationMultiple,
} from '../../composables/use-relation-multiple.ts';
import { useRelationPermissionsM2A } from '../../composables/use-relation-permissions.ts';
import { adjustFieldsForDisplays } from '../../utils/adjust-fields-for-displays.ts';
import { renderStringTemplate } from '../../utils/render-string-template.ts';
import { addRelatedPrimaryKeyToFields } from './add-related-primary-key-to-fields.ts';
import { getRemoveAction } from './remove-action.ts';
import { usePageSize } from './use-page-size.ts';

const props = withDefaults(
	defineProps<{
		value?: (number | string | Record<string, any>)[] | Record<string, any> | null;
		primaryKey: string | number;
		collection: string;
		field: string;
		disabled?: boolean;
		nonEditable?: boolean;
		version?: ContentVersion | null;
		enableCreate?: boolean;
		enableSelect?: boolean;
		limit?: number;
		prefix?: string | null;
		allowDuplicates?: boolean;
	}>(),
	{
		value: () => [],
		disabled: false,
		nonEditable: false,
		version: null,
		enableCreate: true,
		enableSelect: true,
		limit: 15,
		prefix: null,
		allowDuplicates: false,
	},
);

defineOptions({ name: 'InterfaceListM2A' });

const emit = defineEmits(['input']);
const { t, te } = useI18n();
const a11y = inject(FORM_FIELD_A11Y, null);
const { collection, field, primaryKey, limit, version } = toRefs(props);
const { relationInfo: m2aRelationInfo } = useRelationM2A(collection, field);

// Backoffice: a junction collection missing from the collections store (no read permission) counts as no relation.
const relationInfo = computed(() =>
	m2aRelationInfo.value?.junctionCollection ? m2aRelationInfo.value : undefined,
);

const value = computed({
	get: () => props.value,
	set: (val) => {
		emit('input', val);
	},
});

const allowedCollections = computed(() => {
	if (!relationInfo.value) return [];
	return relationInfo.value.allowedCollections.filter((collection) => collection.meta?.singleton !== true);
});

const templates = computed(() => {
	if (!relationInfo.value) return {};
	const templates: Record<string, string> = {};

	for (const collection of allowedCollections.value) {
		const primaryKeyField = relationInfo.value.relationPrimaryKeyFields[collection.collection];
		templates[collection.collection] = collection.meta?.display_template || `{{${primaryKeyField?.field}}}`;
	}

	return templates;
});

const fields = computed(() => {
	if (!relationInfo.value) return [];
	const fields: string[] = [];

	for (const collection of allowedCollections.value) {
		const displayFields: string[] = adjustFieldsForDisplays(
			getFieldsFromTemplate(templates.value[collection.collection]!),
			collection.collection,
		).map((field) => `${relationInfo.value?.junctionField.field}:${collection.collection}.${field}`);

		fields.push(...addRelatedPrimaryKeyToFields(collection.collection, displayFields));
	}

	if (props.prefix) {
		fields.push(...getFieldsFromTemplate(props.prefix));
	}

	return fields;
});

const { sizes: pageSizes, selected: selectedPageSize } = usePageSize<string>(
	computed(() => [10, 25, 50, 100, limit.value].filter((v) => v >= limit.value).sort((a, b) => a - b)),
	(value) => String(value),
	limit.value,
);

const limitWritable = ref(selectedPageSize);
const pageCount = computed(() => Math.ceil(totalItemCount.value / limitWritable.value));
const page = ref(1);

watch(limitWritable, (newLimit, oldLimit) => {
	const offset = (page.value - 1) * oldLimit;
	page.value = Math.floor(offset / newLimit + 1);
});

const query = computed<RelationQueryMultiple>(() => ({
	fields: fields.value,
	limit: limitWritable.value,
	page: page.value,
}));

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

function sortItems(items: DisplayItem[]) {
	const info = relationInfo.value;
	const sortField = info?.sortField;
	if (!info || !sortField) return;

	const sortedItems = items.map((item, index) => {
		const junctionId = item?.[info.junctionPrimaryKeyField.field];
		const collection = item?.[info.collectionField.field];
		const pkField = info.relationPrimaryKeyFields[collection]!.field;
		const relatedId = item?.[info.junctionField.field]?.[pkField];

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

		if (!isNil(collection)) {
			changes[info.collectionField.field] = collection;
		}

		if (!isNil(relatedId)) {
			set(changes, info.junctionField.field + '.' + pkField, relatedId);
		}

		return changes;
	});

	update(...sortedItems);
}

const editModalActive = ref(false);
const currentlyEditing = ref<string | number | null>(null);
const relatedPrimaryKey = ref<string | number | null>(null);
const editingCollection = ref<string | null>(null);
const selectingFrom = ref<string | null>(null);
const editsAtStart = ref<Record<string, any>>({});
let newItem = false;

function createItem(collection: string) {
	if (!relationInfo.value) return;

	currentlyEditing.value = null;
	relatedPrimaryKey.value = null;

	editsAtStart.value = {
		[relationInfo.value.collectionField.field]: collection,
		[relationInfo.value.junctionField.field]: {},
	};

	newItem = true;
	editModalActive.value = true;
}

function editItem(item: DisplayItem) {
	if (!relationInfo.value) return;

	const relationPkField =
		relationInfo.value.relationPrimaryKeyFields[item[relationInfo.value.collectionField.field]]!.field;

	const junctionField = relationInfo.value.junctionField.field;
	const junctionPkField = relationInfo.value.junctionPrimaryKeyField.field;

	newItem = false;

	editsAtStart.value = {
		...getItemEdits(item),
		[relationInfo.value.collectionField.field]: item[relationInfo.value.collectionField.field],
	};

	editModalActive.value = true;
	editingCollection.value = item[relationInfo.value.collectionField.field];

	if (item?.$type === 'created' && !isItemSelected(item)) {
		currentlyEditing.value = null;
		relatedPrimaryKey.value = null;
		editingCollection.value = null;
	} else {
		if (!relationPkField) return;
		currentlyEditing.value = get(item, [junctionPkField], null);
		relatedPrimaryKey.value = get(item, [junctionField, relationPkField], null);
	}
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
		page.value === Math.ceil(totalItemCount.value / limitWritable.value) &&
		page.value !== Math.ceil((totalItemCount.value - 1) / limitWritable.value)
	) {
		page.value = Math.max(1, page.value - 1);
	}

	remove(item);
}

function hasAllowedCollection(item: DisplayItem) {
	const info = relationInfo.value;
	if (!info) return false;
	return (
		allowedCollections.value.findIndex((coll) => coll.collection === item[info.collectionField.field]) !== -1
	);
}

function getPrefix(item: DisplayItem) {
	if (props.prefix) return renderStringTemplate(props.prefix, item).displayValue.value;

	const info = relationInfo.value;
	if (!info) return false;

	const collection = allowedCollections.value.find((coll) => coll.collection === item[info.collectionField.field]);

	if (te(`collection_names_singular.${collection?.collection}`)) {
		return t(`collection_names_singular.${collection?.collection}`);
	}

	if (te(`collection_names_plural.${collection?.collection}`)) {
		return t(`collection_names_plural.${collection?.collection}`);
	}

	return collection?.name;
}

const customFilter = computed(() => {
	const info = relationInfo.value;

	if (!info || !selectingFrom.value || props.allowDuplicates) return {};

	const filter: Filter = {
		_and: [],
	};

	const reverseRelation = `$FOLLOW(${info.junctionCollection.collection},${info.junctionField.field},${info.collectionField.field})`;

	const selectFilter = {
		[reverseRelation]: {
			_none: {
				_and: [
					{
						[info.reverseJunctionField.field]: {
							_eq: props.primaryKey,
						},
					},
					{
						[info.collectionField.field]: {
							_eq: unref(selectingFrom),
						},
					},
				],
			},
		},
	} as Filter;

	const junctionField = info.junctionField.field;

	const selectedPrimaryKeys = selected.value.reduce(
		(acc, item) => {
			const relatedPKField = info.relationPrimaryKeyFields[item[info.collectionField.field]]!.field;
			if (item[info.collectionField.field] === selectingFrom.value) acc.push(item[junctionField][relatedPKField]);
			return acc;
		},
		[] as (string | number)[],
	);

	if (selectedPrimaryKeys.length > 0) {
		filter._and.push({
			[info.relationPrimaryKeyFields[selectingFrom.value]!.field]: {
				_nin: selectedPrimaryKeys,
			},
		});
	}

	if (props.primaryKey !== '+') filter._and.push(selectFilter);

	return filter;
});

const { createAllowed, deleteAllowed, selectAllowed, updateAllowed } = useRelationPermissionsM2A(relationInfo);

const createCollections = computed(() => {
	const info = relationInfo.value;
	if (!info) return [];

	return info.allowedCollections.filter((collection) => {
		return createAllowed.value[collection.collection];
	});
});

// Backoffice: Directus reads `updateAllowed` (a per-collection record) as a boolean, so any record is truthy.
const canDrag = computed(() => relationInfo.value?.sortField !== undefined && !!updateAllowed.value);
const allowDrag = computed(() => canDrag.value && totalItemCount.value <= limitWritable.value);

const createMenuItems = computed<BoMenuItem[]>(() =>
	allowedCollections.value.map((availableCollection) => ({
		text: availableCollection.name,
		icon: availableCollection.icon,
		onSelect: () => createItem(availableCollection.collection),
	})),
);

const selectMenuItems = computed<BoMenuItem[]>(() =>
	allowedCollections.value.map((availableCollection) => ({
		text: availableCollection.name,
		icon: availableCollection.icon,
		onSelect: () => (selectingFrom.value = availableCollection.collection),
	})),
);

// v-remove of each row, in the row menu (hidden when non-editable, as the Directus item-actions).
const confirmRemoveItem = ref<DisplayItem | null>(null);

function rowActions(element: DisplayItem): BoMenuItem[] {
	const info = relationInfo.value;
	if (!info || props.nonEditable || props.disabled) return [];

	const allowed = hasAllowedCollection(element);
	if (allowed && !deleteAllowed.value[element[info.collectionField.field]] && !isLocalItem(element)) return [];

	const action = getRemoveAction({
		itemType: element.$type,
		itemInfo: info,
		itemIsLocal: isLocalItem(element),
		itemEdits: getItemEdits(element),
	});

	return [
		{
			text: t(action.text),
			icon: action.icon,
			onSelect: () => (action.needsConfirmation ? (confirmRemoveItem.value = element) : deleteItem(element)),
		},
	];
}

function onConfirmRemove() {
	const item = confirmRemoveItem.value;
	confirmRemoveItem.value = null;
	if (item) deleteItem(item);
}

function itemKey(element: DisplayItem): string | number {
	return element[relationInfo.value!.junctionPrimaryKeyField.field] ?? `+${element.$index}`;
}

function itemLabel(element: DisplayItem): string {
	const info = relationInfo.value!;
	if (!hasAllowedCollection(element)) return t('invalid_item');
	const coll = element[info.collectionField.field];

	const rendered = renderStringTemplate(templates.value[coll] ?? '', element[info.junctionField.field]).displayValue
		.value;

	return [getPrefix(element), rendered]
		.filter(Boolean)
		.map((part) => String(part).trim())
		.join(' ');
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<BoNotice v-if="!relationInfo" type="warning">{{ t('relationship_not_setup') }}</BoNotice>
	<BoNotice v-else-if="allowedCollections.length === 0" type="warning">{{ t('no_singleton_relations') }}</BoNotice>
	<div
		v-else
		class="m2a-builder space-y-3"
		role="group"
		:aria-labelledby="a11y?.labelId"
		:aria-describedby="a11y?.describedBy"
		:aria-invalid="a11y?.invalid || undefined"
	>
		<BoNotice v-if="!disabled && canDrag && !allowDrag" class="sorting-disabled">
			{{ t('interfaces.list-m2a.sorting_disabled') }}
		</BoNotice>

		<div v-if="loading" aria-busy="true" class="space-y-2">
			<div
				v-for="n in clamp(totalItemCount - (page - 1) * limitWritable, 1, limitWritable)"
				:key="n"
				class="animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-white/5"
				:class="totalItemCount > 4 ? 'h-9' : 'h-11'"
			/>
			<span class="sr-only">{{ t('loading') }}</span>
		</div>

		<template v-else>
			<BoNotice v-if="displayItems.length === 0" class="no-items">{{ t('no_items') }}</BoNotice>

			<BoSortableList
				v-else
				:model-value="displayItems"
				:item-key="itemKey"
				:item-label="itemLabel"
				:row-actions="rowActions"
				:disabled="disabled || !allowDrag || nonEditable"
				@update:model-value="sortItems"
			>
				<template #item="{ element }">
					<button
						v-if="hasAllowedCollection(element)"
						type="button"
						class="row flex w-full min-w-0 items-center rounded text-start text-sm text-gray-800 disabled:cursor-not-allowed disabled:text-gray-500 dark:text-white/90 dark:disabled:text-gray-400"
						:class="[FOCUS, { 'deleted line-through': element.$type === 'deleted' }]"
						:disabled="disabled && !nonEditable"
						@click="editItem(element)"
					>
						<span
							class="collection me-[1ch] whitespace-nowrap"
							:class="
								disabled && !nonEditable
									? ''
									: element.$type === 'deleted'
										? 'text-error-600 dark:text-error-400'
										: 'text-brand-500 dark:text-brand-400'
							"
						>
							{{ getPrefix(element) }}:
						</span>

						<RenderTemplate
							:collection="element[relationInfo.collectionField.field]"
							:template="templates[element[relationInfo.collectionField.field]]!"
							:item="element[relationInfo.junctionField.field]"
						/>
					</button>

					<span
						v-else
						class="invalid flex items-center gap-2 text-sm text-gray-800 dark:text-white/90"
						:class="{ 'deleted line-through': element.$type === 'deleted' }"
					>
						<BoIcon name="warning" size="sm" class="text-error-600 dark:text-error-400" />
						{{ t('invalid_item') }}
					</span>
				</template>
			</BoSortableList>
		</template>

		<div v-if="!nonEditable" class="actions flex flex-wrap items-center gap-2">
			<BoMenu v-if="enableCreate && createCollections.length > 0" :items="createMenuItems">
				<template #trigger>
					<BoButton class="create" :disabled="disabled">
						{{ t('create_new') }}
						<BoIcon name="arrow_drop_down" size="sm" />
					</BoButton>
				</template>
			</BoMenu>

			<BoMenu v-if="enableSelect && selectAllowed" :items="selectMenuItems">
				<template #trigger>
					<BoButton class="select" variant="secondary" :disabled="disabled">
						{{ t('add_existing') }}
						<BoIcon name="arrow_drop_down" size="sm" />
					</BoButton>
				</template>
			</BoMenu>

			<div
				v-if="pageCount > 1 || limitWritable !== limit"
				class="pagination ms-auto flex flex-wrap items-center gap-x-3.5 gap-y-2"
			>
				<div v-if="pageSizes.length > 1" class="per-page w-28">
					<BoSelect
						:model-value="`${limitWritable}`"
						:items="pageSizes.map((size) => ({ text: size, value: size }))"
						:label="t('per_page')"
						@update:model-value="limitWritable = +$event"
					/>
				</div>

				<div class="flex items-center gap-2 text-theme-sm text-gray-500 dark:text-gray-400">
					<BoButton
						variant="secondary"
						icon="chevron_left"
						class="previous"
						:aria-label="t('previous')"
						:disabled="page <= 1"
						@click="page--"
					/>
					<span aria-live="polite">{{ page }} / {{ pageCount }}</span>
					<BoButton
						variant="secondary"
						icon="chevron_right"
						class="next"
						:aria-label="t('next')"
						:disabled="page >= pageCount"
						@click="page++"
					/>
				</div>
			</div>
		</div>

		<DrawerCollection
			v-if="!disabled && selectingFrom"
			multiple
			:active="!!selectingFrom"
			:collection="selectingFrom"
			:filter="customFilter"
			@input="select($event!, selectingFrom ?? undefined)"
			@update:active="selectingFrom = null"
		/>

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
			@input="stageEdits"
		/>

		<BoDialog
			:open="confirmRemoveItem !== null"
			:title="t('batch_delete_confirm', 1)"
			@update:open="!$event && (confirmRemoveItem = null)"
		>
			<template #actions>
				<BoButton variant="secondary" @click="confirmRemoveItem = null">{{ t('cancel') }}</BoButton>
				<BoButton variant="danger" @click="onConfirmRemove">{{ t('delete_label') }}</BoButton>
			</template>
		</BoDialog>
	</div>
</template>
