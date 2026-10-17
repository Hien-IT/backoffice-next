// Spec 017 SC-006 (T041; FR-027 to FR-031, data-model §6): the staging of the flow page and the bodies of Save, in the
// shape the Directus app sends (apps/web-e2e/src/payload/baselines/flows-*.json, T003): the tree under the trigger in
// `operation` as nested objects, `create` / `update` only for trees without a parent, `flow` on every node, only the
// changed fields of an existing node, no key for a missing child and `null` for a removed link, `PATCH /operations`
// only when a target that has a parent of the same type is linked again. Flow f1: trigger -> A (condition) which resolves
// to B (log) and rejects to C (throw-error).
import type { FlowRaw } from '@directus/types';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { replaceQueue } from '../../../../api/sdk.ts';
import { useFlowsStore } from '../../../../stores/flows.ts';
import { calls, mockApi } from '../../../../test-utils/fetch.ts';
import { Vector2 } from '../../../../utils/vector2.ts';
import { ATTACHMENT_OFFSET, GRID_SIZE } from './constants.ts';
import { useFlowEditor } from './use-flow-editor.ts';

const op = (id: string, type: string, x: number, y: number, links: { resolve?: string; reject?: string } = {}) => ({
	id,
	flow: 'f1',
	name: id,
	key: id.toLowerCase(),
	type,
	position_x: x,
	position_y: y,
	options: {},
	resolve: links.resolve ?? null,
	reject: links.reject ?? null,
	date_created: '2026-10-17T00:00:00.000Z',
	user_created: 'u1',
});

const FLOW = () =>
	({
		id: 'f1',
		name: 'Flow',
		status: 'active',
		trigger: 'manual',
		options: { collections: ['bo_content'] },
		operation: 'A',
		operations: [
			op('A', 'condition', 19, 1, { resolve: 'B', reject: 'C' }),
			op('B', 'log', 37, 1),
			op('C', 'throw-error', 37, 17),
		],
	}) as unknown as FlowRaw;

let fetch: ReturnType<typeof mockApi>;
const router = { push: vi.fn(), replace: vi.fn() };

beforeEach(async () => {
	setActivePinia(createPinia());
	fetch = mockApi({ 'PATCH /flows/f1': { id: 'f1' }, 'PATCH /operations': [], 'POST /operations': { id: 'X' } });
	await replaceQueue();
	useFlowsStore().flows = [FLOW()];
	router.push.mockClear();
	router.replace.mockClear();
});

afterEach(() => vi.unstubAllGlobals());

function editor(operationId?: string) {
	return useFlowEditor({
		primaryKey: ref('f1'),
		operationId: ref(operationId),
		router: router as never,
		operationName: (type) =>
			({ condition: 'Condition', log: 'Log to Console', 'throw-error': 'Throw Error' })[type ?? ''],
		triggerLabel: () => 'Trigger',
	});
}

const bodies = (method: string, path: string) =>
	fetch.mock.calls
		.filter(([input, init]) => init?.method === method && new URL(String(input)).pathname === path)
		.map(([, init]) => JSON.parse(String(init!.body)));

/** Adds an operation the way the page does: "+" on a handle, then Done in the operation drawer. */
function add(
	e: ReturnType<typeof editor>,
	parent: string,
	type: 'resolve' | 'reject',
	operation: Record<string, unknown>,
) {
	e.createPanel(parent, type);
	e.stageOperationEdits({ edits: operation, id: '+' });
}

/** Drops the arrow of `from`'s `type` handle on the input of `to`. */
function link(e: ReturnType<typeof editor>, from: string, type: 'resolve' | 'reject', to: string) {
	const target = e.panels.value.find((panel) => panel['id'] === to)!;
	const pos = new Vector2(
		(target['x'] - 1) * GRID_SIZE + ATTACHMENT_OFFSET.x,
		(target['y'] - 1) * GRID_SIZE + ATTACHMENT_OFFSET.y,
	);
	e.arrowMove({ id: from, type, pos });
	e.arrowStop();
}

const TRANSFORM = { name: 'Transform', key: 'transform', type: 'transform', options: { json: {} } };

describe('use-flow-editor', () => {
	test('panels: the trigger at 1/1 resolving to the first operation, the parents, edit mode off with operations', () => {
		const e = editor();
		expect(e.editMode.value).toBe(false);
		expect(e.panels.value.find((p) => p['id'] === '$trigger')).toMatchObject({
			x: 1,
			y: 1,
			resolve: 'A',
			draggable: false,
		});
		expect(e.panels.value.find((p) => p['id'] === 'B')).toMatchObject({
			x: 37,
			y: 1,
			width: 14,
			panel_name: 'Log to Console',
		});
		expect(e.parentPanels.value).toEqual({
			A: { id: '$trigger', type: 'resolve', loner: false },
			B: { id: 'A', type: 'resolve', loner: false },
			C: { id: 'A', type: 'reject', loner: false },
		});
		expect(editor('+').editMode.value).toBe(true);
	});

	test('1. a resolve child of B: placed at x+18, nested under `operation`, create/update empty', async () => {
		const e = editor();
		add(e, 'B', 'resolve', TRANSFORM);
		expect(router.push).toHaveBeenCalledWith({
			name: 'settings-flows-operation',
			params: { primaryKey: 'f1', operationId: '+' },
		});
		const created = e.stagedPanels.value.find((p) => p.id!.startsWith('_'))!;
		expect(created).toMatchObject({ position_x: 55, position_y: 1, flow: 'f1' });

		await e.saveChanges();
		expect(bodies('PATCH', '/operations')).toEqual([]);
		expect(bodies('PATCH', '/flows/f1')).toEqual([
			{
				operations: { create: [], update: [], delete: [] },
				operation: {
					id: 'A',
					flow: 'f1',
					reject: { id: 'C', flow: 'f1' },
					resolve: {
						id: 'B',
						flow: 'f1',
						resolve: { flow: 'f1', position_x: 55, position_y: 1, ...TRANSFORM },
					},
				},
			},
		]);
		expect(e.editMode.value).toBe(false);
		expect(e.stagedPanels.value).toEqual([]);
	});

	test('2. a reject child of B: placed at x+18, y+16', () => {
		const e = editor();
		add(e, 'B', 'reject', TRANSFORM);
		expect(e.stagedPanels.value.find((p) => p.id!.startsWith('_'))).toMatchObject({ position_x: 55, position_y: 17 });
		expect(e.stagedPanels.value.find((p) => p.id === 'B')!['reject']).toMatch(/^_/);
	});

	test('3. the reject of A dropped on B (child of A by resolve): the resolve link is removed, C becomes a loner', async () => {
		const e = editor();
		link(e, 'A', 'reject', 'B');
		expect(e.parentPanels.value['C']).toBeUndefined();

		await e.saveChanges();
		expect(bodies('PATCH', '/operations')).toEqual([]);
		expect(bodies('PATCH', '/flows/f1')).toEqual([
			{
				operations: { create: [], update: [{ id: 'C', flow: 'f1' }], delete: [] },
				operation: { id: 'A', flow: 'f1', resolve: null, reject: { id: 'B', flow: 'f1' } },
			},
		]);
	});

	test('4. A -> B relinked as A -> X -> B through a new panel: PATCH /operations resets A.resolve first', async () => {
		const e = editor();
		e.stageOperationEdits({ edits: TRANSFORM, id: '+' });
		const x = e.stagedPanels.value[0]!.id!;
		link(e, x, 'resolve', 'B');
		link(e, 'A', 'resolve', x);

		await e.saveChanges();
		expect(bodies('PATCH', '/operations')).toEqual([[{ id: 'A', resolve: null }]]);
		expect(bodies('PATCH', '/flows/f1')[0].operation).toEqual({
			id: 'A',
			flow: 'f1',
			reject: { id: 'C', flow: 'f1' },
			resolve: { flow: 'f1', position_x: 15, position_y: 15, ...TRANSFORM, resolve: { id: 'B', flow: 'f1' } },
		});
		expect(calls(fetch).indexOf('PATCH /operations')).toBeLessThan(calls(fetch).indexOf('PATCH /flows/f1'));
	});

	test('5. deleting the first operation: operation null, its children are updated loners (R-43)', async () => {
		const e = editor();
		e.deletePanel('A');

		await e.saveChanges();
		expect(bodies('PATCH', '/flows/f1')).toEqual([
			{
				operation: null,
				operations: {
					create: [],
					update: [
						{ id: 'B', flow: 'f1' },
						{ id: 'C', flow: 'f1' },
					],
					delete: ['A'],
				},
			},
		]);
	});

	test('6. deleting C: the reject of A becomes null', async () => {
		const e = editor();
		e.deletePanel('C');

		await e.saveChanges();
		expect(bodies('PATCH', '/flows/f1')).toEqual([
			{
				operations: { create: [], update: [], delete: ['C'] },
				operation: { id: 'A', flow: 'f1', reject: null, resolve: { id: 'B', flow: 'f1' } },
			},
		]);
	});

	test('7. duplicate B: the whole panel without id and links, +2/+2, key <key>_<5 a-z>, created as a loner', async () => {
		const e = editor();
		e.duplicatePanel(e.panels.value.find((p) => p['id'] === 'B')!);

		await e.saveChanges();
		const [create] = bodies('PATCH', '/flows/f1')[0].operations.create;
		expect(create).toMatchObject({
			flow: 'f1',
			type: 'log',
			position_x: 39,
			position_y: 3,
			x: 37,
			y: 1,
			width: 14,
			height: 14,
			panel_name: 'Log to Console',
			user_created: 'u1',
		});
		expect(create.key).toMatch(/^b_[a-z]{5}$/);
		expect(create).not.toHaveProperty('id');
		expect(create).not.toHaveProperty('resolve');
	});

	test('8. moving B: only the changed fields of B', async () => {
		const e = editor();
		e.stageOperationEdits({ edits: { position_x: 40, position_y: 4 }, id: 'B' });

		await e.saveChanges();
		expect(bodies('PATCH', '/flows/f1')[0].operation.resolve).toEqual({
			id: 'B',
			flow: 'f1',
			position_x: 40,
			position_y: 4,
		});
	});

	test('9. only the status staged: the status and the unchanged tree; no unsaved-edits guard for it (R-44)', async () => {
		const e = editor();
		e.stagedFlow.value = { status: 'inactive' };
		expect(e.hasEdits.value).toBe(false);
		expect(e.flow.value!.status).toBe('inactive');

		await e.saveChanges();
		expect(bodies('PATCH', '/flows/f1')).toEqual([
			{
				status: 'inactive',
				operations: { create: [], update: [], delete: [] },
				operation: { id: 'A', flow: 'f1', reject: { id: 'C', flow: 'f1' }, resolve: { id: 'B', flow: 'f1' } },
			},
		]);
	});

	test('10. nothing staged: no request, edit mode off', async () => {
		const e = editor('+');
		await e.saveChanges();
		expect(calls(fetch)).toEqual([]);
		expect(e.editMode.value).toBe(false);
	});

	test('11. delete B then add an operation with the same key under A', async () => {
		const e = editor();
		e.deletePanel('B');
		expect(e.existingOperationKeys.value).not.toContain('b');
		add(e, 'A', 'resolve', { ...TRANSFORM, key: 'b' });

		await e.saveChanges();
		const [body] = bodies('PATCH', '/flows/f1');
		expect(body.operations.delete).toEqual(['B']);
		expect(body.operation.resolve).toMatchObject({ key: 'b', position_x: 37, position_y: 1 });
	});

	test('12. cyclic data: no request, the error on the console, still in edit mode (T002, R-48)', async () => {
		useFlowsStore().flows = [
			{
				// As the T002 data: the trigger resolves to A, and A <-> B.
				...FLOW(),
				operation: 'A',
				operations: [op('A', 'log', 19, 1, { resolve: 'B' }), op('B', 'log', 37, 1, { resolve: 'A' })],
			} as unknown as FlowRaw,
		];
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const e = editor();
		e.editMode.value = true;
		e.stageOperationEdits({ edits: { position_x: 40 }, id: 'B' });

		await e.saveChanges();
		expect(calls(fetch)).toEqual([]);
		expect(error).toHaveBeenCalled();
		expect(e.editMode.value).toBe(true);
		error.mockRestore();
	});

	test('a Save error keeps the staging and edit mode; Save again sends the same requests (R-47)', async () => {
		fetch = mockApi({ 'PATCH /flows/f1': () => new Response('{"errors":[{"message":"x"}]}', { status: 500 }) });
		await replaceQueue();
		const e = editor();
		e.editMode.value = true;
		e.deletePanel('C');

		await e.saveChanges();
		expect(e.stagedPanels.value).not.toEqual([]);
		expect(e.editMode.value).toBe(true);
		await e.saveChanges();
		expect(bodies('PATCH', '/flows/f1')).toHaveLength(2);
		expect(bodies('PATCH', '/flows/f1')[1]).toEqual(bodies('PATCH', '/flows/f1')[0]);
	});

	test('arrows: dropping a link that makes a loop is refused; dropping in empty space detaches', () => {
		const e = editor();
		link(e, 'B', 'resolve', 'A');
		expect(e.stagedPanels.value).toEqual([]);

		e.arrowMove({ id: 'A', type: 'reject', pos: new Vector2(2000, 2000) });
		e.arrowStop();
		expect(e.stagedPanels.value).toEqual([{ id: 'A', flow: 'f1', reject: null }]);
	});

	test('the Trigger handle dropped on C: flow.operation = C, the previous parent of C loses it', () => {
		const e = editor();
		link(e, '$trigger', 'resolve', 'C');
		expect(e.stagedFlow.value.operation).toBe('C');
		expect(e.stagedPanels.value).toEqual([{ id: 'A', flow: 'f1', reject: null }]);
	});

	test('Copy To: POST /operations with the panel minus id, dates and links, flow = target', async () => {
		useFlowsStore().flows = [FLOW(), { ...FLOW(), id: 'f2', operations: [] } as unknown as FlowRaw];
		const e = editor();
		e.copyPanelId.value = 'B';
		e.copyPanelTo.value = 'f2';

		await e.copyPanel();
		const [body] = bodies('POST', '/operations');
		expect(body).toMatchObject({
			flow: 'f2',
			key: 'b',
			type: 'log',
			x: 37,
			y: 1,
			width: 14,
			height: 14,
			panel_name: 'Log to Console',
		});
		for (const key of ['id', 'date_created', 'user_created', 'resolve', 'reject']) expect(body).not.toHaveProperty(key);
		expect(e.copyPanelId.value).toBeUndefined();
	});

	test('delete flow: DELETE then the overview, also after an error', async () => {
		fetch = mockApi({ 'DELETE /flows/f1': () => new Response('{"errors":[{"message":"x"}]}', { status: 500 }) });
		await replaceQueue();
		const e = editor();
		await e.deleteFlow();
		expect(calls(fetch)).toContain('DELETE /flows/f1');
		expect(router.push).toHaveBeenCalledWith({ name: 'settings-flows-collection' });
	});
});
