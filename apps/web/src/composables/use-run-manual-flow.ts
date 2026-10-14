// Ported from directus/app/src/composables/use-flows.ts
// Backoffice: notify/unexpectedError have no snackbar store before feature 018 (D-45): the result is kept in
// `flowDialogsContext.notice` and FlowDialogs.vue shows it as a BoNotice. useInjectRunManualFlow builds this
// composable as a default when no screen provided one (FR-057, R10), so `header` and `presentation-links` run flows
// on their own; Directus falls back to a no-op there.
import formatTitle from '@directus/format-title';
import type { FlowRaw, Item, PrimaryKey } from '@directus/types';
import { computed, inject, provide, type Ref, ref, unref } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { type APIError, translateAPIError } from '../lang/index.ts';
import { useFlowsStore } from '../stores/flows.ts';
import { useNotificationsStore } from '../stores/notifications.ts';
import { translate } from '../utils/translate-object-values.ts';
import { useCollection } from './use-collection.ts';

interface UseFlowsOptions {
	collection: Ref<string>;
	primaryKey?: Ref<PrimaryKey | null>;
	selection?: Ref<Item[]>;
	location: 'collection' | 'item';
	hasEdits?: Ref<boolean>;
	onRefreshCallback: () => void;
}

export type ManualFlow = FlowRaw & {
	tooltip: string;
	isFlowDisabled: boolean;
};

/** Backoffice: what notify/unexpectedError would have shown (D-45). */
export type FlowNotice = { type: 'success' | 'danger'; text: string };

export interface FlowDialogsContext {
	confirmButtonCTA: string;
	confirmDialogDetails: { description: any; fields: any } | null;
	confirmUnsavedChanges: (flowId: string) => void;
	confirmCustomDialog: (flowId: string) => void;
	confirmValues: Record<string, any> | null;
	currentFlowId: string | null;
	displayCustomConfirmDialog: boolean;
	displayUnsavedChangesDialog: boolean;
	isConfirmButtonDisabled: boolean;
	resetConfirm: () => void;
	updateFieldValues: (event: Record<string, any>) => void;
	notice: FlowNotice | null;
}

export interface RunManualFlowContext {
	runManualFlow: (flowId: string) => void;
	runningFlows: Ref<string[]>;
	isActiveFlow: (flowId: string) => boolean | undefined;
}

const runManualFlowSymbol = 'runManualFlow';

export function useFlows(options: UseFlowsOptions) {
	const { collection, hasEdits = ref(false), location, onRefreshCallback, primaryKey, selection = ref([]) } = options;

	const { t } = useI18n();
	const { primaryKeyField } = useCollection(collection);
	const flowsStore = useFlowsStore();
	const notificationStore = useNotificationsStore();

	const runningFlows = ref<string[]>([]);
	const confirmValues = ref<Record<string, any> | null>(null);
	const confirmedUnsavedChanges = ref<boolean>(false);
	const confirmedCustomDialog = ref<boolean>(false);
	const currentFlowId = ref<string | null>(null);
	const notice = ref<FlowNotice | null>(null);

	const currentFlow = computed(() => {
		if (!currentFlowId.value) return null;

		return manualFlows.value.find((flow) => flow.id === currentFlowId.value);
	});

	const currentFlowConfirmations = computed(() => {
		if (!currentFlow.value) return null;

		return {
			isUnsavedChangesConfirmationRequired: hasEdits.value,
			isUnsavedChangesConfirmed: confirmedUnsavedChanges.value,
			isCustomDialogConfirmationRequired: currentFlow.value.options?.['requireConfirmation'],
			isCustomDialogConfirmed: confirmedCustomDialog.value,
		};
	});

	const flowDialogsContext = computed<FlowDialogsContext>(() => ({
		confirmButtonCTA: confirmButtonCTA.value,
		confirmDialogDetails: confirmDialogDetails.value,
		confirmUnsavedChanges,
		confirmCustomDialog,
		confirmValues: confirmValues.value,
		currentFlowId: currentFlowId.value,
		displayCustomConfirmDialog: displayCustomConfirmDialog.value,
		displayUnsavedChangesDialog: displayUnsavedChangesDialog.value,
		isConfirmButtonDisabled: isConfirmButtonDisabled.value,
		resetConfirm,
		updateFieldValues,
		notice: notice.value,
	}));

	const confirmButtonCTA = computed(() => {
		if (displayUnsavedChangesDialog.value) return t('run_flow_anyway');
		if (location === 'item') return t('run_flow_on_current');
		if (selection.value.length === 0) return t('run_flow');
		return t('run_flow_on_selected', selection.value.length);
	});

	const confirmDialogDetails = computed(() => {
		if (!currentFlow.value) return null;

		if (!currentFlow.value.options?.['requireConfirmation']) return null;

		return {
			description: currentFlow.value.options['confirmationDescription'],
			fields: (currentFlow.value.options['fields'] ?? []).map((field: Record<string, any>) => ({
				...field,
				name: !field['name'] && field['field'] ? formatTitle(field['field']) : field['name'],
			})),
		};
	});

	const displayCustomConfirmDialog = computed(
		() =>
			!!currentFlowId.value &&
			!!confirmDialogDetails.value &&
			!!currentFlowConfirmations.value?.isCustomDialogConfirmationRequired &&
			!currentFlowConfirmations.value?.isCustomDialogConfirmed &&
			!displayUnsavedChangesDialog.value,
	);

	const displayUnsavedChangesDialog = computed(
		() =>
			!!currentFlowId.value &&
			!!currentFlowConfirmations.value?.isUnsavedChangesConfirmationRequired &&
			!currentFlowConfirmations.value?.isUnsavedChangesConfirmed,
	);

	const isConfirmButtonDisabled = computed(() => {
		if (!currentFlowId.value) return true;

		for (const field of confirmDialogDetails.value?.fields || []) {
			if (
				field.meta?.required &&
				(!confirmValues.value ||
					confirmValues.value[field.field] === null ||
					confirmValues.value[field.field] === undefined)
			) {
				return true;
			}
		}

		return false;
	});

	const manualFlows = computed<ManualFlow[]>(() => {
		const manualFlows = flowsStore
			.getManualFlowsForCollection(collection.value)
			.filter(
				(flow) =>
					!flow.options?.['location'] ||
					flow.options?.['location'] === 'both' ||
					flow.options?.['location'] === location,
			)
			.map((flow) => ({
				...flow,
				options: flow.options ? translate(flow.options) : null,
				tooltip: getFlowTooltip(flow),
				isFlowDisabled: checkFlowDisabled(flow),
			}));

		function getFlowTooltip(manualFlow: FlowRaw) {
			if (location === 'item') return t('run_flow_on_current');

			if (manualFlow.options?.['requireSelection'] === false && selection.value.length === 0) {
				return t('run_flow_on_current_collection');
			}

			return t('run_flow_on_selected', selection.value.length || 0);
		}

		function checkFlowDisabled(manualFlow: FlowRaw) {
			if (location === 'item' || manualFlow.options?.['requireSelection'] === false) return false;
			return !unref(primaryKey) && selection.value.length === 0;
		}

		return manualFlows;
	});

	function isActiveFlow(flowId: string) {
		const flow = manualFlows.value.find((flow) => flow.id === flowId);

		return flow && flow.status === 'active';
	}

	function resetConfirm() {
		currentFlowId.value = null;
		confirmValues.value = null;
		confirmedUnsavedChanges.value = false;
		confirmedCustomDialog.value = false;
	}

	function confirmUnsavedChanges(flowId: string) {
		confirmedUnsavedChanges.value = true;

		if (!confirmDialogDetails.value) {
			runManualFlow(flowId);
		}
	}

	function confirmCustomDialog(flowId: string) {
		if (isConfirmButtonDisabled.value) return;

		confirmedCustomDialog.value = true;

		runManualFlow(flowId);
	}

	function provideRunManualFlow() {
		provide<RunManualFlowContext>(runManualFlowSymbol, {
			runManualFlow,
			runningFlows,
			isActiveFlow,
		});
	}

	function updateFieldValues(event: Record<string, any>) {
		confirmValues.value = event;
	}

	async function runManualFlow(flowId: string) {
		currentFlowId.value = flowId;
		notice.value = null;

		if (!currentFlowId.value || !currentFlow.value || !currentFlowConfirmations.value) return;

		const {
			isUnsavedChangesConfirmationRequired,
			isUnsavedChangesConfirmed,
			isCustomDialogConfirmationRequired,
			isCustomDialogConfirmed,
		} = currentFlowConfirmations.value;

		if (
			(isUnsavedChangesConfirmationRequired && !isUnsavedChangesConfirmed) ||
			(isCustomDialogConfirmationRequired && !isCustomDialogConfirmed)
		) {
			return;
		}

		if (!primaryKeyField.value) return;

		runningFlows.value = [...runningFlows.value, flowId];

		try {
			// Backoffice: api.post → sdk (contracts/api-calls.md #48).
			if (
				location === 'collection' &&
				currentFlow.value.options?.['requireSelection'] === false &&
				selection.value.length === 0
			) {
				await sdk.request(
					requestEndpoint(`/flows/trigger/${flowId}`, {
						method: 'POST',
						body: { ...(confirmValues.value ?? {}), collection: collection.value },
					}),
				);
			} else {
				const pk = unref(primaryKey);
				const keys = pk ? [pk] : selection.value || [];

				await sdk.request(
					requestEndpoint(`/flows/trigger/${flowId}`, {
						method: 'POST',
						body: { ...confirmValues.value, collection: collection.value, keys },
					}),
				);
			}

			selection.value = [];
			onRefreshCallback();

			notice.value = { type: 'success', text: t('trigger_flow_success', { flow: currentFlow.value.name }) };

			await notificationStore.refreshUnreadCount();
		} catch (error) {
			// eslint-disable-next-line no-console
			console.warn(error);
			notice.value = { type: 'danger', text: translateAPIError(error as APIError) };
		} finally {
			resetConfirm();
			runningFlows.value = runningFlows.value.filter((runningFlow) => runningFlow !== flowId);
		}
	}

	return {
		flowDialogsContext,
		manualFlows,
		provideRunManualFlow,
		runManualFlow,
		runningFlows,
		isActiveFlow,
	};
}

/**
 * In order to invoke useInjectRunManualFlow within a component, a parent component must first invoke `provideRunManualFlow()`.
 *
 * This parent component must also render the <flow-dialogs> component or the confirmation dialogs will not be reachable.
 *
 * Backoffice: with `fallback` and no provider, the component gets its own useFlows (location `item`) and must render
 * FlowDialogs with the returned `flowDialogsContext` (null when a parent provided the flows).
 */
export function useInjectRunManualFlow(fallback?: Omit<UseFlowsOptions, 'location'>) {
	const injected = inject<RunManualFlowContext | null>(runManualFlowSymbol, null);

	if (injected) return { ...injected, flowDialogsContext: null };

	if (fallback) {
		const { runManualFlow, runningFlows, isActiveFlow, flowDialogsContext } = useFlows({
			...fallback,
			location: 'item',
		});

		return { runManualFlow, runningFlows, isActiveFlow, flowDialogsContext };
	}

	return {
		runManualFlow: (_flowId: string) => {},
		runningFlows: ref<string[]>([]),
		isActiveFlow: (_flowId: string): boolean | undefined => false,
		flowDialogsContext: null,
	};
}
