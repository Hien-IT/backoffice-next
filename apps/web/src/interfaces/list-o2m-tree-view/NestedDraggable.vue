<!-- Ported from directus/app/src/interfaces/list-o2m-tree-view/NestedDraggable.vue -->
<script setup lang="ts">
// Backoffice: each level is a BoSortableList in `tree` mode (SortableList row menu recipe, D-60) sharing the
// vuedraggable group `g1` as DR, so a mouse drag moves rows across levels (`added` / `removed` go to change());
// deleted rows are not draggable (DR `draggable=".draggable"`). A drag or Move up / Move down inside a level
// emits the reordered array, which is the `moved` event of DR (sort). "Indent" (make the row the last child of
// its previous sibling) and "Outdent" (move the row after its parent) replay the vuedraggable events of the
// equivalent drag: `added` on the target level, then `removed` on the source level, through the same change()
// handler, so the value is the one a drag gives. The edit icon and v-remove of item-preview.vue are row menu actions
// here, with one item drawer per level. updateModelValue reads the row from the list shown (DR reads
// displayItems with the index of the filtered list).
import type { ContentVersion, Filter } from '@directus/types';
import { until } from '@vueuse/core';
import { cloneDeep } from 'lodash-es';
import { computed, nextTick, ref, toRefs, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../components/BoButton.vue';
import BoDialog from '../../components/BoDialog.vue';
import type { BoMenuItem } from '../../components/BoMenu.vue';
import BoNotice from '../../components/BoNotice.vue';
import { getRemoveAction } from '../../components/BoRemove.vue';
import BoSortableList from '../../components/BoSortableList.vue';
import DrawerCollection from '../../components/drawers/DrawerCollection.vue';
import DrawerItem from '../../components/drawers/DrawerItem.vue';
import {
	type ChangesItem,
	type DisplayItem,
	type RelationQueryMultiple,
	useRelationMultiple,
} from '../../composables/use-relation-multiple.ts';
import type { RelationO2M } from '../../composables/use-relation-o2m.ts';
import { type APIError, translateAPIError } from '../../lang/index.ts';
import { renderStringTemplate } from '../../utils/render-string-template.ts';
import ItemPreview from './ItemPreview.vue';

export type ChangeEvent =
	| {
			added: {
				newIndex: number;
				element: DisplayItem;
			};
	  }
	| {
			removed: {
				oldIndex: number;
				element: DisplayItem;
			};
	  }
	| {
			moved: {
				newIndex: number;
				oldIndex: number;
				element: DisplayItem;
			};
	  };

/** What a level exposes to its parent level for Indent / Outdent. */
export type NestedLevel = { change: (event: ChangeEvent) => void; loaded: () => Promise<unknown> };

const props = withDefaults(
	defineProps<{
		modelValue?: ChangesItem | undefined;
		collection: string;
		field: string;
		primaryKey: string | number;
		disabled?: boolean;
		nonEditable?: boolean;
		version: ContentVersion | null;
		template: string;
		filter?: Filter | null;
		fields: string[];
		relationInfo: RelationO2M;
		root?: boolean;
		enableCreate: boolean;
		enableSelect: boolean;
		customFilter: Filter;
		itemsMoved: (string | number)[];
	}>(),
	{
		disabled: false,
		nonEditable: false,
		filter: null,
		root: false,
		modelValue: undefined,
	},
);

const emit = defineEmits(['update:modelValue', 'outdent']);

const { t } = useI18n();

const value = computed<ChangesItem | any[]>({
	get() {
		if (props.modelValue === undefined) return [];
		return props.modelValue as ChangesItem;
	},
	set: (val) => {
		emit('update:modelValue', val);
	},
});

const { collection, field, primaryKey, relationInfo, fields, template, customFilter, version } = toRefs(props);

const addNewActive = defineModel<boolean>('addNewOpen');
const selectDrawer = defineModel<boolean>('selectOpen');

const open = ref<Record<string, boolean>>({});

const limit = ref(-1);
const page = ref(1);

const query = computed<RelationQueryMultiple>(() => ({
	fields: fields.value,
	limit: limit.value,
	page: page.value,
}));

const {
	displayItems,
	loading,
	error: loadError,
	create,
	update,
	remove,
	select,
	cleanItem,
	isLocalItem,
	getItemEdits,
} = useRelationMultiple(value, query, relationInfo, primaryKey, version);

const filteredDisplayItems = computed(() => {
	return displayItems.value.filter(
		(item) =>
			!(props.itemsMoved.includes(item[relationInfo.value.relatedPrimaryKeyField.field]) && item.$type === undefined),
	);
});

function updateModelValue(changes: ChangesItem, index: number) {
	const pkField = relationInfo.value?.relatedPrimaryKeyField.field;
	if (!pkField) return;

	update({
		...filteredDisplayItems.value[index],
		[field.value]: changes,
	});
}

function change(event: ChangeEvent) {
	if ('added' in event) {
		switch (event.added.element.$type) {
			case 'created':
				create(cleanItem(event.added.element));
				break;

			case 'updated': {
				const pkField = relationInfo.value.relatedPrimaryKeyField.field;
				const exists = displayItems.value.find((item) => item[pkField] === event.added.element[pkField]);

				// We have to make sure we remove the reverseJunctionField when we move it back to its initial position as otherwise it will be selected.
				update({
					...cleanItem(event.added.element),
					[relationInfo.value.reverseJunctionField.field]: exists ? undefined : primaryKey.value,
				});

				break;
			}

			default:
				update({
					...event.added.element,
					[relationInfo.value.reverseJunctionField.field]: primaryKey.value,
				});
		}
	} else if ('removed' in event && '$type' in event.removed.element) {
		remove({
			...event.removed.element,
			[relationInfo.value.reverseJunctionField.field]: primaryKey.value,
		});
	}
}

// The `moved` branch of change(): BoSortableList gives the reordered list (moveInArray of DR) as
// update:modelValue, also for Move up / Move down.
function sort(sortedList: DisplayItem[]) {
	const sortField = relationInfo.value.sortField;
	if (!sortField) return;

	const sortedItems = cloneDeep(sortedList).map((item, index) => ({
		...item,
		[sortField]: index,
	}));

	update(...sortedItems);
}

function addNew(item: Record<string, any>) {
	item[relationInfo.value.reverseJunctionField.field] = primaryKey.value;
	create(item);
}

function stageEdits(item: Record<string, any>) {
	update(item);
}

/* Keyboard Indent / Outdent (D-60) */

const rootEl = useTemplateRef<HTMLElement>('rootEl');
const childLevels: Record<string, NestedLevel | null> = {};

function keyOf(element: DisplayItem): string | number {
	return element[relationInfo.value.relatedPrimaryKeyField.field] ?? `+${element.$index}`;
}

async function focusRow(element: DisplayItem) {
	await nextTick();
	const key = CSS.escape(String(keyOf(element)));
	rootEl.value?.querySelector<HTMLElement>(`[data-row-key="${key}"] .row-menu`)?.focus();
}

async function indent(index: number) {
	const element = filteredDisplayItems.value[index];
	const sibling = filteredDisplayItems.value[index - 1];
	const siblingKey = sibling?.[relationInfo.value.relatedPrimaryKeyField.field];

	// As a drag: only an open item with a key has a nested list to drop into.
	if (!element || siblingKey === undefined || element.$type === 'deleted') return;

	open.value[siblingKey] = true;
	await nextTick();

	const target = childLevels[siblingKey];
	if (!target) return;

	await target.loaded();
	// newIndex is not read by change(): the order comes from the sort field, as after a drop.
	target.change({ added: { newIndex: 0, element } });
	await nextTick();
	change({ removed: { oldIndex: index, element } });
	await focusRow(element);
}

async function outdent(element: DisplayItem, childIndex: number, parentIndex: number) {
	const parentKey = filteredDisplayItems.value[parentIndex]?.[relationInfo.value.relatedPrimaryKeyField.field];
	if (element.$type === 'deleted') return;

	change({ added: { newIndex: parentIndex + 1, element } });
	await nextTick();
	childLevels[parentKey]?.change({ removed: { oldIndex: childIndex, element } });
	await focusRow(element);
}

defineExpose<NestedLevel>({ change, loaded: () => until(loading).toBe(false) });

/* Row menu: edit and v-remove (item-preview.vue) */

const editing = ref<DisplayItem | null>(null);
const confirmRemoveItem = ref<DisplayItem | null>(null);

function rowActions(element: DisplayItem): BoMenuItem[] {
	if (props.nonEditable || props.disabled) return [];

	const action = getRemoveAction({
		itemType: element.$type,
		itemInfo: relationInfo.value,
		itemIsLocal: isLocalItem(element),
		itemEdits: getItemEdits(element),
	});

	return [
		{ text: t('edit_item'), icon: 'edit', onSelect: () => (editing.value = element) },
		{
			text: t(action.text),
			icon: action.icon,
			onSelect: () => (action.needsConfirmation ? (confirmRemoveItem.value = element) : remove(element)),
		},
	];
}

function onConfirmRemove() {
	const item = confirmRemoveItem.value;
	confirmRemoveItem.value = null;
	if (item) remove(item);
}

function itemLabel(element: DisplayItem, index: number): string {
	const rendered = renderStringTemplate(template.value, element).displayValue.value;
	return rendered || String(index + 1);
}
</script>

<template>
	<div ref="rootEl" class="drag-area" :class="{ root, 'mt-2': !root }">
		<div
			v-if="loading"
			aria-busy="true"
			class="h-11 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-white/5"
		>
			<span class="sr-only">{{ t('loading') }}</span>
		</div>

		<BoNotice v-else-if="loadError" type="danger">{{ translateAPIError(loadError as APIError) }}</BoNotice>

		<BoNotice v-else-if="root && filteredDisplayItems.length === 0" class="no-items">
			{{ t('no_items') }}
		</BoNotice>

		<BoSortableList
			v-if="!loading"
			:model-value="filteredDisplayItems"
			:item-key="keyOf"
			:item-label="itemLabel"
			:row-actions="rowActions"
			:disabled="disabled"
			group="g1"
			:item-disabled="(element: DisplayItem) => element.$type === 'deleted'"
			tree
			:nested="!root"
			@update:model-value="sort"
			@change="change"
			@indent="indent"
			@outdent="$emit('outdent', filteredDisplayItems[$event], $event)"
		>
			<template #item="{ element, index }">
				<ItemPreview
					:item="element"
					:template="template"
					:collection="collection"
					:disabled="disabled"
					:non-editable="nonEditable"
					:relation-info="relationInfo"
					:open="open[element[relationInfo.relatedPrimaryKeyField.field]] ?? false"
					:deleted="element.$type === 'deleted'"
					@update:open="open[element[relationInfo.relatedPrimaryKeyField.field]] = $event"
					@edit="editing = element"
				/>
				<NestedDraggable
					v-if="open[element[relationInfo.relatedPrimaryKeyField.field]]"
					:ref="(level: any) => (childLevels[element[relationInfo.relatedPrimaryKeyField.field]] = level)"
					:model-value="element[field]"
					:template="template"
					:collection="collection"
					:disabled="disabled"
					:non-editable="nonEditable"
					:field="field"
					:fields="fields"
					:version="version"
					:enable-create="enableCreate"
					:enable-select="enableSelect"
					:custom-filter="customFilter"
					:relation-info="relationInfo"
					:primary-key="element[relationInfo.relatedPrimaryKeyField.field]"
					:items-moved="itemsMoved"
					@update:model-value="updateModelValue($event, index)"
					@outdent="(child: DisplayItem, childIndex: number) => outdent(child, childIndex, index)"
				/>
			</template>
		</BoSortableList>

		<template v-if="root">
			<div v-if="!nonEditable" class="actions mt-3 flex flex-wrap gap-2">
				<BoButton v-if="enableCreate" class="create" :disabled @click="addNewActive = true">
					{{ t('create_new') }}
				</BoButton>
				<BoButton v-if="enableSelect" class="select" variant="secondary" :disabled @click="selectDrawer = true">
					{{ t('add_existing') }}
				</BoButton>
			</div>

			<DrawerItem
				:disabled
				:non-editable
				:active="addNewActive"
				:collection="collection"
				:primary-key="'+'"
				:edits="{}"
				:circular-field="relationInfo.reverseJunctionField.field"
				@input="addNew"
				@update:active="addNewActive = false"
			/>

			<DrawerCollection
				v-if="!disabled"
				v-model:active="selectDrawer"
				:collection="collection"
				:selection="[]"
				:filter="customFilter"
				multiple
				@input="select"
			/>
		</template>

		<DrawerItem
			:active="editing !== null"
			:disabled
			:non-editable
			:collection="collection"
			:primary-key="editing?.[relationInfo.relatedPrimaryKeyField.field] || '+'"
			:edits="editing ? getItemEdits(editing) : {}"
			:circular-field="relationInfo.reverseJunctionField.field"
			@input="stageEdits"
			@update:active="!$event && (editing = null)"
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
