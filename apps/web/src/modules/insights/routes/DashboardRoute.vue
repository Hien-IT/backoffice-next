<!-- Ported from directus/app/src/modules/insights/routes/dashboard.vue -->
<script setup lang="ts">
// Backoffice (spec 018 US2, US3, FR-020 to FR-029, recipe Q-34): VWorkspace is BoWorkspace (+ zoomToFit) with one
// PanelTile per panel; header buttons are BoButton (zoom is a pressed toggle); VDialog is BoDialog with Keep Editing
// first (D-76); InsightsNotFound is ContentNotFound of module `insights`. No breadcrumb (D-101). Panel components come
// from the static registry (loaded by the store, FR-109). Save leaves edit mode even when it fails, as Directus (R-56).
import { applyOptionsData } from '@directus/utils';
import { assign } from 'lodash-es';
import { computed, nextTick, ref, toRefs, unref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterView, useRouter } from 'vue-router';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import CommentsSidebarDetail from '../../../components/sidebar/CommentsSidebarDetail.vue';
import RefreshSidebarDetail from '../../../components/sidebar/RefreshSidebarDetail.vue';
import type { AppTile } from '../../../components/workspace/BoWorkspaceTile.vue';
import BoWorkspace from '../../../components/workspace/BoWorkspace.vue';
import { useEditsGuard } from '../../../composables/use-edits-guard.ts';
import { useItemPermissions } from '../../../composables/use-permissions/index.ts';
import { useShortcut } from '../../../composables/use-shortcut.ts';
import PrivateView from '../../../layout/PrivateView.vue';
import type { PanelConfig } from '../../../panels/types.ts';
import { loadPanelRegistry, useInsightsStore } from '../../../stores/insights.ts';
import { pointOnLine } from '../../../utils/point-on-line.ts';
import ContentNotFound from '../../content/routes/ContentNotFound.vue';
import CopyPanelDialog from '../components/CopyPanelDialog.vue';
import InsightsNavigation from '../components/InsightsNavigation.vue';
import PanelTile from '../components/PanelTile.vue';

const props = withDefaults(
	defineProps<{
		primaryKey: string;
		panelKey?: string | null;
	}>(),
	{ panelKey: null },
);

const { t } = useI18n();
const router = useRouter();

const insightsStore = useInsightsStore();

const { loading, errors, data, saving, hasEdits, refreshIntervals, variables } = toRefs(insightsStore);

// Backoffice: the registry is a lazy chunk the store loads in hydrate; this covers a route opened before that finished.
const panelTypes = ref<PanelConfig[]>([]);
loadPanelRegistry().then((registry) => (panelTypes.value = registry.getPanels()));

const getPanelType = (type: string) => panelTypes.value.find((panelType) => panelType.id === type);

const zoomToFit = ref(false);

const { updateAllowed } = useItemPermissions('directus_panels', props.primaryKey, false);

const now = new Date();

const editMode = ref(false);

const tiles = computed<AppTile[]>(() => {
	const panels = insightsStore.getPanelsForDashboard(props.primaryKey);

	const panelsWithCoordinates = panels.map((panel) => ({
		...panel,
		coordinates: [
			[panel.position_x!, panel.position_y!],
			[panel.position_x! + panel.width!, panel.position_y!],
			[panel.position_x! + panel.width!, panel.position_y! + panel.height!],
			[panel.position_x!, panel.position_y! + panel.height!],
		] as [number, number][],
	}));

	const tiles: AppTile[] = panelsWithCoordinates
		.map((panel) => {
			let topLeftIntersects = false;
			let topRightIntersects = false;
			let bottomRightIntersects = false;
			let bottomLeftIntersects = false;

			for (const otherPanel of panelsWithCoordinates) {
				if (otherPanel.id === panel.id) continue;

				const borders = [
					[otherPanel.coordinates[0]!, otherPanel.coordinates[1]!],
					[otherPanel.coordinates[1]!, otherPanel.coordinates[2]!],
					[otherPanel.coordinates[2]!, otherPanel.coordinates[3]!],
					[otherPanel.coordinates[3]!, otherPanel.coordinates[0]!],
				] as const;

				if (topLeftIntersects === false) {
					topLeftIntersects = borders.some(([p1, p2]) => pointOnLine(panel.coordinates[0]!, p1, p2));
				}

				if (topRightIntersects === false) {
					topRightIntersects = borders.some(([p1, p2]) => pointOnLine(panel.coordinates[1]!, p1, p2));
				}

				if (bottomRightIntersects === false) {
					bottomRightIntersects = borders.some(([p1, p2]) => pointOnLine(panel.coordinates[2]!, p1, p2));
				}

				if (bottomLeftIntersects === false) {
					bottomLeftIntersects = borders.some(([p1, p2]) => pointOnLine(panel.coordinates[3]!, p1, p2));
				}
			}

			const panelType = getPanelType(panel.type);

			const tile: AppTile = {
				id: panel.id,
				x: panel.position_x,
				y: panel.position_y,
				width: panel.width,
				height: panel.height,
				name: panel.name,
				icon: panel.icon ?? panelType?.icon,
				color: panel.color,
				note: panel.note,
				showHeader: panel.show_header === true,
				minWidth: panelType?.minWidth,
				minHeight: panelType?.minHeight,
				draggable: true,
				borderRadius: [!topLeftIntersects, !topRightIntersects, !bottomRightIntersects, !bottomLeftIntersects],
				data: {
					options: applyOptionsData(panel.options ?? {}, unref(variables), panelType?.skipUndefinedKeys),
					type: panel.type,
				},
			};

			return tile;
		})
		.filter((t) => t);

	return tiles;
});

watch(
	() => props.primaryKey,
	() => {
		insightsStore.refresh(props.primaryKey);
	},
);

const confirmCancel = ref(false);

const cancelChanges = (force = false) => {
	if (unref(hasEdits) && force !== true) {
		confirmCancel.value = true;
	} else {
		insightsStore.clearEdits();
		editMode.value = false;
		confirmCancel.value = false;
		insightsStore.refresh(props.primaryKey);
		focusEditButton();
	}
};

const copyPanelID = ref<string | null>(null);

useShortcut('meta+s', () => {
	saveChanges();
});

async function saveChanges() {
	await insightsStore.saveChanges();
	editMode.value = false;
	focusEditButton();
}

watch(editMode, (editModeEnabled) => {
	if (editModeEnabled) {
		zoomToFit.value = false;
	}
});

const currentDashboard = computed(() => insightsStore.getDashboard(props.primaryKey));

const { confirmLeave, leaveTo } = useEditsGuard(hasEdits, {
	ignorePrefix: computed(() => `/insights/${props.primaryKey}`),
});

const discardAndLeave = () => {
	if (!unref(leaveTo)) return;
	cancelChanges(true);
	confirmLeave.value = false;
	router.push(unref(leaveTo)!);
};

const toggleZoomToFit = () => (zoomToFit.value = !zoomToFit.value);

const refreshInterval = computed({
	get() {
		return unref(refreshIntervals)[props.primaryKey] ?? null;
	},
	set(val) {
		refreshIntervals.value = assign({}, unref(refreshIntervals), { [props.primaryKey]: val });
	},
});

/* Backoffice: focus after an action (FR-029). */
const header = useTemplateRef<HTMLElement>('header');

async function startEditing() {
	editMode.value = true;
	await nextTick();
	// Save is disabled until something changes (as Directus), so "+" takes the focus then.
	header.value?.querySelector<HTMLElement>('[data-action="save"]:not(:disabled), [data-action="create"]')?.focus();
}

async function focusEditButton() {
	await nextTick();
	header.value?.querySelector<HTMLButtonElement>('[data-action="edit"]')?.focus();
}

// The focus goes to the previous tile, else to "+", once the menu gave it back to its removed trigger.
function deletePanel(tile: AppTile) {
	const previous = tiles.value[tiles.value.findIndex(({ id }) => id === tile.id) - 1];
	insightsStore.stagePanelDelete(tile.id);

	setTimeout(() => {
		const target = previous
			? document.querySelector<HTMLElement>(`[data-tile-id="${previous.id}"] button`)
			: header.value?.querySelector<HTMLElement>('[data-action="create"]');
		target?.focus();
	});
}

function editPanel(tile: AppTile) {
	router.push({ name: 'panel-detail', params: { primaryKey: props.primaryKey, panelKey: tile.id } });
}

const PRESSED = 'bg-brand-50! text-brand-600! dark:bg-brand-500/15! dark:text-brand-400!';
</script>

<template>
	<ContentNotFound v-if="!currentDashboard" module="insights" />
	<PrivateView v-else :title="currentDashboard.name" :icon="currentDashboard.icon" fill>
		<template #actions>
			<div ref="header" class="contents">
				<template v-if="editMode">
					<BoButton
						variant="secondary"
						icon="clear"
						:aria-label="t('clear_changes')"
						:title="t('clear_changes')"
						@click="cancelChanges()"
					/>

					<BoButton
						variant="secondary"
						icon="add"
						:aria-label="t('create_panel')"
						:title="t('create_panel')"
						data-action="create"
						:to="{ name: 'panel-detail', params: { primaryKey: currentDashboard.id, panelKey: '+' } }"
					/>

					<BoButton
						icon="check"
						data-action="save"
						:aria-label="t('save')"
						:title="t('save')"
						:disabled="!hasEdits"
						:loading="saving"
						@click="saveChanges"
					/>
				</template>

				<template v-else>
					<BoButton
						variant="secondary"
						icon="aspect_ratio"
						:class="{ [PRESSED]: zoomToFit }"
						:aria-label="t('fit_to_screen')"
						:aria-pressed="zoomToFit"
						:title="t('fit_to_screen')"
						@click="toggleZoomToFit"
					/>

					<BoButton
						variant="secondary"
						icon="edit"
						data-action="edit"
						:aria-label="t('edit_panels')"
						:title="t('edit_panels')"
						:disabled="!updateAllowed"
						@click="startEditing"
					/>
				</template>
			</div>
		</template>

		<template #sidebar>
			<CommentsSidebarDetail :key="primaryKey" collection="directus_dashboards" :primary-key="primaryKey" />

			<RefreshSidebarDetail v-model="refreshInterval" @refresh="insightsStore.refresh(primaryKey)" />
		</template>

		<template #navigation>
			<InsightsNavigation />
		</template>

		<!-- Focusable so the keyboard can scroll the grid (axe scrollable-region-focusable), as the flow canvas. -->
		<div
			class="relative p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
			:class="zoomToFit ? 'h-full w-full overflow-hidden' : 'min-h-full min-w-max'"
			role="region"
			tabindex="0"
			:aria-label="currentDashboard.name"
			data-insights-route
		>
			<BoWorkspace :edit-mode="editMode" :tiles="tiles" :zoom-to-fit="zoomToFit">
				<template #tile="{ tile, gridSize }">
					<PanelTile
						:tile="tile"
						:panel-type="getPanelType(tile.data?.['type'])"
						:edit-mode="editMode"
						:grid-size="gridSize"
						:dashboard="primaryKey"
						:now="now"
						:loading="loading.includes(tile.id)"
						:error="errors[tile.id]"
						:data="data[tile.id]"
						:has-data="tile.id in data"
						@update="insightsStore.stagePanelUpdate({ id: tile.id, edits: $event })"
						@edit="editPanel(tile)"
						@move="copyPanelID = tile.id"
						@duplicate="insightsStore.stagePanelDuplicate(tile.id)"
						@delete="deletePanel(tile)"
					/>
				</template>
			</BoWorkspace>
		</div>

		<RouterView name="detail" :dashboard-key="primaryKey" :panel-key="panelKey" />

		<CopyPanelDialog v-model="copyPanelID" :dashboard="primaryKey" />

		<BoDialog v-model:open="confirmCancel" :title="$t('unsaved_changes')" :description="$t('discard_changes_copy')">
			<template #actions>
				<!-- Backoffice: the non-discarding button first, it gets the initial focus (D-76). -->
				<BoButton @click="confirmCancel = false">{{ $t('keep_editing') }}</BoButton>
				<BoButton variant="secondary" @click="cancelChanges(true)">{{ $t('discard_changes') }}</BoButton>
			</template>
		</BoDialog>

		<BoDialog v-model:open="confirmLeave" :title="$t('unsaved_changes')" :description="$t('unsaved_changes_copy')">
			<template #actions>
				<BoButton @click="confirmLeave = false">{{ $t('keep_editing') }}</BoButton>
				<BoButton variant="secondary" @click="discardAndLeave">{{ $t('discard_changes') }}</BoButton>
			</template>
		</BoDialog>
	</PrivateView>
</template>
