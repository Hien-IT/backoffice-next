<!-- Ported from directus/app/src/modules/settings/routes/translations/collection.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US6-4): the layout renders from the registry inside the 014 layout wrapper, as the Content and
// Users lists (014 research R4); the page fills the window (D-99). Header buttons are named BoButtons and the
// confirmations BoDialogs; the batch delete error opens the `something_went_wrong` dialog with translateAPIError
// (v-error). The export download is the layout's `download` passed as `onDownload`, as the Content list.
import type { PrimaryKey } from '@directus/types';
import { computed, ref } from 'vue';
import { requestEndpoint, sdk } from '../../../../api/sdk.ts';
import BoButton from '../../../../components/BoButton.vue';
import BoDialog from '../../../../components/BoDialog.vue';
import BoInfo from '../../../../components/BoInfo.vue';
import SearchInput from '../../../../components/SearchInput.vue';
import DrawerBatch from '../../../../components/drawers/DrawerBatch.vue';
import ExportSidebarDetail from '../../../../components/sidebar/ExportSidebarDetail.vue';
import LayoutSidebarDetail from '../../../../components/sidebar/LayoutSidebarDetail.vue';
import RefreshSidebarDetail from '../../../../components/sidebar/RefreshSidebarDetail.vue';
import { useCollection } from '../../../../composables/use-collection.ts';
import { usePreset } from '../../../../composables/use-preset.ts';
import { translateAPIError } from '../../../../lang/index.ts';
import PrivateView from '../../../../layout/PrivateView.vue';
import { getLayout } from '../../../../layouts/index.ts';
import { useLayout } from '../../../../layouts/use-layout.ts';
import SettingsNavigation from '../../components/SettingsNavigation.vue';

const props = defineProps<{
	bookmark?: string;
	archive?: string;
}>();

const layoutRef = ref();

const bookmarkID = computed(() => (props.bookmark ? +props.bookmark : null));

const selection = ref<PrimaryKey[]>([]);
const { info: currentCollection } = useCollection('directus_translations');

const addNewLink = computed<string>(() => {
	return `/settings/translations/+`;
});

const { layout, layoutOptions, layoutQuery, filter, search, resetPreset, refreshInterval } = usePreset(
	ref('directus_translations'),
	bookmarkID,
);

const { layoutWrapper } = useLayout(layout);

// Backoffice: the layout config whose component and slots render inside the wrapper (tabular when unknown).
const currentLayout = computed(() => getLayout(layout.value) ?? getLayout('tabular'));

const downloadHandler = computed(() => layoutRef.value?.state?.download);

const { confirmDelete, deleting, batchDelete, error: deleteError, batchEditActive } = useBatch();

async function refresh() {
	await layoutRef.value?.state?.refresh?.();
}

async function batchRefresh() {
	selection.value = [];
	await refresh();
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

		const batchPrimaryKeys = selection.value;

		try {
			await sdk.request(requestEndpoint(`/translations`, { method: 'DELETE', body: batchPrimaryKeys }));

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
		ref="layoutRef"
		v-slot="{ layoutState }"
		v-model:selection="selection"
		v-model:layout-options="layoutOptions"
		v-model:layout-query="layoutQuery"
		:filter-user="filter"
		:filter="filter"
		:search="search"
		collection="directus_translations"
		:reset-preset="resetPreset"
		:clear-filters="clearFilters"
	>
		<PrivateView
			fill
			:title="$t('settings_translations')"
			icon="translate"
			:breadcrumb="[{ name: $t('settings'), to: '/settings' }]"
		>
			<template #actions>
				<component :is="currentLayout?.slots.actions" v-if="currentLayout?.slots.actions" v-bind="layoutState" />

				<SearchInput v-model="search" v-model:filter="filter" collection="directus_translations" />

				<BoButton
					v-if="selection.length > 0"
					variant="secondary"
					icon="delete"
					class="action-delete hover:bg-error-600 hover:text-white"
					:aria-label="$t('delete_label')"
					:title="$t('delete_label')"
					@click="confirmDelete = true"
				/>

				<BoButton
					v-if="selection.length > 0"
					variant="secondary"
					icon="edit"
					:aria-label="$t('edit')"
					:title="$t('edit')"
					@click="batchEditActive = true"
				/>

				<BoButton
					icon="add"
					:to="addNewLink"
					:aria-label="$t('create_custom_translation')"
					:title="$t('create_custom_translation')"
				/>
			</template>

			<template #navigation>
				<SettingsNavigation />
			</template>

			<component :is="currentLayout?.component" v-bind="layoutState">
				<template #no-results>
					<BoInfo :title="$t('no_results')" icon="search">
						{{ $t('no_results_copy') }}

						<template #append>
							<BoButton @click="clearFilters">{{ $t('clear_filters') }}</BoButton>
						</template>
					</BoInfo>
				</template>

				<template #no-items>
					<BoInfo
						:title="$t('no_custom_translations')"
						v-bind="currentCollection?.icon ? { icon: currentCollection.icon } : {}"
					>
						{{ $t('no_custom_translations_copy') }}

						<template #append>
							<BoButton :to="{ name: 'settings-translations-item', params: { primaryKey: '+' } }">
								{{ $t('create_custom_translation') }}
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
				:primary-keys="selection"
				collection="directus_translations"
				@refresh="batchRefresh"
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
				<LayoutSidebarDetail v-model="layout">
					<component :is="currentLayout?.slots.options" v-if="currentLayout?.slots.options" v-bind="layoutState" />
				</LayoutSidebarDetail>
				<component :is="currentLayout?.slots.sidebar" v-if="currentLayout?.slots.sidebar" v-bind="layoutState" />
				<RefreshSidebarDetail v-model="refreshInterval" @refresh="refresh" />
				<ExportSidebarDetail
					collection="directus_translations"
					:filter="filter ?? undefined"
					:search="search ?? undefined"
					:layout-query="layoutQuery"
					:on-download="downloadHandler"
					@refresh="refresh"
				/>
			</template>
		</PrivateView>
	</component>
</template>
