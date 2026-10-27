<!-- Ported from directus/app/src/views/private/components/drawer-collection.vue -->
<script setup lang="ts">
// Backoffice: the layout of the collection preset (FR-029, D-58 lifted), rendered from the layout registry like
// CollectionRoute. The temporary preset (FR-019) is never written. No layout options in the drawer, as DR
// drawer-collection.vue (016: the 014 sidebar section was removed). The layout is only mounted while the drawer is
// open, so nothing is fetched while it is closed (013), unless `eager` (018: the relational variable panel loads it like
// DR). Every slot of the caller is passed to the drawer as DR does (the files drawer gives `sidebar`;
// spec 020: extensions may give any BoDrawer slot).
import type { Filter } from '@directus/types';
import { mergeFilters } from '@directus/utils';
import { isEqual } from 'lodash-es';
import { computed, ref, toRefs, unref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCollection } from '../../composables/use-collection.ts';
import { usePreset } from '../../composables/use-preset.ts';
import { getLayout } from '../../layouts/index.ts';
import { useLayout } from '../../layouts/use-layout.ts';
import BoButton from '../BoButton.vue';
import { translateAPIError } from '../../lang/index.ts';
import BoInfo from '../BoInfo.vue';
import BoNotice from '../BoNotice.vue';
import SearchInput from '../SearchInput.vue';
import BoDrawer, { type Props as BoDrawerProps } from './BoDrawer.vue';

const props = withDefaults(
	defineProps<{
		active?: boolean | undefined;
		selection?: (number | string)[];
		collection: string;
		multiple?: boolean;
		filter?: Filter | undefined;
		drawerProps?: Partial<BoDrawerProps> | undefined;
		/** Mount the layout (and fetch its items) while the drawer is closed, as DR always does (018 relational
		 * variable panel, owner 2026-10-18); off by default (013). */
		eager?: boolean;
	}>(),
	{
		active: undefined,
		selection: () => [],
		filter: undefined,
		drawerProps: undefined,
		eager: false,
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

const { info: collectionInfo } = useCollection(collection);
const { layout, layoutOptions, layoutQuery, search, filter: presetFilter } = usePreset(collection, ref(null), true);

// Backoffice (spec 024, D-188.3): bo_show_search off hides the keyword box like the Content page (022); the API
// refuses a search there, so the preset search is not sent and the preset keeps it.
const showSearch = computed(
	() => (collectionInfo.value?.meta as Record<string, unknown> | null | undefined)?.['bo_show_search'] !== false,
);
const activeSearch = computed(() => (showSearch.value ? search.value : null));

// This is a local copy of the layout. This means that we can sync it the layout without
// having use-preset auto-save the values
const localOptions = ref(layoutOptions.value);
const localQuery = ref(layoutQuery.value);

// Backoffice: the options and query of the newly chosen layout come from the preset again.
watch(layout, () => {
	localOptions.value = layoutOptions.value;
	localQuery.value = layoutQuery.value;
});

const layoutSelection = computed<any>({
	get() {
		return internalSelection.value;
	},
	set(newFilters) {
		onSelect(newFilters);
	},
});

const { layoutWrapper } = useLayout(layout);
const currentLayout = computed(() => getLayout(layout.value) ?? getLayout('tabular'));

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
		{ immediate: true },
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
</script>

<template>
	<component
		:is="layoutWrapper"
		v-if="internalActive || eager"
		v-slot="{ layoutState }"
		v-model:selection="layoutSelection"
		v-model:layout-options="localOptions"
		v-model:layout-query="localQuery"
		:filter="mergeFilters(presetFilter, filter ?? null)"
		:filter-user="presetFilter"
		:filter-system="filter ?? null"
		:search="activeSearch"
		:collection="collection"
		select-mode
		:show-select="multiple ? 'multiple' : 'one'"
	>
		<BoDrawer
			v-model="internalActive"
			:title="t('select_item')"
			:subtitle="collectionInfo?.name ?? null"
			:icon="collectionInfo?.icon ?? 'box'"
			v-bind="drawerProps"
			@cancel="cancel"
			@apply="save"
		>
			<!-- Every slot of the caller goes to the drawer, as drawer-collection.vue (the files drawer gives `sidebar`). -->
			<template v-for="(_, slot) of $slots" #[slot]="scope">
				<slot :name="slot" v-bind="scope || {}" />
			</template>

			<template #actions:prepend>
				<component :is="currentLayout?.slots.actions" v-if="currentLayout?.slots.actions" v-bind="layoutState" />
			</template>

			<template #actions>
				<!-- Backoffice (spec 023, D-187): "JSON path" under json fields of the filter. -->
				<SearchInput
					v-model="search"
					v-model:filter="presetFilter"
					:collection="collection"
					:show-search="showSearch"
					include-json-path
				/>

				<BoButton icon="check" :aria-label="t('save')" :disabled="!hasSelectionChanged" @click="save" />
			</template>

			<component :is="currentLayout?.component" v-bind="layoutState">
				<template #no-results>
					<BoInfo :title="t('item_count', 0)" :icon="collectionInfo?.icon ?? 'box'" />
				</template>

				<template #no-items>
					<BoInfo :title="t('item_count', 0)" :icon="collectionInfo?.icon ?? 'box'" />
				</template>

				<!-- Backoffice: the translated API error of the 013 drawer (FR-046 of 013); DR shows nothing here. -->
				<template #error="{ error }">
					<BoNotice type="danger">{{ translateAPIError(error) }}</BoNotice>
				</template>
			</component>
		</BoDrawer>
	</component>
</template>
