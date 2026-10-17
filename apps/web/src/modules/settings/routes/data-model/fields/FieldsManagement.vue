<!-- Ported from directus/app/src/modules/settings/routes/data-model/fields/components/fields-management.vue; Ported from directus/app/src/modules/settings/routes/data-model/fields/components/field-select-menu.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-21, spec 016 US2, FR-021 to FR-027):
// - Locked system fields first in a plain grid, then the root BoSortableList of the `fields` group (two-column grid,
//   rows spanning by `meta.width`); group fields nest their own list (FieldSelect.vue). The order is saved as Directus
//   setSort / onGroupSortChange: PATCH /fields/:c with `{ field, meta: { sort, group } }` of the whole target list
//   (fieldsStore.updateFields: optimistic, undone with the error dialog, only the latest answer applied). A mouse drop
//   from another list saves the target list, then the source list, as vuedraggable does in Directus.
// - D-96: the row menu adds Move up / Move down / Into the group above (only when the row above is a group) / Out of the
//   group, sending the same bodies.
// - field-select-menu.vue is the row menu built here (BoSortableList row actions); the duplicate and delete dialogs
//   of FieldSelect.vue are here once for the page.
import type { DeepPartial, Field, LocalType, Width } from '@directus/types';
import { deepMapFilter } from '@directus/utils';
import { cloneDeep, isNil, orderBy } from 'lodash-es';
import { computed, onBeforeMount, onBeforeUnmount, provide, ref, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import BoButton from '../../../../../components/BoButton.vue';
import BoDialog from '../../../../../components/BoDialog.vue';
import BoInput from '../../../../../components/BoInput.vue';
import type { BoMenuItem } from '../../../../../components/BoMenu.vue';
import BoMenu from '../../../../../components/BoMenu.vue';
import BoSortableList from '../../../../../components/BoSortableList.vue';
import { useSchemaOverview } from '../../../../../composables/use-schema.ts';
import { notify, showUnexpectedError as unexpectedError } from '../../../../../composables/use-notices.ts';
import InterfaceSystemCollection from '../../../../../interfaces/_system/system-collection/SystemCollection.vue';
import { useFieldsStore } from '../../../../../stores/fields.ts';
import { getLocalTypeForField } from '../../../../../utils/get-local-type.ts';
import { getSpecialForType } from '../../../../../utils/get-special-for-type.ts';
import { FIELD_GRID, GRID, widthClass } from './field-grid.ts';
import FieldSelect from './FieldSelect.vue';

const props = defineProps<{
	collection: string;
}>();

const { t } = useI18n();
const router = useRouter();

const { collection } = toRefs(props);
const fieldsStore = useFieldsStore();
onBeforeMount(async () => await fieldsStore.hydrate({ skipTranslation: true }));
onBeforeUnmount(() => fieldsStore.translateFields());

const fields = computed(() => fieldsStore.getFieldsForCollectionSorted(collection.value));

const parsedFields = computed(() => {
	return orderBy(fields.value, [(o) => (o.meta?.sort ? Number(o.meta?.sort) : null), (o) => o.meta?.id]).filter(
		(field) => field.field.startsWith('$') === false,
	);
});

const lockedFields = computed(() => {
	return parsedFields.value.filter((field) => field.meta?.system === true);
});

const usableFields = computed(() => {
	return parsedFields.value.filter((field) => field.meta?.system !== true);
});

const addOptions = computed<Array<{ type: LocalType; icon: string; text: string } | { divider: boolean }>>(() => [
	{ type: 'standard', icon: 'create', text: t('standard_field') },
	{ type: 'presentation', icon: 'scatter_plot', text: t('presentation_and_aliases') },
	{ type: 'group', icon: 'view_in_ar', text: t('field_group') },
	{ divider: true },
	{ type: 'file', icon: 'photo', text: t('single_file') },
	{ type: 'files', icon: 'collections', text: t('multiple_files') },
	{ divider: true },
	{ type: 'm2o', icon: 'call_merge', text: t('m2o_relationship') },
	{ type: 'o2m', icon: 'call_split', text: t('o2m_relationship') },
	{ type: 'm2m', icon: 'import_export', text: t('m2m_relationship') },
	{ type: 'm2a', icon: 'gesture', text: t('m2a_relationship') },
	{ divider: true },
	{ type: 'translations', icon: 'translate', text: t('translations') },
]);

/** The BoMenu items of the advanced menu: a divider entry of Directus marks the item before it. */
const addMenu = computed(() =>
	addOptions.value.reduce<BoMenuItem[]>((items, option) => {
		if ('divider' in option) {
			if (items.length > 0) items[items.length - 1]!.divider = true;
		} else {
			items.push({
				text: option.text,
				icon: option.icon,
				to: {
					name: 'settings-fields-field',
					params: { collection: collection.value, field: '+' },
					query: { type: option.type },
				},
			});
		}

		return items;
	}, []),
);

const childrenOf = (group: string | null) =>
	usableFields.value.filter((field) => (isNil(field.meta?.group) ? null : field.meta!.group) === group);

const rootFields = computed(() => childrenOf(null));

function sortList(list: Field[], group: string | null) {
	const updates = list
		.filter((field) => isNil(field) === false)
		.map((field, index) => ({ field: field.field, meta: { sort: index + 1, group } }));

	if (updates.length > 0) void fieldsStore.updateFields(collection.value, updates as DeepPartial<Field>[]);
}

function onChange(group: string | null, event: unknown) {
	const change = event as { added?: { newIndex: number; element: Field }; removed?: { element: Field } };

	if (change.added) {
		const list = childrenOf(group).filter((field) => field.field !== change.added!.element.field);
		list.splice(change.added.newIndex, 0, change.added.element);
		sortList(list, group);
	} else if (change.removed) {
		sortList(
			childrenOf(group).filter((field) => field.field !== change.removed!.element.field),
			group,
		);
	}
}

const isGroup = (field: Field | undefined) =>
	!!field && getLocalTypeForField(field.collection, field.field) === 'group';

function indent(list: Field[], index: number) {
	const above = list[index - 1];
	const item = list[index];
	if (!isGroup(above) || !item) return;
	sortList([...childrenOf(above!.field).filter((field) => field.field !== item.field), item], above!.field);
}

function outdent(list: Field[], index: number, group: string | null) {
	const item = list[index];
	if (!item || group === null) return;
	const parentGroup = fieldsStore.getField(collection.value, group)?.meta?.group ?? null;
	const siblings = childrenOf(parentGroup).filter((field) => field.field !== item.field);
	siblings.splice(siblings.findIndex((field) => field.field === group) + 1, 0, item);
	sortList(siblings, parentGroup);
}

async function updateMeta(field: Field, meta: DeepPartial<Field['meta']>) {
	try {
		await fieldsStore.updateField(field.collection, field.field, { meta } as DeepPartial<Field>);
	} catch (error) {
		unexpectedError(error);
	}
}

/** field-select-menu.vue */
function menuFor(field: Field): BoMenuItem[] {
	const localType = getLocalTypeForField(field.collection, field.field);
	const isPrimaryKey = field.schema?.is_primary_key === true;
	const duplicable = localType === 'standard' && isPrimaryKey === false;
	const noDelete = localType === 'group' && childrenOf(field.field).length > 0;
	const width = (value: Width, text: string, icon: string, divider = false): BoMenuItem => ({
		text: t(text),
		icon,
		disabled: field.meta?.width === value || localType === 'group',
		divider,
		onSelect: () => updateMeta(field, { width: value }),
	});

	return [
		{
			text: t('edit_field'),
			icon: 'edit',
			to: { name: 'settings-fields-field', params: { collection: field.collection, field: field.field } },
		},
		{ text: t('duplicate_field'), icon: 'content_copy', disabled: !duplicable, onSelect: () => openDuplicate(field) },
		{
			text: field.meta?.hidden === false ? t('hide_field_on_detail') : t('show_field_on_detail'),
			icon: field.meta?.hidden === false ? 'visibility_off' : 'visibility',
			divider: true,
			onSelect: () => updateMeta(field, { hidden: !field.meta?.hidden }),
		},
		width('half', 'half_width', 'border_vertical'),
		width('full', 'full_width', 'border_right'),
		width('fill', 'fill_width', 'aspect_ratio', true),
		{
			text: t('delete_field'),
			icon: 'delete',
			danger: true,
			disabled: isPrimaryKey || noDelete,
			divider: true,
			onSelect: () => (deleteTarget.value = field),
		},
	];
}

async function open(field: Field) {
	if (!field.meta) {
		const special = getSpecialForType(field.type);

		try {
			await fieldsStore.updateField(field.collection, field.field, { meta: { special } } as DeepPartial<Field>);
		} catch (error) {
			unexpectedError(error);
		}
	}

	router.push({ name: 'settings-fields-field', params: { collection: field.collection, field: field.field } });
}

provide(FIELD_GRID, {
	fields: () => usableFields.value,
	childrenOf,
	sortList,
	onChange,
	canIndent: (list, index) => isGroup(list[index - 1]),
	indent,
	outdent,
	menuFor,
	open,
});

/* ------------------------------------------------------------------------------------------- delete (FieldSelect) */

const deleteTarget = ref<Field | null>(null);
const deleting = ref(false);

const deleteOpen = computed({
	get: () => deleteTarget.value !== null,
	set: (value) => {
		if (!value) deleteTarget.value = null;
	},
});

async function deleteField() {
	if (deleting.value || !deleteTarget.value) return;

	deleting.value = true;
	await fieldsStore.deleteField(deleteTarget.value.collection, deleteTarget.value.field);
	deleting.value = false;
	deleteTarget.value = null;
}

/* ---------------------------------------------------------------------------------------- duplicate (FieldSelect) */

const schemaOverview = useSchemaOverview();
const duplicateSource = ref<Field | null>(null);
const duplicateName = ref<string | null>(null);
const duplicateTo = ref<string | null>(null);
const duplicating = ref(false);

const duplicateOpen = computed({
	get: () => duplicateSource.value !== null,
	set: (value) => {
		if (!value) duplicateSource.value = null;
	},
});

function openDuplicate(field: Field) {
	duplicateSource.value = field;
	duplicateName.value = field.field + '_copy';
	duplicateTo.value = field.collection;
}

async function saveDuplicate() {
	const source = duplicateSource.value;
	if (!source || duplicateName.value === null || duplicating.value) return;

	const newField: Record<string, any> = {
		...cloneDeep(source),
		field: duplicateName.value,
		collection: duplicateTo.value,
	};

	if (newField['meta']) {
		delete newField['meta'].id;
		delete newField['meta'].sort;
		delete newField['meta'].group;
	}

	if (newField['meta']?.validation) {
		newField['meta'].validation = deepMapFilter(
			newField['meta'].validation,
			([key, value], context) => {
				if (
					context.leaf &&
					context.field &&
					context.collection.collection === source.collection &&
					key === source.field
				) {
					return [duplicateName.value!, value];
				}

				return [key, value];
			},
			{
				schema: schemaOverview.value,
				collection: source.collection,
			},
		);
	}

	if (newField['schema']) {
		delete newField['schema'].comment;
	}

	delete newField['name'];

	duplicating.value = true;

	try {
		await fieldsStore.createField(duplicateTo.value!, newField as DeepPartial<Field>);

		notify({
			title: t('field_create_success', { field: newField['field'] }),
		});

		duplicateSource.value = null;
	} catch (error) {
		unexpectedError(error);
	} finally {
		duplicating.value = false;
	}
}

const LABEL = 'mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90';
</script>

<template>
	<div class="mb-6 flex flex-col gap-3">
		<ul v-if="lockedFields.length > 0" :class="GRID" :aria-label="$t('system_fields_locked')">
			<li
				v-for="field in lockedFields"
				:key="field.field"
				class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-white/[0.03]"
				:class="widthClass(field)"
			>
				<FieldSelect :field="field" disabled />
			</li>
		</ul>

		<BoSortableList
			:model-value="rootFields"
			item-key="field"
			group="fields"
			tree
			:list-class="GRID"
			:row-class="widthClass"
			:item-label="(item: Field) => item.field"
			:row-actions="menuFor"
			:can-indent="(_: Field, index: number) => isGroup(rootFields[index - 1])"
			@update:model-value="sortList($event, null)"
			@change="onChange(null, $event)"
			@indent="indent(rootFields, $event)"
		>
			<template #item="{ element }">
				<FieldSelect :field="element" />
			</template>
		</BoSortableList>

		<BoButton
			variant="secondary"
			icon="add"
			full-width
			:to="{ name: 'settings-fields-field', params: { collection, field: '+' } }"
		>
			{{ $t('create_field') }}
		</BoButton>

		<div class="flex justify-center">
			<BoMenu :items="addMenu" align="center">
				<template #trigger>
					<button
						type="button"
						class="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-theme-sm text-gray-500 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:text-gray-400 dark:hover:text-white/90 dark:focus-visible:outline-brand-400"
					>
						{{ $t('create_in_advanced_field_creation_mode') }}
					</button>
				</template>
			</BoMenu>
		</div>

		<BoDialog v-model:open="duplicateOpen" :title="$t('duplicate_where_to')">
			<form id="field-duplicate-form" class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="saveDuplicate">
				<div>
					<span :class="LABEL">{{ $t('collection', 0) }}</span>
					<InterfaceSystemCollection :value="duplicateTo" class="font-mono" @input="duplicateTo = $event" />
				</div>
				<BoInput v-model="duplicateName" :label="$t('field', 0)" class="font-mono" db-safe autofocus />
			</form>
			<template #actions>
				<BoButton variant="secondary" @click="duplicateOpen = false">{{ $t('cancel') }}</BoButton>
				<BoButton type="submit" form="field-duplicate-form" :disabled="duplicateName === null" :loading="duplicating">
					{{ $t('duplicate') }}
				</BoButton>
			</template>
		</BoDialog>

		<BoDialog v-model:open="deleteOpen" :title="$t('delete_field_are_you_sure', { field: deleteTarget?.field ?? '' })">
			<template #actions>
				<BoButton variant="secondary" autofocus @click="deleteOpen = false">{{ $t('cancel') }}</BoButton>
				<BoButton variant="danger" :loading="deleting" @click="deleteField">{{ $t('delete_label') }}</BoButton>
			</template>
		</BoDialog>
	</div>
</template>
