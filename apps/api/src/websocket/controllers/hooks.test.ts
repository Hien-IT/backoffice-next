// Backoffice: directus/api/src/websocket/controllers/hooks.ts has no test; these cases cover each mapping (T040).
import { systemCollectionNames } from '@backoffice/system-data';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const publish = vi.fn();
vi.mock('../../bus/index.js', () => ({ useBus: () => ({ publish }) }));
vi.mock('../../database/index.js', () => ({ default: vi.fn() }));

let emitter: typeof import('../../emitter.js').default;

beforeEach(async () => {
	vi.resetModules();
	publish.mockClear();
	emitter = (await import('../../emitter.js')).default;
	const { registerWebSocketEvents } = await import('./hooks.js');
	registerWebSocketEvents();
});

async function emit(event: string, meta: Record<string, any>) {
	emitter.emitAction(event, meta);
	// emitAction does not wait for the listeners.
	await new Promise((resolve) => setImmediate(resolve));
	return publish.mock.calls.map(([channel, message]) => [channel, message]);
}

describe('items and system collections', () => {
	test('items.create, items.update, items.delete; payload {} or [] by default', async () => {
		expect(await emit('items.create', { key: 1, collection: 'a', payload: { t: 1 } })).toEqual([
			['websocket.event', { collection: 'a', action: 'create', key: 1, payload: { t: 1 } }],
		]);

		publish.mockClear();
		expect(await emit('items.update', { keys: [1], collection: 'a' })).toEqual([
			['websocket.event', { collection: 'a', action: 'update', keys: [1], payload: {} }],
		]);

		publish.mockClear();
		expect(await emit('items.delete', { keys: [1], collection: 'a' })).toEqual([
			['websocket.event', { collection: 'a', action: 'delete', keys: [1], payload: [] }],
		]);
	});

	test('users.update (a system collection) carries the payload as given (R-07: password included)', async () => {
		const payload = { first_name: 'x', password: 'plain' };
		expect(await emit('users.update', { keys: ['u'], collection: 'directus_users', payload })).toEqual([
			['websocket.event', { collection: 'directus_users', action: 'update', keys: ['u'], payload }],
		]);
	});

	test.each(['sessions', 'migrations'])('%s is not registered', async (module) => {
		expect(systemCollectionNames).toContain(`directus_${module}`);
		expect(await emit(`${module}.create`, { key: 1, collection: `directus_${module}` })).toEqual([]);
	});
});

describe('hooks of their own', () => {
	test('fields.*: collection directus_fields', async () => {
		expect(await emit('fields.create', { key: 'f', collection: 'a', payload: { field: 'f' } })).toEqual([
			['websocket.event', { collection: 'directus_fields', action: 'create', key: 'f', payload: { field: 'f' } }],
		]);
	});

	test('files.upload doubles as create', async () => {
		expect(await emit('files.upload', { key: 'id', collection: 'directus_files' })).toEqual([
			['websocket.event', { collection: 'directus_files', action: 'create', key: 'id', payload: {} }],
		]);
	});

	test('relations.create adds the key to the payload; relations.delete: keys are the fields', async () => {
		expect(await emit('relations.create', { key: 'r', payload: { field: 'f' } })).toEqual([
			[
				'websocket.event',
				{ collection: 'directus_relations', action: 'create', key: 'r', payload: { field: 'f', key: 'r' } },
			],
		]);

		publish.mockClear();
		expect(await emit('relations.delete', { collection: 'a', payload: ['f'] })).toEqual([
			[
				'websocket.event',
				{
					collection: 'directus_relations',
					action: 'delete',
					keys: ['f'],
					payload: { collection: 'a', fields: ['f'] },
				},
			],
		]);
	});

	test('items.sort is an update of the item', async () => {
		expect(await emit('items.sort', { collection: 'a', item: 3 })).toEqual([
			['websocket.event', { collection: 'a', action: 'update', keys: [3], payload: {} }],
		]);
	});
});

test('registered once (actionsRegistered)', async () => {
	const { registerWebSocketEvents } = await import('./hooks.js');
	registerWebSocketEvents();
	expect(await emit('items.create', { key: 1, collection: 'a' })).toHaveLength(1);
});
