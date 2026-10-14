<!-- Ported from directus/app/src/views/private/components/drawer-collection.vue; Ported from directus/app/src/layouts/tabular/index.ts -->
<script setup lang="ts">
// Backoffice: always a table (D-58): the useItemOptions/useTable parts of layouts/tabular/index.ts are folded in
// (columns from the preset `layout_query.tabular.fields`, else the first 4 visible fields; sort, limit, widths and
// align of the preset), with a search input, pagination and the selection of BoTable. The preset filter and search,
// the filter bar and the other layouts come with feature 014. Items are only fetched while the drawer is open.
// Free slots are not forwarded to the drawer; `sidebar` (drawer-files.vue) renders above the table.
import type { Filter, Preset } from '@directus/types';
import { flatten, isEqual } from 'lodash-es';
import { computed, ref, toRefs, unref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAliasFields } from '../../composables/use-alias-fields.ts';
import { useCollection } from '../../composables/use-collection.ts';
import { useItems } from '../../composables/use-items.ts';
import { translateAPIError } from '../../lang/index.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePresetsStore } from '../../stores/presets.ts';
import { getDefaultDisplayForType } from '../../utils/get-default-display-for-type.ts';
import BoButton from '../BoButton.vue';
import BoIcon from '../BoIcon.vue';
import BoInput from '../BoInput.vue';
import BoNotice from '../BoNotice.vue';
import BoTable, { type BoTableColumn, type BoTableSort } from '../BoTable.vue';
import RenderDisplay from '../render/RenderDisplay.vue';
import BoDrawer, { type Props as BoDrawerProps } from './BoDrawer.vue';

const props = withDefaults(
	defineProps<{
		active?: boolean | undefined;
		selection?: (number | string)[];
		collection: string;
		multiple?: boolean;
		filter?: Filter | undefined;
		drawerProps?: Partial<BoDrawerProps> | undefined;
	}>(),
	{
		active: undefined,
		selection: () => [],
		filter: undefined,
		drawerProps: undefined,
	},
);

const emit = defineEmits<{
	(e: 'update:active', value: boolean): void;
	(e: 'input', value: (number | string)[] | null): void;
}>();

const { t } = useI18n();

const { save, cancel } = useActions();
const { internalActive } = useActiveState();
const { internalSelection, onSelect, hasSelectionChanged } = useSelection();

const { collection } = toRefs(props);

const { info: collectionInfo, primaryKeyField, fields: fieldsInCollection, sortField } = useCollection(collection);

const fieldsStore = useFieldsStore();
const presetsStore = usePresetsStore();

// use-preset.ts (temporary, D-58): the tabular layout query and options of the user, role or global preset.
const preset = computed(() => presetsStore.getPresetForCollection(props.collection) as Preset | null);
const layoutQuery = computed(() => (preset.value?.layout_query?.['tabular'] ?? null) as Record<string, any> | null);
const layoutOptions = computed(() => (preset.value?.layout_options?.['tabular'] ?? null) as Record<string, any> | null);

const search = ref<string | null>(null);

const { sort, limit, page, fields } = useItemOptions();

const { aliasedFields, aliasQuery, getFromAliasedItem } = useAliasFields(fields, collection);

const fieldsWithRelationalAliased = computed(() =>
	flatten(Object.values(aliasedFields.value).map(({ fields }) => fields)),
);

const filter = computed(() => props.filter ?? null);

const { items, loading, error, totalPages, itemCount } = useItems(
	computed(() => (internalActive.value ? props.collection : null)),
	{
		sort,
		limit,
		page,
		fields: fieldsWithRelationalAliased,
		alias: aliasQuery,
		filter,
		search,
	},
);

const { tableSort, tableColumns, onSortChange } = useTable();

const tableSelection = computed<(string | number)[]>({
	get() {
		return internalSelection.value ?? [];
	},
	set(newSelection) {
		onSelect(newSelection);
	},
});

const range = computed(() => {
	const count = itemCount.value ?? 0;
	const start = count === 0 ? 0 : (page.value - 1) * limit.value + 1;
	return { start, end: Math.min(page.value * limit.value, count), count };
});

function useActiveState() {
	const localActive = ref(false);

	const internalActive = computed({
		get() {
			return props.active === undefined ? localActive.value : props.active;
		},
		set(newActive: boolean) {
			localActive.value = newActive;
			emit('update:active', newActive);
		},
	});

	return { internalActive };
}

function useSelection() {
	const localSelection = ref<(string | number)[] | null>(null);
	const initialSelection = ref<(string | number)[] | null>(null);

	const internalSelection = computed({
		get() {
			if (localSelection.value === null) {
				return props.selection;
			}

			return localSelection.value;
		},
		set(newSelection: (string | number)[]) {
			localSelection.value = newSelection;
		},
	});

	const hasSelectionChanged = computed(() => {
		return !isEqual(internalSelection.value, initialSelection.value);
	});

	watch(
		() => props.active,
		(active) => {
			localSelection.value = null;

			if (active) {
				// Store a copy of the initial selection when the drawer opens
				initialSelection.value = Array.isArray(internalSelection.value)
					? [...internalSelection.value]
					: internalSelection.value;
			}
		},
	);

	return { internalSelection, onSelect, hasSelectionChanged };

	function onSelect(newSelection: (string | number)[]) {
		if (newSelection.length === 0) {
			localSelection.value = [];
			return;
		}

		if (props.multiple === true) {
			localSelection.value = newSelection;
		} else {
			localSelection.value = [newSelection[newSelection.length - 1] as string | number];
		}
	}
}

function useActions() {
	return { save, cancel };

	function save() {
		if (!hasSelectionChanged.value) return;
		emit('input', unref(internalSelection));
		internalActive.value = false;
	}

	function cancel() {
		internalActive.value = false;
	}
}

// layouts/tabular/index.ts useItemOptions (the preset values are read only: nothing is saved, as `temporary`).
function useItemOptions() {
	const page = ref<number>(layoutQuery.value?.['page'] ?? 1);
	const limit = ref<number>(layoutQuery.value?.['limit'] ?? 25);

	const defaultSort = computed(() => {
		const field = sortField.value ?? primaryKeyField.value?.field;
		return field ? [field] : [];
	});

	const localSort = ref<string[] | null>(null);

	const sort = computed<string[]>({
		get: () => localSort.value ?? layoutQuery.value?.['sort'] ?? defaultSort.value,
		set: (value) => (localSort.value = value),
	});

	const fieldsDefaultValue = computed(() => {
		return fieldsInCollection.value
			.filter((field) => !field.meta?.hidden && !field.meta?.special?.includes('no-data'))
			.slice(0, 4)
			.map(({ field }) => field)
			.sort();
	});

	const fields = computed<string[]>(() => {
		if (layoutQuery.value?.['fields']) {
			return (layoutQuery.value['fields'] as string[]).filter((field) => fieldsStore.getField(collection.value, field));
		} else {
			return unref(fieldsDefaultValue);
		}
	});

	return { sort, limit, page, fields };
}

// layouts/tabular/index.ts useTable (headers without the width/order write back to the preset).
function useTable() {
	const tableSort = computed<BoTableSort | null>(() => {
		if (!sort.value?.[0]) {
			return null;
		} else if (sort.value?.[0].startsWith('-')) {
			return { by: sort.value[0].substring(1), desc: true };
		} else {
			return { by: sort.value[0], desc: false };
		}
	});

	const localWidths = ref<{ [field: string]: number }>({});

	const activeFields = computed(() => {
		return fields.value
			.map((key) => ({ ...fieldsStore.getField(collection.value, key)!, key }))
			.filter((f) => f && f.meta?.special?.includes('no-data') !== true);
	});

	const tableColumns = computed<(BoTableColumn & { field: Record<string, any> })[]>({
		get() {
			return activeFields.value.map((field) => ({
				key: field.key,
				label: field.name,
				width: localWidths.value[field.key] || layoutOptions.value?.['widths']?.[field.key] || 144,
				align: layoutOptions.value?.['align']?.[field.key] || 'left',
				sortable: ['json', 'alias', 'presentation', 'translations'].includes(field.type) === false,
				field: {
					display: field.meta?.display || getDefaultDisplayForType(field.type),
					displayOptions: field.meta?.display_options,
					interface: field.meta?.interface,
					interfaceOptions: field.meta?.options,
					type: field.type,
					field: field.field,
					collection: field.collection,
				},
			}));
		},
		set(val) {
			localWidths.value = Object.fromEntries(val.map((column) => [column.key, column.width ?? 144]));
		},
	});

	return { tableSort, tableColumns, onSortChange };

	function onSortChange(newSort: BoTableSort | null) {
		if (!newSort?.by) {
			sort.value = [];
			return;
		}

		let sortString = newSort.by;

		if (newSort.desc === true) {
			sortString = '-' + sortString;
		}

		sort.value = [sortString];
	}
}

defineExpose({ save, cancel });
</script>

<template>
	<BoDrawer
		v-model="internalActive"
		:title="t('select_item')"
		:subtitle="collectionInfo?.name ?? null"
		:icon="collectionInfo?.icon ?? 'box'"
		v-bind="drawerProps"
		@cancel="cancel"
		@apply="save"
	>
		<template #actions>
			<BoButton icon="check" :aria-label="t('save')" :disabled="!hasSelectionChanged" @click="save" />
		</template>

		<div class="flex flex-col gap-4">
			<slot name="sidebar" />

			<BoInput
				:model-value="search ?? ''"
				type="search"
				:aria-label="t('search')"
				:placeholder="t('search_items')"
				@update:model-value="search = $event || null"
			/>

			<BoNotice v-if="error" type="danger">{{ translateAPIError(error) }}</BoNotice>

			<BoTable
				v-else
				v-model="tableSelection"
				v-model:columns="tableColumns"
				:rows="items"
				:row-key="primaryKeyField?.field ?? 'id'"
				:sort="tableSort"
				:loading="loading"
				:show-select="multiple ? 'multiple' : 'one'"
				:spacing="layoutOptions?.['spacing'] ?? 'cozy'"
				:caption="collectionInfo?.name"
				show-resize
				@update:sort="onSortChange"
			>
				<template v-for="column in tableColumns" :key="column.key" #[`item.${column.key}`]="{ item }">
					<RenderDisplay
						:value="getFromAliasedItem(item, column.key)"
						:display="column.field['display']"
						:options="column.field['displayOptions']"
						:interface="column.field['interface']"
						:interface-options="column.field['interfaceOptions']"
						:type="column.field['type']"
						:collection="column.field['collection']"
						:field="column.field['field']"
					/>
				</template>
			</BoTable>

			<nav
				v-if="!error && totalPages > 1"
				:aria-label="collectionInfo?.name"
				class="flex items-center justify-between gap-3 text-theme-sm text-gray-500 dark:text-gray-400"
			>
				<span aria-live="polite">{{ t('start_end_of_count_items', range) }}</span>
				<div class="flex gap-2">
					<BoButton variant="secondary" icon="chevron_left" :disabled="page <= 1" @click="page--">
						{{ t('previous') }}
					</BoButton>
					<BoButton variant="secondary" :disabled="page >= totalPages" @click="page++">
						{{ t('next') }}
						<BoIcon name="chevron_right" size="sm" />
					</BoButton>
				</div>
			</nav>
		</div>
	</BoDrawer>
</template>
