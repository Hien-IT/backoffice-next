// Backoffice: Directus has no test for construct-flow-tree.ts (feature 009, research R6)
import type { FlowRaw, OperationRaw } from '@backoffice/types';
import { expect, test } from 'vitest';
import { constructFlowTree } from './construct-flow-tree.js';

const op = (id: string, resolve: string | null = null, reject: string | null = null): OperationRaw => ({
	id,
	name: id,
	key: `key_${id}`,
	type: 'log',
	position_x: 1,
	position_y: 1,
	options: { message: id },
	resolve,
	reject,
	flow: 'flow',
	date_created: '2026-10-14T00:00:00.000Z',
	user_created: 'user',
});

const flow = (operation: string | null, operations: OperationRaw[], options: FlowRaw['options'] = {}): FlowRaw => ({
	id: 'flow',
	name: 'Flow',
	icon: null,
	color: null,
	description: null,
	status: 'active',
	trigger: 'webhook',
	options,
	operation,
	operations,
	date_created: '2026-10-14T00:00:00.000Z',
	user_created: 'user',
	accountability: 'all',
});

test('nests resolve and reject operations and drops `operations` and `flow`', () => {
	const tree = constructFlowTree(flow('a', [op('c'), op('a', 'b', 'c'), op('b')]));

	expect(tree).not.toHaveProperty('operations');
	expect(tree.operation?.id).toBe('a');
	expect(tree.operation).not.toHaveProperty('flow');
	expect(tree.operation?.resolve?.id).toBe('b');
	expect(tree.operation?.resolve?.resolve).toBeNull();
	expect(tree.operation?.reject?.id).toBe('c');
});

test('a flow without a root operation has a null tree; null options become an empty object', () => {
	const tree = constructFlowTree(flow(null, [op('a')], null));

	expect(tree.operation).toBeNull();
	expect(tree.options).toEqual({});
});

test('throws on a reference to an operation that is not in the flow', () => {
	expect(() => constructFlowTree(flow('a', [op('a', 'missing')]))).toThrow('Undefined reference in operations');
	expect(() => constructFlowTree(flow('a', [op('a', null, 'missing')]))).toThrow('Undefined reference in operations');
});
