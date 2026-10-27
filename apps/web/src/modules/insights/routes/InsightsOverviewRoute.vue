<!-- Ported from directus/app/src/modules/insights/routes/overview.vue -->
<script setup lang="ts">
// Backoffice (spec 018 US1, FR-010 to FR-015, recipe Q-2): VTable is BoTable with multi-select in a `fill` page (D-99),
// VMenu is BoMenu, VDialog BoDialog, VInfo BoInfo, header buttons BoButton. api -> SDK; errors open the error dialog.
// Export: apiFetch + blob + saveAs like the 014 export (window.open cannot send the session cookie to another API
// origin, research R2). Duplicate catches its error (R-49; DR leaves the row spinning).
import { queryToParams } from '@directus/sdk';
import fileSaver from 'file-saver';
import { sortBy } from 'lodash-es';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { apiFetch, requestEndpoint, sdk } from '../../../api/sdk.ts';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoInfo from '../../../components/BoInfo.vue';
import BoMenu, { type BoMenuItem } from '../../../components/BoMenu.vue';
import BoTable, { type BoTableColumn, type BoTableSort } from '../../../components/BoTable.vue';
import SearchInput from '../../../components/SearchInput.vue';
import ValueNull from '../../../components/render/ValueNull.vue';
import BasicImportSidebarDetail from '../../../components/sidebar/BasicImportSidebarDetail.vue';
import { showUnexpectedError } from '../../../composables/use-notices.ts';
import { useCollectionPermissions } from '../../../composables/use-permissions/index.ts';
import PrivateView from '../../../layout/PrivateView.vue';
import { type Dashboard, useInsightsStore } from '../../../stores/insights.ts';
import DashboardDialog from '../components/DashboardDialog.vue';
import InsightsNavigation from '../components/InsightsNavigation.vue';

const { t } = useI18n();

const router = useRouter();

const insightsStore = useInsightsStore();

const confirmDelete = ref<string | null>(null);
const deletingDashboard = ref(false);
const editDashboard = ref<Dashboard>();

const selection = ref<string[]>([]);
const search = ref<string | null>(null);

const createDialogActive = ref(false);

// Backoffice (spec 025, FR-028): the export buttons follow the export permission (DR: create), the import sidebar the
// import permission (admin-only for this system collection).
const { createAllowed, updateAllowed, deleteAllowed, exportAllowed } = useCollectionPermissions('directus_dashboards');
const batchDeleteAllowed = deleteAllowed;

const internalSort = ref<BoTableSort>({ by: 'name', desc: false });

function refresh() {
	insightsStore.hydrate();
}

function updateSort(sort: BoTableSort | null) {
	internalSort.value = sort ?? { by: 'name', desc: false };
}

const tableHeaders = ref<BoTableColumn[]>([
	{ label: '', key: 'icon', width: 42, sortable: false, align: 'left' },
	{ label: t('name'), key: 'name', width: 240, sortable: true, align: 'left' },
	{ label: t('note'), key: 'note', width: 360, sortable: false, align: 'left' },
]);

const dashboards = computed(() => {
	const insightDasboards = insightsStore.dashboards;

	const searchedDashboards = search.value
		? insightDasboards.filter((dashboard) => dashboard.name.toLowerCase().includes(search.value!.toLowerCase()))
		: insightDasboards;

	const sortedDashboards = sortBy(searchedDashboards, [internalSort.value.by ?? 'name']);
	return internalSort.value.desc ? sortedDashboards.reverse() : sortedDashboards;
});

function navigateToDashboard({ item: dashboard, event }: { item: Record<string, any>; event: Event }) {
	const route = { name: 'insights-dashboard', params: { primaryKey: dashboard['id'] } };
	const mouse = event as MouseEvent;

	// Backoffice: Ctrl/Cmd/middle click opens a new tab, as the other tables of the app.
	if (mouse.ctrlKey || mouse.metaKey || mouse.button === 1) {
		window.open(router.resolve(route).href, '_blank');
	} else {
		router.push(route);
	}
}

function getNewDashboardData(id: string) {
	return {
		...insightsStore.getDashboard(id),
		panels: insightsStore.getPanelsForDashboard(id).map((panel) => {
			return {
				...panel,
				date_created: undefined,
				user_created: undefined,
				id: undefined,
			};
		}),
		date_created: undefined,
		user_created: undefined,
		id: undefined,
	};
}

const duplicating = ref<string | null>(null);

async function duplicateDashboard(id: string) {
	duplicating.value = id;

	try {
		const values = getNewDashboardData(id);
		await sdk.request(
			requestEndpoint('/dashboards', {
				method: 'POST',
				body: { ...values, name: `${values.name} (copy)` },
				params: { fields: ['id'] },
			}),
		);
		await insightsStore.hydrate();
	} catch (error) {
		showUnexpectedError(error);
	} finally {
		duplicating.value = null;
	}
}

async function exportDashboard(ids: string[]) {
	const params: Record<string, unknown> = {
		export: 'json',
		fields: [
			'name',
			'icon',
			'note',
			'color',
			'panels.name',
			'panels.icon',
			'panels.color',
			'panels.show_header',
			'panels.note',
			'panels.type',
			'panels.position_x',
			'panels.position_y',
			'panels.width',
			'panels.height',
			'panels.options',
		],
		filter: {
			id: {
				_in: ids,
			},
		},
	};

	try {
		const query = new URLSearchParams(queryToParams(params));
		const response = await apiFetch(`/dashboards?${query}`);

		if (!response.ok) throw await response.json().catch(() => ({ response: { status: response.status } }));

		const disposition = /filename="?([^";]+)"?/.exec(response.headers.get('Content-Disposition') ?? '')?.[1];

		fileSaver.saveAs(await response.blob(), disposition ?? 'directus_dashboards.json');
	} catch (error) {
		showUnexpectedError(error);
	}
}

async function deleteDashboard() {
	if (deletingDashboard.value || !confirmDelete.value) return;

	deletingDashboard.value = true;

	try {
		await sdk.request(requestEndpoint(`/dashboards/${confirmDelete.value}`, { method: 'DELETE' }));
		await insightsStore.hydrate();
		confirmDelete.value = null;
	} catch (error) {
		showUnexpectedError(error);
	} finally {
		deletingDashboard.value = false;
	}
}

const confirmBatchDelete = ref(false);
const batchDeleting = ref(false);

async function batchDelete() {
	if (batchDeleting.value) return;

	batchDeleting.value = true;

	const batchPrimaryKeys = selection.value;

	try {
		await sdk.request(requestEndpoint('/dashboards', { method: 'DELETE', body: batchPrimaryKeys }));

		selection.value = [];
		refresh();
	} catch (error) {
		showUnexpectedError(error);
	} finally {
		confirmBatchDelete.value = false;
		batchDeleting.value = false;
	}
}

function menuItems(dashboard: Dashboard): BoMenuItem[] {
	return [
		{
			text: t('edit_dashboard'),
			icon: 'edit',
			disabled: !updateAllowed.value,
			onSelect: () => (editDashboard.value = dashboard),
		},
		{
			text: t('duplicate_dashboard'),
			icon: 'content_copy',
			loading: duplicating.value === dashboard.id,
			onSelect: () => duplicateDashboard(dashboard.id),
		},
		{
			text: t('export_dashboard'),
			icon: 'download',
			disabled: !exportAllowed.value,
			onSelect: () => exportDashboard([dashboard.id]),
		},
		{
			text: t('delete_dashboard'),
			icon: 'delete',
			danger: true,
			disabled: !deleteAllowed.value,
			onSelect: () => (confirmDelete.value = dashboard.id),
		},
	];
}

const deleteOpen = computed({
	get: () => !!confirmDelete.value,
	set: (open: boolean) => {
		if (!open) confirmDelete.value = null;
	},
});

const editOpen = computed({
	get: () => !!editDashboard.value,
	set: (open: boolean) => {
		if (!open) editDashboard.value = undefined;
	},
});

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<PrivateView :title="$t('insights')" icon="insights" fill>
		<template #navigation>
			<InsightsNavigation @create="createDialogActive = true" />
		</template>

		<template #actions>
			<SearchInput
				v-if="insightsStore.dashboards.length > 0"
				v-model="search"
				:show-filter="false"
				:autofocus="insightsStore.dashboards.length > 25"
				:placeholder="$t('search_dashboard')"
			/>

			<BoButton
				v-if="selection.length > 0"
				variant="secondary"
				icon="download"
				:aria-label="exportAllowed ? $t('export_dashboard') : $t('not_allowed')"
				:title="exportAllowed ? $t('export_dashboard') : $t('not_allowed')"
				:disabled="exportAllowed !== true"
				@click="exportDashboard(selection)"
			/>

			<BoButton
				v-if="selection.length > 0"
				variant="secondary"
				icon="delete"
				:aria-label="batchDeleteAllowed ? $t('delete_label') : $t('not_allowed')"
				:title="batchDeleteAllowed ? $t('delete_label') : $t('not_allowed')"
				:disabled="batchDeleteAllowed !== true"
				@click="confirmBatchDelete = true"
			/>

			<BoButton
				icon="add"
				:aria-label="createAllowed ? $t('create_dashboard') : $t('not_allowed')"
				:title="createAllowed ? $t('create_dashboard') : $t('not_allowed')"
				:disabled="createAllowed === false"
				@click="createDialogActive = true"
			/>
		</template>

		<template #sidebar>
			<BasicImportSidebarDetail collection="directus_dashboards" @refresh="refresh" />
		</template>

		<BoTable
			v-if="dashboards.length > 0"
			v-model:columns="tableHeaders"
			v-model="selection"
			:rows="dashboards"
			row-key="id"
			show-select="multiple"
			:sort="internalSort"
			show-resize
			fixed-header
			:append-width="48"
			data-insights-route
			@click:row="navigateToDashboard"
			@update:sort="updateSort($event)"
		>
			<template #[`item.icon`]="{ item }">
				<BoIcon
					:name="item.icon"
					size="sm"
					:class="{ 'text-gray-500 dark:text-gray-400': !item.color }"
					:style="item.color ? { color: item.color } : undefined"
				/>
			</template>

			<template #[`item.name`]="{ item }">
				<div class="truncate text-gray-800 dark:text-white/90" :title="item.name">{{ item.name }}</div>
			</template>

			<template #[`item.note`]="{ item }">
				<div v-if="item.note" class="truncate" :title="item.note">{{ item.note }}</div>
				<!-- DR v-table default cell: ValueNull ("--") for an empty note (table-row.vue). -->
				<ValueNull v-else />
			</template>

			<template #item-append="{ item }">
				<BoMenu :items="menuItems(item as Dashboard)" side="left" align="start">
					<template #trigger>
						<button
							type="button"
							class="ctx-toggle inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
							:class="FOCUS"
							:aria-label="$t('item_options', { item: item.name })"
						>
							<BoIcon name="more_vert" size="sm" />
						</button>
					</template>
				</BoMenu>
			</template>
		</BoTable>

		<BoInfo v-else-if="search" icon="search" :title="$t('no_results')">
			{{ $t('no_results_copy') }}

			<template #append>
				<BoButton @click="search = null">{{ $t('clear_filters') }}</BoButton>
			</template>
		</BoInfo>

		<BoInfo v-else icon="space_dashboard" :title="$t('no_dashboards')">
			{{ $t('no_dashboards_copy') }}

			<template v-if="createAllowed" #append>
				<BoButton @click="createDialogActive = true">{{ $t('create_dashboard') }}</BoButton>
			</template>
		</BoInfo>

		<BoDialog v-model:open="deleteOpen" :title="$t('dashboard_delete_confirm')">
			<form id="delete-dashboard-form" @submit.prevent="deleteDashboard" />

			<template #actions>
				<BoButton variant="secondary" autofocus @click="confirmDelete = null">{{ $t('cancel') }}</BoButton>
				<BoButton type="submit" form="delete-dashboard-form" variant="danger" :loading="deletingDashboard">
					{{ $t('delete_label') }}
				</BoButton>
			</template>
		</BoDialog>

		<BoDialog v-model:open="confirmBatchDelete" :title="$t('batch_delete_confirm', selection.length)">
			<form id="batch-delete-dashboards-form" @submit.prevent="batchDelete" />

			<template #actions>
				<BoButton variant="secondary" autofocus @click="confirmBatchDelete = false">{{ $t('cancel') }}</BoButton>
				<BoButton type="submit" form="batch-delete-dashboards-form" variant="danger" :loading="batchDeleting">
					{{ $t('delete_label') }}
				</BoButton>
			</template>
		</BoDialog>

		<DashboardDialog v-model="createDialogActive" />
		<DashboardDialog v-model="editOpen" :dashboard="editDashboard" />
	</PrivateView>
</template>
