<!-- Ported from directus/app/src/modules/settings/routes/flows/overview.vue -->
<script setup lang="ts">
// Backoffice (spec 017 US1, FR-010 to FR-016, recipes Q-2 and Q-33): VTable is BoTable in a `fill` page (D-99: only the
// table body scrolls, so the header stays fixed as Directus `fixed-header`), the status column is a Badge instead of
// the formatted-value display (same two labels), VMenu is BoMenu on a named `more_vert` button, VDialog is BoDialog,
// VInfo is BoInfo, the header button is BoButton. No breadcrumb (D-101). api goes through the SDK; errors open the error
// dialog (D-66). The list reads the flows store only: opening the page sends no request, as in Directus (CHK021).
import type { FlowRaw } from '@directus/types';
import { sortBy } from 'lodash-es';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterView, useRouter } from 'vue-router';
import { requestEndpoint, sdk } from '../../../../api/sdk.ts';
import BoButton from '../../../../components/BoButton.vue';
import BoDialog from '../../../../components/BoDialog.vue';
import BoIcon from '../../../../components/BoIcon.vue';
import BoInfo from '../../../../components/BoInfo.vue';
import BoMenu from '../../../../components/BoMenu.vue';
import BoTable, { type BoTableColumn, type BoTableSort } from '../../../../components/BoTable.vue';
import { useCollectionPermissions } from '../../../../composables/use-permissions/index.ts';
import { showUnexpectedError } from '../../../../composables/use-notices.ts';
import PrivateView from '../../../../layout/PrivateView.vue';
import { useFlowsStore } from '../../../../stores/flows.ts';
import SettingsNavigation from '../../components/SettingsNavigation.vue';
import FlowDrawer from './FlowDrawer.vue';

const { t } = useI18n();

const router = useRouter();

const { createAllowed } = useCollectionPermissions('directus_flows');

const confirmDelete = ref<FlowRaw | null>(null);
const deletingFlow = ref(false);
const editFlow = ref<string | undefined>();

const columns = ref<BoTableColumn[]>([
	{ label: '', key: 'icon', width: 42, sortable: false, align: 'left' },
	{ label: t('status'), key: 'status', width: 100, sortable: true, align: 'left' },
	{ label: t('name'), key: 'name', width: 240, sortable: true, align: 'left' },
	{ label: t('description'), key: 'description', width: 360, sortable: false, align: 'left' },
]);

const internalSort = ref<BoTableSort>({ by: 'name', desc: false });

const flowsStore = useFlowsStore();

const flows = computed<FlowRaw[]>(() => {
	const by = (internalSort.value.by ?? 'name') as keyof FlowRaw;
	const sortedFlows = sortBy(flowsStore.flows, (flow) => flow[by]);
	return internalSort.value.desc ? sortedFlows.reverse() : sortedFlows;
});

function updateSort(sort: BoTableSort | null) {
	internalSort.value = sort ?? { by: 'name', desc: false };
}

function navigateToFlow({ item: flow, event }: { item: Record<string, any>; event: Event }) {
	const route = { name: 'settings-flows-item', params: { primaryKey: flow['id'] } };
	const mouse = event as MouseEvent;

	if (mouse.ctrlKey || mouse.metaKey || mouse.button === 1) {
		window.open(router.resolve(route).href, '_blank');
	} else {
		router.push(route);
	}
}

async function deleteFlow() {
	if (!confirmDelete.value || deletingFlow.value) return;

	deletingFlow.value = true;

	try {
		await sdk.request(requestEndpoint(`/flows/${confirmDelete.value.id}`, { method: 'DELETE' }));
		await flowsStore.hydrate();
		confirmDelete.value = null;
	} catch (error) {
		showUnexpectedError(error);
	} finally {
		deletingFlow.value = false;
	}
}

async function toggleFlowStatusById(id: string, value: string) {
	try {
		await sdk.request(
			requestEndpoint(`/flows/${id}`, {
				method: 'PATCH',
				body: { status: value === 'active' ? 'inactive' : 'active' },
			}),
		);

		await flowsStore.hydrate();
	} catch (error) {
		showUnexpectedError(error);
	}
}

function onFlowDrawerCompletion(id: string) {
	if (editFlow.value === '+') {
		router.push({ name: 'settings-flows-item', params: { primaryKey: id } });
	}

	editFlow.value = undefined;
}

function menuItems(flow: FlowRaw) {
	return [
		flow.status === 'active'
			? { text: t('set_flow_inactive'), icon: 'block', onSelect: () => toggleFlowStatusById(flow.id, flow.status) }
			: { text: t('set_flow_active'), icon: 'check', onSelect: () => toggleFlowStatusById(flow.id, flow.status) },
		{ text: t('edit_flow'), icon: 'edit', onSelect: () => (editFlow.value = flow.id) },
		{ text: t('delete_flow'), icon: 'delete', danger: true, onSelect: () => (confirmDelete.value = flow) },
	];
}

const deleteOpen = computed({
	get: () => !!confirmDelete.value,
	set: (open: boolean) => {
		if (!open) confirmDelete.value = null;
	},
});

const BADGE = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-theme-xs font-medium';
const STATUS: Record<string, string> = {
	active: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
	inactive: 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80',
};
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<PrivateView :title="$t('flows')" icon="bolt" :breadcrumb="[{ name: $t('settings'), to: '/settings' }]" fill>
		<template #navigation>
			<SettingsNavigation />
		</template>

		<template #actions>
			<BoButton
				icon="add"
				:aria-label="createAllowed ? $t('create_flow') : $t('not_allowed')"
				:title="createAllowed ? $t('create_flow') : $t('not_allowed')"
				:disabled="createAllowed === false"
				@click="editFlow = '+'"
			/>
		</template>

		<BoInfo v-if="flows.length === 0" icon="bolt" :title="$t('no_flows')">
			{{ $t('no_flows_copy') }}

			<template v-if="createAllowed" #append>
				<BoButton @click="editFlow = '+'">{{ $t('create_flow') }}</BoButton>
			</template>
		</BoInfo>

		<BoTable
			v-else
			v-model:columns="columns"
			:rows="flows"
			row-key="id"
			:sort="internalSort"
			show-resize
			fixed-header
			:append-width="48"
			@click:row="navigateToFlow"
			@update:sort="updateSort($event)"
		>
			<template #[`item.icon`]="{ item }">
				<BoIcon
					:name="item.icon ?? 'bolt'"
					size="sm"
					:class="{ 'text-brand-500 dark:text-brand-400': !item.color }"
					:style="item.color ? { color: item.color } : undefined"
				/>
			</template>

			<template #[`item.status`]="{ item }">
				<span :class="[BADGE, STATUS[item.status] ?? STATUS['inactive']]">{{ $t(item.status) }}</span>
			</template>

			<template #[`item.name`]="{ item }">
				<div class="truncate text-gray-800 dark:text-white/90" :title="item.name">{{ item.name }}</div>
			</template>

			<template #[`item.description`]="{ item }">
				<div v-if="item.description" class="truncate" :title="item.description">{{ item.description }}</div>
			</template>

			<template #item-append="{ item }">
				<BoMenu :items="menuItems(item as FlowRaw)" side="left" align="start">
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

		<BoDialog v-model:open="deleteOpen" :title="$t('flow_delete_confirm', { flow: confirmDelete?.name ?? '' })">
			<form id="delete-flow-form" @submit.prevent="deleteFlow" />

			<template #actions>
				<BoButton variant="secondary" autofocus @click="confirmDelete = null">{{ $t('cancel') }}</BoButton>
				<BoButton type="submit" form="delete-flow-form" variant="danger" :loading="deletingFlow">
					{{ $t('delete_label') }}
				</BoButton>
			</template>
		</BoDialog>

		<FlowDrawer
			:active="editFlow !== undefined"
			:primary-key="editFlow ?? '+'"
			@cancel="editFlow = undefined"
			@done="onFlowDrawerCompletion"
		/>

		<RouterView name="add" />
	</PrivateView>
</template>
