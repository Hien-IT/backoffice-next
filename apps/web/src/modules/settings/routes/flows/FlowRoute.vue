<!-- Ported from directus/app/src/modules/settings/routes/flows/flow.vue (template, shortcuts, dialogs) -->
<script setup lang="ts">
// Backoffice (spec 017 US2, FR-020 to FR-032, recipes Q-29, Q-30, Q-33): the script logic is use-flow-editor.ts;
// PrivateView `fill` with the canvas as the scroll area (D-99), no breadcrumb (D-101), BoButton header actions,
// VWorkspace is BoWorkspace, VDialog is BoDialog with Keep Editing first (D-76), SettingsNotFound is ContentNotFound of
// the settings module. Focus after Edit Flow goes to Save, after Save or Clear Changes to Edit Flow (FR-106). The detail
// panel holds the Logs section (US4).
import { computed, nextTick, ref, toRef, unref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterView, useRouter } from 'vue-router';
import BoButton from '../../../../components/BoButton.vue';
import BoDialog from '../../../../components/BoDialog.vue';
import BoWorkspace from '../../../../components/workspace/BoWorkspace.vue';
import { useEditsGuard } from '../../../../composables/use-edits-guard.ts';
import { useShortcut } from '../../../../composables/use-shortcut.ts';
import PrivateView from '../../../../layout/PrivateView.vue';
import { getOperation } from '../../../../operations/index.ts';
import { translate } from '../../../../utils/translate-object-values.ts';
import ContentNotFound from '../../../content/routes/ContentNotFound.vue';
import SettingsNavigation from '../../components/SettingsNavigation.vue';
import FlowArrows from './components/FlowArrows.vue';
import CopyToDialog from './components/CopyToDialog.vue';
import LogsSidebarDetail from './components/LogsSidebarDetail.vue';
import FlowOperation from './components/FlowOperation.vue';
import { GRID_SIZE } from './constants.ts';
import FlowDrawer from './FlowDrawer.vue';
import { useFlowEditor } from './use-flow-editor.ts';

const props = defineProps<{
	primaryKey: string;
	operationId?: string;
}>();

const { t } = useI18n();
const router = useRouter();

const triggerDetailOpen = ref(false);

const {
	flow,
	stagedFlow,
	editMode,
	saving,
	deleting,
	deleteFlow,
	panelsToBeDeleted,
	hoveredPanelID,
	panels,
	currentOperation,
	existingOperationKeys,
	parentPanels,
	stageOperationEdits,
	stageOperation,
	cancelOperation,
	saveChanges,
	deletePanel,
	createPanel,
	duplicatePanel,
	copyPanelId,
	copyPanelTo,
	copyPanelLoading,
	copyPanelChoices,
	copyPanel,
	arrowInfo,
	arrowMove,
	arrowStop,
	hasEdits,
	cancelChanges,
} = useFlowEditor({
	primaryKey: toRef(props, 'primaryKey'),
	operationId: toRef(props, 'operationId'),
	router,
	operationName: (type) => {
		const name = getOperation(type)?.name;
		return name === undefined ? undefined : (translate(name) as string);
	},
	triggerLabel: () => t('trigger'),
});

useShortcut('meta+s', () => {
	/*
	 * Prevent saving of the Flow via shortcut when the  "Create Operation",
	 * "Edit Operation" or "Edit Trigger" drawer is opened
	 */
	if (props.operationId || unref(triggerDetailOpen)) return;

	save();
});

const confirmDelete = ref(false);

function editPanel(panel: Record<string, any>) {
	if (panel['id'] === '$trigger') triggerDetailOpen.value = true;
	else
		router.push({
			name: 'settings-flows-operation',
			params: { primaryKey: props.primaryKey, operationId: panel['id'] },
		});
}

// ------------- Focus (FR-106) ------------- //

async function focusAction(label: string) {
	await nextTick();
	document.querySelector<HTMLElement>(`main button[aria-label="${label}"]`)?.focus();
}

async function startEditing() {
	editMode.value = true;
	await focusAction(t('save'));
}

async function save() {
	await saveChanges();
	if (!editMode.value) await focusAction(t('edit_flow'));
}

// ------------- Navigation Guard ------------- //

const { confirmLeave, leaveTo } = useEditsGuard(hasEdits, {
	ignorePrefix: computed(() => `/settings/flows/${props.primaryKey}`),
});

const confirmCancel = ref(false);

function attemptCancelChanges(): void {
	if (hasEdits.value) {
		confirmCancel.value = true;
	} else {
		discardChanges();
	}
}

async function discardChanges() {
	confirmCancel.value = false;
	cancelChanges();
	await focusAction(t('edit_flow'));
}

function discardAndLeave() {
	if (!leaveTo.value) return;
	cancelChanges();
	confirmLeave.value = false;
	router.push(leaveTo.value);
}

const copyOpen = computed(() => !!copyPanelId.value);
</script>

<template>
	<ContentNotFound v-if="!flow" module="settings" />
	<PrivateView
		v-else
		:title="flow.name"
		icon="bolt"
		back="/settings/flows"
		:breadcrumb="[{ name: $t('flows'), to: '/settings/flows' }]"
		fill
	>
		<template #title-append>
			<span
				class="ms-2 inline-block size-2.5 shrink-0 rounded-full"
				:class="flow.status === 'active' ? 'bg-brand-500' : 'bg-gray-400'"
				:title="flow.status === 'active' ? $t('active') : $t('inactive')"
				role="img"
				:aria-label="flow.status === 'active' ? $t('active') : $t('inactive')"
			/>
		</template>

		<template #actions>
			<template v-if="editMode">
				<BoButton
					variant="secondary"
					icon="clear"
					:aria-label="$t('clear_changes')"
					:title="$t('clear_changes')"
					@click="attemptCancelChanges"
				/>
				<BoButton icon="check" :aria-label="$t('save')" :title="$t('save')" :loading="saving" @click="save" />
			</template>

			<template v-else>
				<BoButton
					variant="secondary"
					icon="delete"
					:aria-label="$t('delete_flow')"
					:title="$t('delete_flow')"
					@click="confirmDelete = true"
				/>
				<BoButton
					variant="secondary"
					icon="edit"
					:aria-label="$t('edit_flow')"
					:title="$t('edit_flow')"
					@click="startEditing"
				/>
			</template>
		</template>

		<template #navigation>
			<SettingsNavigation />
		</template>

		<template #sidebar>
			<LogsSidebarDetail :flow="flow" />
		</template>

		<div class="relative min-h-full min-w-max p-1" data-flow-canvas>
			<div class="relative">
				<FlowArrows
					:panels="panels"
					:arrow-info="arrowInfo"
					:parent-panels="parentPanels"
					:edit-mode="editMode"
					:hovered-panel="hoveredPanelID"
					:subdued="flow.status === 'inactive'"
				/>
				<BoWorkspace :tiles="panels as any" :edit-mode="editMode" :grid-size="GRID_SIZE">
					<template #tile="{ tile }">
						<FlowOperation
							:edit-mode="editMode"
							:panel="tile"
							:type="tile.id === '$trigger' ? 'trigger' : 'operation'"
							:parent="parentPanels[tile.id]"
							:flow="flow"
							:panels-to-be-deleted="panelsToBeDeleted"
							:is-hovered="hoveredPanelID === tile.id"
							:subdued="flow.status === 'inactive'"
							@create="createPanel"
							@edit="editPanel"
							@move="copyPanelId = $event"
							@update="stageOperationEdits"
							@delete="deletePanel"
							@duplicate="duplicatePanel"
							@arrow-move="arrowMove"
							@arrow-stop="arrowStop"
							@show-hint="hoveredPanelID = $event"
							@hide-hint="hoveredPanelID = null"
							@flow-status="stagedFlow.status = $event as any"
						/>
					</template>
				</BoWorkspace>
			</div>
		</div>

		<FlowDrawer
			:active="triggerDetailOpen"
			:primary-key="flow.id"
			start-tab="trigger_setup"
			@cancel="triggerDetailOpen = false"
			@done="triggerDetailOpen = false"
		/>

		<BoDialog v-model:open="confirmLeave" :title="$t('unsaved_changes')" :description="$t('unsaved_changes_copy')">
			<template #actions>
				<!-- Backoffice: the non-discarding button first, it gets the initial focus (D-76). -->
				<BoButton @click="confirmLeave = false">{{ $t('keep_editing') }}</BoButton>
				<BoButton variant="secondary" @click="discardAndLeave">{{ $t('discard_changes') }}</BoButton>
			</template>
		</BoDialog>

		<BoDialog v-model:open="confirmCancel" :title="$t('unsaved_changes')" :description="$t('discard_changes_copy')">
			<template #actions>
				<BoButton @click="confirmCancel = false">{{ $t('keep_editing') }}</BoButton>
				<BoButton variant="secondary" @click="discardChanges">{{ $t('discard_changes') }}</BoButton>
			</template>
		</BoDialog>

		<BoDialog v-model:open="confirmDelete" :title="$t('flow_delete_confirm', { flow: flow.name })">
			<template #actions>
				<BoButton variant="secondary" @click="confirmDelete = false">{{ $t('cancel') }}</BoButton>
				<BoButton variant="danger" :loading="deleting" @click="deleteFlow">{{ $t('delete_label') }}</BoButton>
			</template>
		</BoDialog>

		<CopyToDialog
			v-model:target="copyPanelTo"
			:open="copyOpen"
			:flows="copyPanelChoices"
			:loading="copyPanelLoading"
			@cancel="copyPanelId = undefined"
			@confirm="copyPanel"
		/>

		<RouterView
			:operation="currentOperation"
			:existing-operation-keys="existingOperationKeys"
			:flow="flow"
			@save="stageOperation"
			@cancel="cancelOperation"
		/>
	</PrivateView>
</template>
