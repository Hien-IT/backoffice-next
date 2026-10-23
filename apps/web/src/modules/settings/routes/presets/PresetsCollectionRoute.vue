<!-- Ported from directus/app/src/modules/settings/routes/presets/collection/collection.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US6-1, recipe Q-26): the layout renders from the registry inside the 014 layout wrapper, as the
// Content and Users lists (014 research R4); the page fills the window (D-99). Header buttons are named BoButtons and
// the confirmations BoDialogs; the batch delete error opens the `something_went_wrong` dialog with translateAPIError
// (v-error). As DR, the layout is a local `tabular` ref (not the preset's).
import type { PrimaryKey } from '@directus/types';
import { computed, ref } from 'vue';
import BoButton from '../../../../components/BoButton.vue';
import BoDialog from '../../../../components/BoDialog.vue';
import BoInfo from '../../../../components/BoInfo.vue';
import SearchInput from '../../../../components/SearchInput.vue';
import DrawerBatch from '../../../../components/drawers/DrawerBatch.vue';
import ExportSidebarDetail from '../../../../components/sidebar/ExportSidebarDetail.vue';
import LayoutSidebarDetail from '../../../../components/sidebar/LayoutSidebarDetail.vue';
import RefreshSidebarDetail from '../../../../components/sidebar/RefreshSidebarDetail.vue';
import { useCollection } from '../../../../composables/use-collection.ts';
import { useCollectionPermissions } from '../../../../composables/use-permissions/index.ts';
import { usePreset } from '../../../../composables/use-preset.ts';
import { translateAPIError } from '../../../../lang/index.ts';
import PrivateView from '../../../../layout/PrivateView.vue';
import { getLayout } from '../../../../layouts/index.ts';
import { useLayout } from '../../../../layouts/use-layout.ts';
import { usePresetsStore } from '../../../../stores/presets.ts';
import SettingsNavigation from '../../components/SettingsNavigation.vue';
import PresetsInfoSidebarDetail from './PresetsInfoSidebarDetail.vue';

const layout = ref<string | null>('tabular');
const collection = ref('directus_presets');

const { layoutOptions, layoutQuery, filter, search, refreshInterval } = usePreset(collection);

const layoutRef = ref();

const { selection } = useSelection();
const { info: currentCollection } = useCollection(collection);

const { layoutWrapper } = useLayout(layout);

// Backoffice: the layout config whose component and slots render inside the wrapper.
const currentLayout = computed(() => getLayout(layout.value) ?? getLayout('tabular'));

const { confirmDelete, deleting, batchDelete, error: deleteError, batchEditActive } = useBatch();

const {
	updateAllowed: batchEditAllowed,
	deleteAllowed: batchDeleteAllowed,
	createAllowed,
} = useCollectionPermissions(collection);

const presetsStore = usePresetsStore();

async function refresh() {
	await layoutRef.value?.state?.refresh?.();
}

async function drawerBatchRefresh() {
	selection.value = [];
	await refresh();
}

function useSelection() {
	const selection = ref<number[]>([]);

	return { selection };
}

function useBatch() {
	const confirmDelete = ref(false);
	const deleting = ref(false);

	const batchEditActive = ref(false);

	const error = ref<any>(null);

	return { batchEditActive, confirmDelete, deleting, batchDelete, error };

	async function batchDelete() {
		if (deleting.value) return;

		deleting.value = true;

		try {
			const batchPrimaryKeys = selection.value;
			await presetsStore.delete(batchPrimaryKeys);

			selection.value = [];
			await refresh();

			confirmDelete.value = false;
		} catch (err: any) {
			error.value = err;
		} finally {
			deleting.value = false;
		}
	}
}

function clearFilters() {
	filter.value = null;
	search.value = null;
}
</script>

<template>
	<component
		:is="layoutWrapper"
		v-if="currentCollection"
		ref="layoutRef"
		v-slot="{ layoutState }"
		v-model:selection="selection"
		v-model:layout-options="layoutOptions"
		v-model:layout-query="layoutQuery"
		:filter-user="filter"
		:filter="filter"
		:search="search"
		:collection="collection"
		:clear-filters="clearFilters"
	>
		<PrivateView
			fill
			:title="$t('settings_presets')"
			icon="bookmark"
			:breadcrumb="[{ name: $t('settings'), to: '/settings' }]"
		>
			<template #actions>
				<component :is="currentLayout?.slots.actions" v-if="currentLayout?.slots.actions" v-bind="layoutState" />

				<SearchInput v-model="search" v-model:filter="filter" :collection="collection" />

				<BoButton
					v-if="selection.length > 0"
					variant="secondary"
					icon="delete"
					class="action-delete hover:bg-error-600 hover:text-white"
					:aria-label="batchDeleteAllowed ? $t('delete_label') : $t('not_allowed')"
					:title="batchDeleteAllowed ? $t('delete_label') : $t('not_allowed')"
					:disabled="batchDeleteAllowed !== true"
					@click="confirmDelete = true"
				/>

				<BoButton
					v-if="selection.length > 0"
					variant="secondary"
					icon="edit"
					:aria-label="batchEditAllowed ? $t('edit') : $t('not_allowed')"
					:title="batchEditAllowed ? $t('edit') : $t('not_allowed')"
					:disabled="batchEditAllowed === false"
					@click="batchEditActive = true"
				/>

				<BoButton
					icon="add"
					v-bind="createAllowed ? { to: { name: 'settings-presets-item', params: { id: '+' } } } : {}"
					:disabled="createAllowed === false"
					:aria-label="createAllowed ? $t('create_preset') : $t('not_allowed')"
					:title="createAllowed ? $t('create_preset') : $t('not_allowed')"
				/>
			</template>

			<template #navigation>
				<SettingsNavigation />
			</template>

			<component :is="currentLayout?.component" v-bind="layoutState">
				<template #no-results>
					<BoInfo :title="$t('no_results')" icon="bookmark">
						{{ $t('no_results_copy') }}

						<template #append>
							<BoButton @click="clearFilters">{{ $t('clear_filters') }}</BoButton>
						</template>
					</BoInfo>
				</template>

				<template #no-items>
					<BoInfo :title="$t('no_presets')" icon="bookmark">
						{{ $t('no_presets_copy') }}

						<template v-if="createAllowed" #append>
							<BoButton :to="{ name: 'settings-presets-item', params: { id: '+' } }">
								{{ $t('create_preset') }}
							</BoButton>
						</template>
					</BoInfo>
				</template>
			</component>

			<BoDialog v-model:open="confirmDelete" :title="$t('batch_delete_confirm', selection.length)">
				<template #actions>
					<BoButton variant="secondary" @click="confirmDelete = false">{{ $t('cancel') }}</BoButton>
					<BoButton variant="danger" :loading="deleting" @click="batchDelete">{{ $t('delete_label') }}</BoButton>
				</template>
			</BoDialog>

			<DrawerBatch
				v-model:active="batchEditActive"
				:primary-keys="selection as PrimaryKey[]"
				:collection="collection"
				@refresh="drawerBatchRefresh"
			/>

			<BoDialog
				:open="deleteError !== null"
				:title="$t('something_went_wrong')"
				v-bind="deleteError ? { description: translateAPIError(deleteError) } : {}"
				@update:open="!$event && (deleteError = null)"
			>
				<template #actions>
					<BoButton @click="deleteError = null">{{ $t('done') }}</BoButton>
				</template>
			</BoDialog>

			<template #sidebar>
				<PresetsInfoSidebarDetail />
				<LayoutSidebarDetail v-model="layout">
					<component :is="currentLayout?.slots.options" v-if="currentLayout?.slots.options" v-bind="layoutState" />
				</LayoutSidebarDetail>
				<component :is="currentLayout?.slots.sidebar" v-if="currentLayout?.slots.sidebar" v-bind="layoutState" />
				<RefreshSidebarDetail v-model="refreshInterval" @refresh="refresh" />
				<ExportSidebarDetail
					:collection="collection"
					:filter="filter ?? undefined"
					:search="search ?? undefined"
					@refresh="refresh"
				/>
			</template>
		</PrivateView>
	</component>
</template>
