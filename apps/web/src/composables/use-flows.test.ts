// Ported from directus/app/src/composables/use-flows.test.ts
// Backoffice: useFlows lives in use-run-manual-flow.ts (013, which has its own tests for the dialogs and the default
// injection). Real i18n, translate, useCollection and sdk on the fixture API (collection bo_content, contracts
// api-calls #95) instead of the Directus mocks; getManualFlowsForCollection is spied on the real flows store like the
// mocked store; `primaryKey: undefined` is `ref(null)` (exactOptionalPropertyTypes). `api.post` failures are a 500
// answer; the result is the notice instead of notify/unexpectedError.
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { i18n } from '../lang/index.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useFlowsStore } from '../stores/flows.ts';
import { calls, json, mockFixtureApi } from '../test-utils/fetch.ts';
import { loadSnapshot } from '../test-utils/fixtures.ts';
import { useFlows } from './use-run-manual-flow.ts';

let fetch: ReturnType<typeof mockFixtureApi>;

const failing = () =>
	json({ errors: [{ message: 'flow failed', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] }, 500);

async function setup(answers = {}) {
	vi.unstubAllGlobals();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(loadSnapshot(), { answers });
	await useFieldsStore().hydrate();
	fetch.mockClear();
}

beforeEach(() => setup());

afterEach(() => {
	vi.clearAllMocks();
});

function mockStore(flows: unknown[]) {
	return vi.spyOn(useFlowsStore(), 'getManualFlowsForCollection').mockReturnValue(flows as never);
}

/** useFlows needs a component instance for useI18n. */
function withSetup(options: Parameters<typeof useFlows>[0]) {
	let result: ReturnType<typeof useFlows>;
	mount(defineComponent({ setup: () => ((result = useFlows(options)), () => h('div')) }), {
		global: { plugins: [i18n] },
	});
	return result!;
}

function posted() {
	return fetch.mock.calls
		.filter(([, init]) => init?.method === 'POST')
		.map(([url, init]) => [new URL(String(url)).pathname, JSON.parse(String(init!.body))]);
}

const mockOnRefresh = vi.fn();

const useFlowsOptions = {
	collection: ref('bo_content'),
	primaryKey: ref<string | null>('item_1'),
	location: 'collection' as const,
	hasEdits: ref(true),
	onRefreshCallback: mockOnRefresh,
};

const mockFlows = [
	{
		id: 'flow-1',
		name: 'Test Flow 1',
		trigger: 'manual',
		status: 'active',
		options: {
			collections: ['bo_content'],
			location: 'collection',
			requireConfirmation: true,
			confirmationDescription: 'test-description-1',
			fields: [{ name: 'field-1', meta: { required: true } }],
		},
	},
	{
		id: 'flow-2',
		name: 'Test Flow 2',
		trigger: 'manual',
		status: 'active',
		options: {
			collections: ['bo_content'],
			location: 'item',
			requireConfirmation: false,
			requireSelection: false,
		},
	},
	{
		id: 'flow-3',
		name: 'Test Flow 3',
		trigger: 'event',
		status: 'active',
		options: {
			collections: ['bo_content'],
			location: 'item',
			requireConfirmation: true,
			confirmationDescription: 'test-description-3',
			requireSelection: false,
		},
	},
	{
		id: 'flow-4',
		name: 'Test Flow 4',
		trigger: 'event',
		status: 'active',
		options: {
			collections: ['bo_content'],
			location: 'collection',
			requireConfirmation: false,
			fields: [{ name: 'field-1', meta: { required: false } }],
		},
	},
	{
		id: 'flow-5',
		name: 'Test',
		trigger: 'manual',
		status: 'active',
		options: {
			collections: ['bo_content'],
			location: 'collection',
			requireSelection: false,
		},
	},
];

describe('manualFlows', () => {
	test('returns empty array when no manual flows', () => {
		const spy = mockStore([]);

		const { manualFlows } = withSetup(useFlowsOptions);

		expect(manualFlows.value.length).toEqual(0);
		expect(spy).toHaveBeenCalledWith('bo_content');
	});

	test('returns manual flows when some are found', () => {
		const spy = mockStore(mockFlows);

		const { manualFlows } = withSetup(useFlowsOptions);

		expect(manualFlows.value.length).toEqual(3);
		expect(spy).toHaveBeenCalledWith('bo_content');
	});

	test('returns collection specific flows when changing collection', async () => {
		const mockGetManualFlows = mockStore(mockFlows);
		const testCollection = ref('bo_content');

		const { manualFlows } = withSetup({ ...useFlowsOptions, collection: testCollection });

		expect(manualFlows.value.length).toEqual(3);
		expect(mockGetManualFlows).toHaveBeenLastCalledWith('bo_content');

		mockGetManualFlows.mockReturnValue([]);

		testCollection.value = 'bo_content_2';

		await nextTick();

		expect(manualFlows.value.length).toEqual(0);
		expect(mockGetManualFlows).toHaveBeenLastCalledWith('bo_content_2');
		expect(mockGetManualFlows).toHaveBeenCalledTimes(2);
	});

	// Backoffice: the tooltips of FR-089 (no Directus test).
	test('tooltips by location and selection', () => {
		mockStore([mockFlows[0], mockFlows[4]]);
		const selection = ref<unknown[]>([]);

		const { manualFlows } = withSetup({ ...useFlowsOptions, primaryKey: ref(null), selection: selection as never });
		expect(manualFlows.value.map((flow) => flow.tooltip)).toEqual([
			'Select One or More Items First',
			'Run Flow on Current Collection',
		]);

		selection.value = [1, 2];
		expect(manualFlows.value.map((flow) => flow.tooltip)).toEqual([
			'Run Flow on 2 Selected Items',
			'Run Flow on 2 Selected Items',
		]);

		mockStore([mockFlows[1]]);
		const item = withSetup({ ...useFlowsOptions, location: 'item' });
		expect(item.manualFlows.value[0]!.tooltip).toBe('Run Flow on Current Item');
	});
});

describe('manualFlow.isFlowDisabled', () => {
	describe('false', () => {
		test('location is "item"', () => {
			mockStore([mockFlows[0]]);

			const { manualFlows } = withSetup({ ...useFlowsOptions, location: 'item' });

			manualFlows.value.forEach((manualFlow) => {
				expect(manualFlow.isFlowDisabled).toEqual(false);
			});
		});

		test('manualFlow.options.requireSelection is false', () => {
			mockStore([mockFlows[0]]);

			const { manualFlows } = withSetup(useFlowsOptions);

			manualFlows.value.forEach((manualFlow) => {
				expect(manualFlow.isFlowDisabled).toEqual(false);
			});
		});

		test('location is "collection" but has primaryKey', () => {
			mockStore([{ ...mockFlows[0], options: {} }]);

			const { manualFlows } = withSetup(useFlowsOptions);

			manualFlows.value.forEach((manualFlow) => {
				expect(manualFlow.isFlowDisabled).toEqual(false);
			});
		});
	});

	describe('true', () => {
		test('location is "collection", no primaryKey, no selection, requireSelection not false', () => {
			mockStore([{ ...mockFlows[0], options: { requireSelection: true } }]);

			const { manualFlows } = withSetup({ ...useFlowsOptions, primaryKey: ref(null) });

			// Backoffice: Directus asserts in forEach; check the list is not empty so the test cannot pass vacuously.
			expect(manualFlows.value).toHaveLength(1);

			manualFlows.value.forEach((manualFlow) => {
				expect(manualFlow.isFlowDisabled).toEqual(true);
			});
		});
	});
});

describe('runManualFlow', () => {
	test('returns early when selectedFlow is not found', async () => {
		mockStore(mockFlows);

		const { runManualFlow } = withSetup(useFlowsOptions);

		await runManualFlow('non-existent-flow');

		expect(fetch).not.toHaveBeenCalled();
	});

	test('returns early when flow is not in manualFlows (filtered out)', async () => {
		mockStore([mockFlows[1]]);

		const { runManualFlow } = withSetup(useFlowsOptions);

		await runManualFlow(mockFlows[1]!.id);

		expect(fetch).not.toHaveBeenCalled();
	});

	test('successfully runs flow for collection with requireSelection false', async () => {
		mockStore([mockFlows[4]]);

		const { runManualFlow, flowDialogsContext } = withSetup(useFlowsOptions);

		const { currentFlowId, confirmUnsavedChanges } = flowDialogsContext.value;

		confirmUnsavedChanges(mockFlows[4]!.id);

		await runManualFlow(mockFlows[4]!.id);

		// Backoffice: toContainEqual like toHaveBeenCalledWith: confirmUnsavedChanges already ran the flow once.
		expect(posted()).toContainEqual([`/flows/trigger/${mockFlows[4]!.id}`, { collection: 'bo_content' }]);

		expect(currentFlowId).toBeNull();
	});

	test('successfully runs flow with keys (primaryKey or selection)', async () => {
		mockStore(mockFlows);

		const { runManualFlow, flowDialogsContext } = withSetup({ ...useFlowsOptions, hasEdits: ref(false) });

		const { currentFlowId } = flowDialogsContext.value;

		await runManualFlow(mockFlows[4]!.id);

		expect(posted()).toEqual([[`/flows/trigger/${mockFlows[4]!.id}`, { collection: 'bo_content' }]]);

		expect(currentFlowId).toBeNull();
	});

	test('uses selection when no primaryKey is available', async () => {
		mockStore(mockFlows);

		const { runManualFlow } = withSetup({
			...useFlowsOptions,
			primaryKey: ref(null),
			selection: ref([{ id: 'item1' }, { id: 'item2' }]),
			hasEdits: ref(false),
		});

		await runManualFlow(mockFlows[4]!.id);

		expect(posted()).toEqual([
			[`/flows/trigger/${mockFlows[4]!.id}`, { collection: 'bo_content', keys: [{ id: 'item1' }, { id: 'item2' }] }],
		]);
	});

	test('calls onRefreshCallback', async () => {
		mockStore(mockFlows);

		const { runManualFlow } = withSetup({ ...useFlowsOptions, hasEdits: ref(false) });

		await runManualFlow(mockFlows[3]!.id);

		expect(mockOnRefresh).toHaveBeenCalledOnce();
		// Backoffice: flow-4 needs a selection: the body has the keys of the primary key (research T003 d).
		expect(posted()).toEqual([[`/flows/trigger/flow-4`, { collection: 'bo_content', keys: ['item_1'] }]]);
	});

	test('clears selection after successfully running flow', async () => {
		mockStore(mockFlows);

		const selection = ref([{ id: 'item1' }, { id: 'item2' }]);

		const { runManualFlow, flowDialogsContext } = withSetup({
			...useFlowsOptions,
			primaryKey: ref(null),
			selection,
			hasEdits: ref(false),
		});

		await runManualFlow(mockFlows[4]!.id);

		expect(selection.value).toEqual([]);
		expect(flowDialogsContext.value.notice).toEqual({ type: 'success', text: 'Flow "Test" triggered successfully' });
	});

	test('does not clear selection if flow API call fails', async () => {
		await setup({ 'POST /flows/trigger/flow-5': failing });
		mockStore(mockFlows);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const selection = ref([{ id: 'item1' }, { id: 'item2' }]);

		const { runManualFlow, flowDialogsContext } = withSetup({
			...useFlowsOptions,
			primaryKey: ref(null),
			selection,
			hasEdits: ref(false),
		});

		await runManualFlow(mockFlows[4]!.id);

		expect(selection.value).toEqual([{ id: 'item1' }, { id: 'item2' }]);
		expect(flowDialogsContext.value.notice?.type).toBe('danger');
		expect(mockOnRefresh).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	test('resets confirm state after flow API error, showing dialog again on next trigger', async () => {
		await setup({ 'POST /flows/trigger/flow-confirm': failing });
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const flowWithConfirm = {
			id: 'flow-confirm',
			name: 'Flow Confirm',
			trigger: 'manual',
			status: 'active',
			options: {
				collections: ['bo_content'],
				location: 'collection',
				requireConfirmation: true,
				confirmationDescription: 'Are you sure?',
				fields: [],
			},
		};

		mockStore([flowWithConfirm]);

		const { runManualFlow, flowDialogsContext } = withSetup({ ...useFlowsOptions, hasEdits: ref(false) });

		await runManualFlow(flowWithConfirm.id);
		expect(flowDialogsContext.value.displayCustomConfirmDialog).toBe(true);

		flowDialogsContext.value.confirmCustomDialog(flowWithConfirm.id);
		// Backoffice: the sdk request queue may hold the request up to 500ms (Directus: one nextTick on a mocked api).
		await vi.waitFor(() => expect(flowDialogsContext.value.currentFlowId).toBeNull(), 2000);

		await runManualFlow(flowWithConfirm.id);
		expect(flowDialogsContext.value.displayCustomConfirmDialog).toBe(true);
		expect(calls(fetch)).toEqual(['POST /flows/trigger/flow-confirm']);
		warn.mockRestore();
	});

	test('calls runFlow with reactive primaryKey', async () => {
		mockStore(mockFlows);

		const testOptions = {
			...useFlowsOptions,
			primaryKey: ref('item_1'),
			hasEdits: ref(false),
			location: 'item' as const,
		};

		const { runManualFlow } = withSetup(testOptions);

		await runManualFlow(mockFlows[1]!.id);

		expect(posted().at(-1)).toEqual([
			`/flows/trigger/${mockFlows[1]!.id}`,
			{ collection: 'bo_content', keys: ['item_1'] },
		]);

		testOptions.primaryKey.value = 'item_2';

		await runManualFlow(mockFlows[1]!.id);

		expect(posted().at(-1)).toEqual([
			`/flows/trigger/${mockFlows[1]!.id}`,
			{ collection: 'bo_content', keys: ['item_2'] },
		]);
	});
});
