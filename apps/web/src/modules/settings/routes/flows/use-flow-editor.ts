// Ported from directus/app/src/modules/settings/routes/flows/flow.vue (script: staged flow and panels, links, arrows,
// duplicate, copy to, delete, save).
// Backoffice (spec 017 FR-020 to FR-031, research R4): the logic of the flow page as a composable, so the staging and the
// bodies of Save can be tested without the canvas (SC-006). Navigation goes through the `router` given by the page,
// `api` through the SDK, `unexpectedError` is showUnexpectedError (D-66). One change of result-equivalent behaviour:
// `getTrees` stops at an id it already went through, logs the error and saves nothing (DR throws a RangeError on
// cyclic data before its `try`, with the same visible result; T002).
import type { FlowRaw, OperationRaw } from '@directus/types';
import { cloneDeep, isEmpty, merge, omit } from 'lodash-es';
import { customAlphabet, nanoid } from 'nanoid/non-secure';
import { computed, type Ref, ref } from 'vue';
import type { Router } from 'vue-router';
import { requestEndpoint, sdk } from '../../../../api/sdk.ts';
import { showUnexpectedError } from '../../../../composables/use-notices.ts';
import { useFlowsStore } from '../../../../stores/flows.ts';
import { Vector2 } from '../../../../utils/vector2.ts';
import { ATTACHMENT_OFFSET, GRID_SIZE, PANEL_HEIGHT, PANEL_WIDTH } from './constants.ts';
import type { ArrowInfo, ParentInfo, Target } from './types.ts';

// Backoffice: optional fields may hold undefined (exactOptionalPropertyTypes), as the staged edits of DR do.
export type StagedPanel = { [K in keyof OperationRaw]?: OperationRaw[K] | undefined } & Record<string, any>;

type Tree = {
	id: string;
	reject?: Tree;
	resolve?: Tree;
};

export interface FlowEditorOptions {
	primaryKey: Ref<string>;
	operationId: Ref<string | undefined>;
	router: Pick<Router, 'push' | 'replace'>;
	/** The translated name of an operation type (the panel header), undefined for an unknown type. */
	operationName: (type: string | undefined) => string | undefined;
	/** The translated "Trigger" label. */
	triggerLabel: () => string;
}

export function useFlowEditor({ primaryKey, operationId, router, operationName, triggerLabel }: FlowEditorOptions) {
	// ------------- Manage Current Flow ------------- //

	const flowsStore = useFlowsStore();
	const stagedFlow = ref<Partial<FlowRaw>>({});

	const flow = computed<FlowRaw | undefined>({
		get() {
			const existing = flowsStore.flows.find((flow) => flow.id === primaryKey.value);

			if (!existing) return undefined;

			return merge({}, existing, {
				status: stagedFlow.value?.status ?? existing.status,
				operation: stagedFlow.value?.operation ?? existing.operation,
				operations: stagedFlow.value?.operations ?? existing.operations,
			});
		},
		set(newFlow) {
			stagedFlow.value = newFlow ?? {};
		},
	});

	const editMode = ref((flow.value?.operations ?? []).length === 0 || operationId.value !== undefined);

	const saving = ref(false);
	const deleting = ref(false);

	async function deleteFlow() {
		if (!flow.value?.id || deleting.value) return;

		deleting.value = true;

		try {
			await sdk.request(requestEndpoint(`/flows/${flow.value.id}`, { method: 'DELETE' }));
			await flowsStore.hydrate();
		} catch (error) {
			showUnexpectedError(error);
		} finally {
			deleting.value = false;
			router.push({ name: 'settings-flows-collection' });
		}
	}

	// ------------- Manage Panels ------------- //

	const stagedPanels = ref<StagedPanel[]>([]);
	const panelsToBeDeleted = ref<string[]>([]);
	const hoveredPanelID = ref<string | null>(null);

	const savedPanels = computed(() =>
		(flow.value?.operations || []).filter((panel) => panelsToBeDeleted.value.includes(panel.id) === false),
	);

	const resolveReferences = computed(() => {
		const references = new Map<string, string>();

		for (const savedPanel of flow.value?.operations ?? []) {
			if (savedPanel.resolve && savedPanel.id) {
				references.set(savedPanel.resolve, savedPanel.id);
			}
		}

		return references;
	});

	const rejectReferences = computed(() => {
		const references = new Map<string, string>();

		for (const savedPanel of flow.value?.operations ?? []) {
			if (savedPanel.reject && savedPanel.id) {
				references.set(savedPanel.reject, savedPanel.id);
			}
		}

		return references;
	});

	const panels = computed(() => {
		const raw = [
			...savedPanels.value.map((panel) => {
				const updates = stagedPanels.value.find((updatedPanel) => updatedPanel.id === panel.id);

				if (updates) {
					return Object.assign({}, panel, updates);
				}

				return panel;
			}),
			...stagedPanels.value.filter((panel) => panel.id?.startsWith('_')),
		];

		const panels: Record<string, any>[] = raw.map((panel) => ({
			...panel,
			width: PANEL_WIDTH,
			height: PANEL_HEIGHT,
			x: panel.position_x,
			y: panel.position_y,
			panel_name: operationName(panel.type),
		}));

		const trigger: Record<string, any> = {
			id: '$trigger',
			panel_name: triggerLabel(),
			icon: 'offline_bolt',
			x: 1,
			y: 1,
			width: PANEL_WIDTH,
			height: PANEL_HEIGHT,
			showHeader: true,
			draggable: false,
			flow: primaryKey.value,
			type: flow.value?.trigger,
			options: flow.value?.options,
		};

		if (flow.value?.operation) trigger['resolve'] = flow.value.operation;

		panels.push(trigger);

		return panels;
	});

	const currentOperation = computed(() => {
		return panels.value.find((panel) => {
			return panel['id'] === operationId.value;
		});
	});

	const existingOperationKeys = computed(() => [
		...(flow.value?.operations || [])
			.filter((operation) => !panelsToBeDeleted.value.includes(operation.id))
			.map((operation) => operation.key),
		...stagedPanels.value.filter((stagedPanel) => stagedPanel.key !== undefined).map((stagedPanel) => stagedPanel.key!),
	]);

	const parentPanels = computed(() => {
		const parents = panels.value.reduce<Record<string, ParentInfo>>((acc, panel) => {
			if (panel['resolve']) {
				acc[panel['resolve']] = {
					id: panel['id'],
					type: 'resolve',
					loner: true,
				};
			}

			if (panel['reject']) {
				acc[panel['reject']] = {
					id: panel['id'],
					type: 'reject',
					loner: true,
				};
			}

			return acc;
		}, {});

		return Object.fromEntries(
			Object.entries(parents).map(([key, value]) => {
				return [key, { ...value, loner: !connectedToTrigger(key) }];
			}),
		) as Record<string, ParentInfo>;

		function connectedToTrigger(id: string) {
			let parent = parents[id];
			// Backoffice: a cycle in the data (never made by the canvas) would loop forever here (R-48).
			const seen = new Set<string>();

			while (parent?.id !== '$trigger') {
				if (parent === undefined || seen.has(parent.id)) return false;
				seen.add(parent.id);
				parent = parents[parent.id];
			}

			return true;
		}
	});

	let parentId: string | undefined = undefined;
	let attachType: Target | undefined = undefined;

	function stageOperationEdits(event: { edits: StagedPanel; id?: string | undefined }) {
		const key = event.id ?? operationId.value;

		if (key === '+') {
			const attach: Record<string, any> = {};
			const tempId = `_${nanoid()}`;

			if (parentId !== undefined && attachType !== undefined) {
				const parent = panels.value.find((panel) => panel['id'] === parentId);

				if (parent) {
					if (parentId === '$trigger') {
						stagedFlow.value = { ...stagedFlow.value, operation: tempId };
					} else {
						stageOperationEdits({ edits: { [attachType]: tempId }, id: parentId });
					}

					if (attachType === 'resolve') {
						attach['position_x'] = parent['x'] + PANEL_WIDTH + 4;
						attach['position_y'] = parent['y'];
					} else {
						attach['position_x'] = parent['x'] + PANEL_WIDTH + 4;
						attach['position_y'] = parent['y'] + PANEL_HEIGHT + 2;
					}
				}
			}

			stagedPanels.value = [
				...stagedPanels.value,
				{
					id: tempId,
					flow: primaryKey.value,
					position_x: 15,
					position_y: 15,
					...event.edits,
					...attach,
				},
			];
		} else {
			if (stagedPanels.value.some((panel) => panel.id === key)) {
				stagedPanels.value = stagedPanels.value.map((panel) => {
					if (panel.id === key) {
						return Object.assign({ id: key, flow: primaryKey.value }, panel, event.edits);
					}

					return panel;
				});
			} else {
				stagedPanels.value = [...stagedPanels.value, { id: key, flow: primaryKey.value, ...event.edits }];
			}
		}
	}

	function stageOperation(edits: StagedPanel) {
		stageOperationEdits({ edits });
		parentId = undefined;
		attachType = undefined;
		router.replace({ name: 'settings-flows-item', params: { primaryKey: primaryKey.value } });
	}

	function cancelOperation() {
		parentId = undefined;
		attachType = undefined;
		router.replace({ name: 'settings-flows-item', params: { primaryKey: primaryKey.value } });
	}

	/** The two requests of a save; exported for the tests (SC-006). */
	function saveRequests(): { resets: StagedPanel[]; changes: Record<string, any> } | null {
		const trees = getTrees().map(addChangesToTree);

		if (trees.length === 0) return null;

		const changes: Record<string, any> = {
			...stagedFlow.value,
			operations: {
				create: trees.filter((tree) => !('id' in tree)),
				update: trees.filter((tree) => 'id' in tree && tree['id'] !== '$trigger'),
				delete: panelsToBeDeleted.value,
			},
		};

		const trigger = trees.find((tree) => tree['id'] === '$trigger');

		if (trigger && trigger['resolve'] !== undefined) changes['operation'] = trigger['resolve'];

		const operationReferenceResetUpdates: StagedPanel[] = [];

		/**
		 * Prevents the following from occuring:
		 *
		 * Existing A -> B re-linked to A -> C -> B via new panel
		 * not nullifying A -> B link before attempting to link C -> B
		 *
		 * Existing A -> B -> C re-linked to A -> C via delete
		 * not nullifying B -> C link before attempting to link A -> C
		 */
		for (const stagedPanel of stagedPanels.value) {
			if (stagedPanel.resolve && !stagedPanel.resolve.startsWith('_')) {
				const resolve = resolveReferences.value.get(stagedPanel.resolve);

				if (resolve && resolve !== stagedPanel.id) {
					operationReferenceResetUpdates.push({ id: resolve, resolve: null });
				}
			}

			if (stagedPanel.reject && !stagedPanel.reject.startsWith('_')) {
				const reject = rejectReferences.value.get(stagedPanel.reject);

				if (reject && reject !== stagedPanel.id) {
					operationReferenceResetUpdates.push({ id: reject, reject: null });
				}
			}
		}

		return { resets: operationReferenceResetUpdates, changes };
	}

	async function saveChanges() {
		if (!flow.value) return;

		if (stagedPanels.value.length === 0 && panelsToBeDeleted.value.length === 0 && isEmpty(stagedFlow.value)) {
			editMode.value = false;
			return;
		}

		let requests: ReturnType<typeof saveRequests>;

		try {
			requests = saveRequests();
		} catch (error) {
			// Backoffice: DR throws here (outside its try): nothing is sent, no dialog, the page stays in edit mode.
			// eslint-disable-next-line no-console
			console.error(error);
			return;
		}

		saving.value = true;

		try {
			if (requests) {
				if (requests.resets.length) {
					await sdk.request(requestEndpoint('/operations', { method: 'PATCH', body: requests.resets }));
				}

				await sdk.request(requestEndpoint(`/flows/${primaryKey.value}`, { method: 'PATCH', body: requests.changes }));
			}

			await flowsStore.hydrate();

			stagedPanels.value = [];
			panelsToBeDeleted.value = [];
			stagedFlow.value = {};
			editMode.value = false;
		} catch (error) {
			showUnexpectedError(error);
		} finally {
			saving.value = false;
		}
	}

	function getTrees() {
		const rejectResolveIds = panels.value.reduce<Set<string>>((acc, panel) => {
			if (panel['resolve']) acc.add(panel['resolve']);
			if (panel['reject']) acc.add(panel['reject']);
			return acc;
		}, new Set());

		const topOperations = panels.value.filter((panel) => !rejectResolveIds.has(panel['id']));
		const trees = topOperations.map((root) => constructTree(root, new Set()));

		return trees;

		function constructTree(root: Record<string, any>, path: Set<string>): Tree {
			if (path.has(root['id'])) throw new RangeError(`The operations of flow ${primaryKey.value} form a cycle`);
			const inPath = new Set(path).add(root['id']);

			const resolve = panels.value.find((panel) => panel['id'] === root['resolve']);
			const reject = panels.value.find((panel) => panel['id'] === root['reject']);

			return {
				id: root['id'],
				...(reject ? { reject: constructTree(reject, inPath) } : {}),
				...(resolve ? { resolve: constructTree(resolve, inPath) } : {}),
			};
		}
	}

	function addChangesToTree(tree: Tree): Record<string, any> {
		const edits = stagedPanels.value.find((panel) => panel.id === tree.id);

		const newTree = edits ? cloneDeep(edits) : ({ id: tree.id } as Record<string, any>);

		if (tree.reject) newTree['reject'] = addChangesToTree(tree.reject);
		if (tree.resolve) newTree['resolve'] = addChangesToTree(tree.resolve);
		if (tree.id.startsWith('_')) delete newTree['id'];
		newTree['flow'] = primaryKey.value;

		return newTree;
	}

	function deletePanel(id: string) {
		if (!flow.value) return;

		stagedPanels.value = stagedPanels.value.filter((panel) => panel.id !== id);

		if (!id.startsWith('_')) {
			panelsToBeDeleted.value.push(id);
		}

		if (flow.value.operation === id) {
			stagedFlow.value = { operation: null };
		} else {
			const parent = parentPanels.value[id];

			if (parent) {
				stageOperationEdits({ edits: { [parent.type]: null }, id: parent.id });
			}
		}
	}

	function createPanel(parent: string, type: Target) {
		parentId = parent;
		attachType = type;
		router.push({ name: 'settings-flows-operation', params: { primaryKey: primaryKey.value, operationId: '+' } });
	}

	function duplicatePanel(panel: StagedPanel) {
		const newPanel = omit(merge({}, panel), 'id', 'resolve', 'reject') as StagedPanel;
		const newKey = customAlphabet('abcdefghijklmnopqrstuvwxyz', 5)();
		newPanel.position_x = newPanel.position_x! + 2;
		newPanel.position_y = newPanel.position_y! + 2;
		newPanel.key = `${newPanel.key}_${newKey}`;
		stageOperationEdits({ edits: newPanel, id: '+' });
	}

	// ------------- Copy Panel To ------------- //

	const copyPanelId = ref<string | undefined>();
	const copyPanelTo = ref<string | undefined>();
	const copyPanelLoading = ref(false);

	const copyPanelChoices = computed(() => flowsStore.flows.filter((flow) => flow.id !== primaryKey.value));

	async function copyPanel() {
		if (copyPanelLoading.value || copyPanelChoices.value.length === 0) return;

		copyPanelLoading.value = true;

		const currentPanel = panels.value.find((panel) => panel['id'] === copyPanelId.value);

		try {
			await sdk.request(
				requestEndpoint('/operations', {
					method: 'POST',
					body: {
						...omit(currentPanel, ['id', 'date_created', 'user_created', 'resolve', 'reject']),
						flow: copyPanelTo.value,
					},
				}),
			);

			await flowsStore.hydrate();

			copyPanelId.value = undefined;
		} catch (error) {
			showUnexpectedError(error);
		} finally {
			copyPanelLoading.value = false;
		}
	}

	// ------------- Drag&Drop Arrows ------------- //

	const arrowInfo = ref<ArrowInfo | undefined>();

	function arrowMove(info: ArrowInfo) {
		arrowInfo.value = info;
	}

	function arrowStop() {
		if (!arrowInfo.value) {
			arrowInfo.value = undefined;
			return;
		}

		const nearPanel = getNearAttachment(arrowInfo.value?.pos);

		if (nearPanel && isLoop(arrowInfo.value.id, nearPanel)) {
			arrowInfo.value = undefined;
			return;
		}

		// make sure only one arrow can be connected to an attachment
		const currentlyConnected = nearPanel && parentPanels.value[nearPanel];

		if (currentlyConnected) {
			if (currentlyConnected.id === '$trigger') {
				flow.value = merge({}, flow.value, { operation: null });
			} else {
				stageOperationEdits({
					edits: {
						[currentlyConnected.type]: null,
					},
					id: currentlyConnected.id,
				});
			}
		}

		if (arrowInfo.value.id === '$trigger') {
			flow.value = merge({}, flow.value, { operation: nearPanel ?? null });
		} else {
			stageOperationEdits({
				edits: {
					[arrowInfo.value.type]: nearPanel ?? null,
				},
				id: arrowInfo.value.id,
			});
		}

		arrowInfo.value = undefined;
	}

	function isLoop(currentId: string, attachTo: string) {
		let parent: string | undefined = currentId;

		while (parent !== undefined) {
			if (parent === attachTo) return true;
			parent = parentPanels.value[parent]?.id;
		}

		return false;
	}

	function getNearAttachment(pos: Vector2) {
		for (const panel of panels.value) {
			const attachmentPos = new Vector2(
				(panel['x'] - 1) * GRID_SIZE + ATTACHMENT_OFFSET.x,
				(panel['y'] - 1) * GRID_SIZE + ATTACHMENT_OFFSET.y,
			);

			if (attachmentPos.distanceTo(pos) <= 40) return panel['id'] as string;
		}

		return undefined;
	}

	// ------------- Navigation Guard ------------- //

	const hasEdits = computed(() => stagedPanels.value.length > 0 || panelsToBeDeleted.value.length > 0);

	function cancelChanges() {
		stagedPanels.value = [];
		stagedFlow.value = {};
		panelsToBeDeleted.value = [];
		editMode.value = false;
	}

	return {
		flow,
		stagedFlow,
		editMode,
		saving,
		deleting,
		deleteFlow,
		stagedPanels,
		panelsToBeDeleted,
		hoveredPanelID,
		panels,
		currentOperation,
		existingOperationKeys,
		parentPanels,
		stageOperationEdits,
		stageOperation,
		cancelOperation,
		saveRequests,
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
	};
}
