<!-- Ported from directus/app/src/interfaces/collection-item-multiple-dropdown/collection-item-multiple-dropdown.vue -->
<script setup lang="ts">
// Backoffice: `api.get` (axios) -> `sdk` (FR-001); Draggable + v-list rows -> BoSortableList (D-60: the deselect
// action and "Move up" / "Move down" are in the row menu; a disabled list hides the drag handle instead of greying
// it); v-prevent-focusout is not needed (drawers are portals). unexpectedError has no snackbar before feature 018
// (D-45): a failed load shows as a BoNotice in the field (spec Edge Cases), and a selectedCollection missing from the
// collections store (removed, or not readable) shows `relationship_not_setup`.
import type { Filter, PrimaryKey } from '@directus/types';
import { getEndpoint, getFieldsFromTemplate } from '@directus/utils';
import { computed, inject, ref, toRefs, unref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import BoButton from '../../components/BoButton.vue';
import type { BoMenuItem } from '../../components/BoMenu.vue';
import BoNotice from '../../components/BoNotice.vue';
import BoSortableList from '../../components/BoSortableList.vue';
import DrawerCollection from '../../components/drawers/DrawerCollection.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import RenderTemplate from '../../components/render/RenderTemplate.vue';
import { type APIError, translateAPIError } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { adjustFieldsForDisplays } from '../../utils/adjust-fields-for-displays.ts';

type ValueItem = {
	key: PrimaryKey;
	collection: string;
};

const props = withDefaults(
	defineProps<{
		value?: ValueItem[] | null;
		selectedCollection: string;
		template?: string | null;
		disabled?: boolean;
		nonEditable?: boolean;
		filter?: Filter | null;
	}>(),
	{
		value: () => [],
		template: null,
		filter: null,
	},
);

const { t } = useI18n();

const emit = defineEmits(['input']);

const a11y = inject(FORM_FIELD_A11Y, null);

const { selectedCollection, template } = toRefs(props);

const collectionsStore = useCollectionsStore();
const fieldStore = useFieldsStore();

const loading = ref(false);
const loadError = ref<string | null>(null);
const selectDrawerOpen = ref(false);
const displayItems = ref<Record<string, any>[]>([]);

const collectionExists = computed(() => !!collectionsStore.getCollection(unref(selectedCollection)));

const values = computed({
	get: () => props.value ?? [],
	set: (newValues) => {
		if (Array.isArray(newValues) && newValues.length > 0) {
			emit('input', newValues);
		} else {
			emit('input', null);
		}
	},
});

const selectedKeys = computed(() => values.value.map((item) => item.key));

const primaryKey = computed(() => fieldStore.getPrimaryKeyFieldForCollection(unref(selectedCollection))?.field ?? '');

const displayTemplate = computed(() => {
	if (unref(template)) return unref(template);

	const displayTemplate = collectionsStore.getCollection(unref(selectedCollection))?.meta?.display_template;

	return displayTemplate || `{{ ${primaryKey.value || ''} }}`;
});

const requiredFields = computed(() => {
	if (!displayTemplate.value || !unref(selectedCollection)) return [];
	return adjustFieldsForDisplays(getFieldsFromTemplate(displayTemplate.value), unref(selectedCollection));
});

watch(
	values,
	(newValues, oldValues) => {
		if (!oldValues || selectionHasChanged(newValues, oldValues)) {
			getDisplayItems();
		}
	},
	{ immediate: true },
);

function selectionHasChanged(newValues: ValueItem[], oldValues: ValueItem[]) {
	if (newValues.length !== oldValues.length) return true;

	const newKeys = new Set(newValues.map((v) => `${v.collection}_${v.key}`));
	const oldKeys = new Set(oldValues.map((v) => `${v.collection}_${v.key}`));

	return ![...newKeys].every((key) => oldKeys.has(key));
}

async function getDisplayItems() {
	if (!values.value || values.value.length === 0) {
		displayItems.value = [];
		return;
	}

	if (!unref(selectedCollection) || !primaryKey.value) return;

	const fields = new Set(requiredFields.value);
	fields.add(primaryKey.value);

	try {
		loading.value = true;
		loadError.value = null;

		const fetchedItems =
			(await sdk.request<Record<string, any>[]>(
				requestEndpoint(getEndpoint(unref(selectedCollection)), {
					params: {
						fields: Array.from(fields),
						filter: { [primaryKey.value]: { _in: selectedKeys.value } },
					},
				}),
			)) ?? [];

		displayItems.value = selectedKeys.value
			.map((key) => fetchedItems.find((item: any) => item[primaryKey.value] === key))
			.filter(Boolean) as Record<string, any>[];
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn(error);
		loadError.value = translateAPIError(error as APIError);
	} finally {
		loading.value = false;
	}
}

function onSelection(selectedIds: PrimaryKey[] | null) {
	selectDrawerOpen.value = false;

	if (!selectedIds || selectedIds.length === 0) {
		values.value = [];
		return;
	}

	const newValues = selectedIds.map((key) => ({
		key,
		collection: unref(selectedCollection),
	}));

	values.value = newValues;
}

function removeItem(item: Record<string, any>) {
	const keyToRemove = item[primaryKey.value];
	values.value = values.value.filter((v) => v.key !== keyToRemove);
}

function onSort(sortedItems: Record<string, any>[]) {
	displayItems.value = sortedItems;

	const newValues = sortedItems.map((item) => ({
		key: item[primaryKey.value],
		collection: unref(selectedCollection),
	}));

	values.value = newValues;
}

// Backoffice: the v-remove (deselect) of each row is a row menu action (D-60).
function rowActions(item: Record<string, any>): BoMenuItem[] {
	if (props.nonEditable) return [];
	return [{ text: t('deselect'), icon: 'close', disabled: !!props.disabled, onSelect: () => removeItem(item) }];
}
</script>

<template>
	<BoNotice v-if="!collectionExists" type="warning">
		{{ t('relationship_not_setup') }}
	</BoNotice>

	<div
		v-else
		class="collection-item-multiple-dropdown space-y-3"
		role="group"
		:aria-labelledby="a11y?.labelId"
		:aria-describedby="a11y?.describedBy"
		:aria-invalid="a11y?.invalid || undefined"
		:aria-busy="loading || undefined"
	>
		<BoNotice v-if="loadError" type="danger">{{ loadError }}</BoNotice>

		<BoNotice v-else-if="displayItems.length === 0">
			{{ t('no_items') }}
		</BoNotice>

		<ul v-else-if="loading" class="space-y-2">
			<li
				v-for="num in displayItems.length"
				:key="num"
				class="animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-white/5"
				:class="displayItems.length > 4 ? 'h-9' : 'h-11'"
			/>
		</ul>

		<BoSortableList
			v-else
			:model-value="displayItems"
			:item-key="primaryKey"
			:disabled="!!disabled || !!nonEditable"
			:row-actions="rowActions"
			@update:model-value="onSort($event)"
		>
			<template #item="{ element }">
				<span
					class="preview block truncate text-sm"
					:class="disabled && !nonEditable ? 'text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-white/90'"
				>
					<RenderTemplate :collection="selectedCollection" :item="element" :template="displayTemplate ?? ''" />
				</span>
			</template>
		</BoSortableList>

		<div v-if="!nonEditable" class="actions">
			<BoButton :disabled="!!disabled" @click="selectDrawerOpen = true">
				{{ t('select_item') }}
			</BoButton>
		</div>

		<DrawerCollection
			v-model:active="selectDrawerOpen"
			:collection="selectedCollection"
			:selection="selectedKeys"
			:filter="filter!"
			multiple
			@input="onSelection"
			@update:active="selectDrawerOpen = false"
		/>
	</div>
</template>
