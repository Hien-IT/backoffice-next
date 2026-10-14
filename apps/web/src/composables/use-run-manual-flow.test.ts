// Directus has no test for use-flows.ts: the default run-manual-flow of `header`/`presentation-links` (FR-057,
// contracts/api-calls.md #48) on the bo-flow fixture (snapshot flows.json, bo_groups item 1).
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { i18n } from '../lang/index.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useFlowsStore } from '../stores/flows.ts';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../test-utils/fetch.ts';
import { loadSnapshot } from '../test-utils/fixtures.ts';
import { useFlows, useInjectRunManualFlow } from './use-run-manual-flow.ts';

let fetch: ReturnType<typeof mockFixtureApi>;

async function setup(answers = {}, flowOptions: Record<string, unknown> = {}) {
	vi.unstubAllGlobals();
	setActivePinia(createPinia());
	const snapshot = loadSnapshot();
	fetch = mockFixtureApi(snapshot, { answers });
	await useFieldsStore().hydrate();
	useFlowsStore().flows = snapshot.flows.map((flow) => ({ ...flow, options: { ...flow.options, ...flowOptions } }));
	fetch.mockClear();
}

/** Mounts a component calling `use` in setup, optionally under a parent that provided the flows. */
function withSetup<T>(use: () => T, provider = false): T {
	let result: T;
	const Child = defineComponent({ setup: () => ((result = use()), () => null) });

	const Parent = defineComponent({
		setup() {
			if (provider) {
				useFlows({
					collection: ref('bo_groups'),
					primaryKey: ref(1),
					location: 'item',
					onRefreshCallback: () => {},
				}).provideRunManualFlow();
			}

			return () => h(Child);
		},
	});

	mount(Parent, { global: { plugins: [i18n] } });
	return result!;
}

const fallback = (onRefreshCallback = vi.fn()) => ({
	collection: ref('bo_groups'),
	primaryKey: ref<string | number | null>(1),
	onRefreshCallback,
});

// The request queue (sdk.ts) may hold a request up to 500ms.
const settled = (running: { value: string[] }) => vi.waitFor(() => expect(running.value).toEqual([]), 2000);

beforeEach(() => setup());

describe('useInjectRunManualFlow', () => {
	test('without a provider nor a fallback: the Directus no-op', () => {
		const flows = withSetup(() => useInjectRunManualFlow());

		expect(flows.isActiveFlow('bo-6')).toBe(false);
		expect(flows.flowDialogsContext).toBeNull();
		flows.runManualFlow('bo-6');
		expect(fetch).not.toHaveBeenCalled();
	});

	test('a provider wins over the fallback: no own dialogs', () => {
		const flows = withSetup(() => useInjectRunManualFlow(fallback()), true);

		expect(flows.flowDialogsContext).toBeNull();
		expect(flows.isActiveFlow('bo-6')).toBe(true);
	});

	test('fallback: isActiveFlow only for active manual flows of the collection and location', async () => {
		let flows = withSetup(() => useInjectRunManualFlow(fallback()));
		expect(flows.isActiveFlow('bo-6')).toBe(true);
		expect(flows.isActiveFlow('unknown')).toBeFalsy();

		await setup({}, { location: 'collection' });
		flows = withSetup(() => useInjectRunManualFlow(fallback()));
		expect(flows.isActiveFlow('bo-6')).toBeFalsy();

		await setup();
		useFlowsStore().flows[0]!.status = 'inactive';
		flows = withSetup(() => useInjectRunManualFlow(fallback()));
		expect(flows.isActiveFlow('bo-6')).toBeFalsy();
	});
});

describe('useFlows (default run)', () => {
	test('requireConfirmation: dialog first, required field, then POST with the values, ran and success', async () => {
		const ran = vi.fn();
		const flows = withSetup(() => useInjectRunManualFlow(fallback(ran)));
		const context = () => flows.flowDialogsContext!.value;

		flows.runManualFlow('bo-6');
		expect(context().displayCustomConfirmDialog).toBe(true);
		expect(context().confirmDialogDetails).toEqual({
			description: 'Run the fixture flow?',
			fields: [
				{ field: 'note', type: 'string', name: 'Note', meta: { interface: 'input', width: 'full', required: true } },
			],
		});
		expect(context().confirmButtonCTA).toBe('Run Flow on Current Item');
		expect(context().isConfirmButtonDisabled).toBe(true);
		expect(fetch).not.toHaveBeenCalled();

		context().confirmCustomDialog('bo-6');
		expect(fetch).not.toHaveBeenCalled();

		context().updateFieldValues({ note: 'Hello' });
		expect(context().isConfirmButtonDisabled).toBe(false);
		context().confirmCustomDialog('bo-6');
		expect(flows.runningFlows.value).toEqual(['bo-6']);
		await settled(flows.runningFlows);

		const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!;
		expect(calls(fetch)[0]).toBe('POST /flows/trigger/bo-6');
		expect(JSON.parse(String(post[1]!.body))).toEqual({ note: 'Hello', collection: 'bo_groups', keys: [1] });
		assertOnlyKnownRequests(calls(fetch));
		expect(ran).toHaveBeenCalledOnce();
		expect(context().notice).toEqual({ type: 'success', text: 'Flow "bo-flow" triggered successfully' });
		expect(context().displayCustomConfirmDialog).toBe(false);
		expect(flows.runningFlows.value).toEqual([]);
	});

	test('a field without name gets the formatted field key', async () => {
		await setup({}, { fields: [{ field: 'my_note', type: 'string', meta: { interface: 'input' } }] });
		const flows = withSetup(() => useInjectRunManualFlow(fallback()));

		flows.runManualFlow('bo-6');
		expect(flows.flowDialogsContext!.value.confirmDialogDetails!.fields[0].name).toBe('My Note');
	});

	test('resetConfirm (cancel) closes the dialog without a request', () => {
		const flows = withSetup(() => useInjectRunManualFlow(fallback()));

		flows.runManualFlow('bo-6');
		flows.flowDialogsContext!.value.resetConfirm();
		expect(flows.flowDialogsContext!.value.displayCustomConfirmDialog).toBe(false);
		expect(fetch).not.toHaveBeenCalled();
	});

	test('no confirmation: runs at once with { collection, keys }', async () => {
		await setup({}, { requireConfirmation: false });
		const flows = withSetup(() => useInjectRunManualFlow(fallback()));

		flows.runManualFlow('bo-6');
		await settled(flows.runningFlows);

		const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!;
		expect(JSON.parse(String(post[1]!.body))).toEqual({ collection: 'bo_groups', keys: [1] });
	});

	test('an API error shows the translated error, ran is not called', async () => {
		const forbidden = () => json({ errors: [{ message: 'Forbidden', extensions: { code: 'FORBIDDEN' } }] }, 403);
		await setup({ 'POST /flows/trigger/bo-6': forbidden }, { requireConfirmation: false });
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const ran = vi.fn();
		const flows = withSetup(() => useInjectRunManualFlow(fallback(ran)));

		flows.runManualFlow('bo-6');
		await settled(flows.runningFlows);

		expect(ran).not.toHaveBeenCalled();
		expect(flows.flowDialogsContext!.value.notice).toEqual({
			type: 'danger',
			text: i18n.global.t('errors.FORBIDDEN'),
		});
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	test('hasEdits asks about unsaved changes first', async () => {
		await setup({}, { requireConfirmation: false });
		const run = withSetup(() => useFlows({ ...fallback(), location: 'item', hasEdits: ref(true) }));

		run.runManualFlow('bo-6');
		expect(run.flowDialogsContext.value.displayUnsavedChangesDialog).toBe(true);
		expect(run.flowDialogsContext.value.confirmButtonCTA).toBe('Run Flow Anyway');

		run.flowDialogsContext.value.confirmUnsavedChanges('bo-6');
		await settled(run.runningFlows);
		expect(calls(fetch)[0]).toBe('POST /flows/trigger/bo-6');
	});
});
