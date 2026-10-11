// Backoffice: directus/api/src/emitter.ts has no test; these cases cover every method (T039).
import { beforeEach, describe, expect, test, vi } from 'vitest';
import getDatabase from './database/index.js';
import { Emitter, useEmitter } from './emitter.js';
import emitterDefault from './emitter.js';
import { useLogger } from './logger/index.js';

vi.mock('./database/index.js', () => ({ default: vi.fn(() => 'knex') }));
vi.mock('./logger/index.js');

const logger = { warn: vi.fn() };
let emitter: Emitter;

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(useLogger).mockReturnValue(logger as any);
	emitter = new Emitter();
});

describe('emitFilter', () => {
	test('runs the listeners of every event in order, each on the previous result; undefined keeps the payload', async () => {
		const calls: string[] = [];
		emitter.onFilter<number[]>('items.create', async (payload) => (calls.push('a'), [...payload, 1]));
		// A listener returning undefined keeps the payload (Directus' FilterHandler type does not say so).
		emitter.onFilter<number[]>('items.create', () => (calls.push('b'), undefined) as unknown as number[]);
		emitter.onFilter<number[]>(
			'articles.items.create',
			(payload, meta) => (calls.push(meta['event']), [...payload, 2]),
		);

		const result = await emitter.emitFilter(['items.create', 'articles.items.create'], [0], { collection: 'articles' });

		expect(result).toEqual([0, 1, 2]);
		expect(calls).toEqual(['a', 'b', 'articles.items.create']);
	});

	test('default context: the database, no accountability, no schema; a given context is passed as is', async () => {
		const handler = vi.fn();
		emitter.onFilter('items.read', handler);

		await emitter.emitFilter('items.read', 1, { a: 1 });
		expect(handler).toHaveBeenCalledWith(
			1,
			{ event: 'items.read', a: 1 },
			{ database: 'knex', accountability: null, schema: null },
		);
		expect(getDatabase).toHaveBeenCalled();

		const context = { database: 'other', accountability: null, schema: null } as any;
		await emitter.emitFilter('items.read', 1, {}, context);
		expect(handler).toHaveBeenLastCalledWith(1, { event: 'items.read' }, context);
	});

	test('wildcard listeners (items.*)', async () => {
		emitter.onFilter<string>('items.*', (payload) => `${payload}!`);
		await expect(emitter.emitFilter('items.update', 'x', {})).resolves.toBe('x!');
	});

	test('an event without listeners returns the payload', async () => {
		const payload = { a: 1 };
		await expect(emitter.emitFilter('nothing', payload, {})).resolves.toBe(payload);
	});
});

describe('emitAction', () => {
	test('does not wait for the listeners; a thrown error is logged on two warn lines', async () => {
		const error = new Error('boom');
		let resolved = false;

		emitter.onAction('items.create', async () => {
			await new Promise((r) => setTimeout(r, 10));
			resolved = true;
		});

		// A rejected listener (eventemitter2 rethrows a synchronous throw out of emitAsync, in Directus too).
		emitter.onAction('users.create', async () => {
			throw error;
		});

		expect(emitter.emitAction(['items.create', 'users.create'], { key: 1 })).toBeUndefined();
		expect(resolved).toBe(false);

		await vi.waitFor(() => expect(resolved).toBe(true));
		expect(logger.warn).toHaveBeenCalledWith('An error was thrown while executing action "users.create"');
		expect(logger.warn).toHaveBeenCalledWith(error);
	});

	test('meta gets the event name, the default context is used', async () => {
		const handler = vi.fn();
		emitter.onAction('items.delete', handler);
		emitter.emitAction('items.delete', { keys: [1] });
		await vi.waitFor(() => expect(handler).toHaveBeenCalled());
		expect(handler).toHaveBeenCalledWith(
			{ event: 'items.delete', keys: [1] },
			{ database: 'knex', accountability: null, schema: null },
		);
	});
});

describe('emitInit', () => {
	test('waits for the listeners; a thrown error is logged, not thrown', async () => {
		const handler = vi.fn();
		emitter.onInit('app.before', handler);
		await emitter.emitInit('app.before', { app: 1 });
		expect(handler).toHaveBeenCalledWith({ event: 'app.before', app: 1 });

		const error = new Error('init');

		emitter.onInit('app.after', () => {
			throw error;
		});

		await expect(emitter.emitInit('app.after', {})).resolves.toBeUndefined();
		expect(logger.warn).toHaveBeenCalledWith('An error was thrown while executing init "app.after"');
		expect(logger.warn).toHaveBeenCalledWith(error);
	});
});

test('off* removes one listener, offAll removes every listener', async () => {
	const filter = vi.fn();
	const action = vi.fn();
	const init = vi.fn();

	emitter.onFilter('a', filter);
	emitter.onAction('a', action);
	emitter.onInit('a', init);
	emitter.offFilter('a', filter);
	emitter.offAction('a', action);
	emitter.offInit('a', init);

	await emitter.emitFilter('a', 1, {});
	emitter.emitAction('a', {});
	await emitter.emitInit('a', {});
	expect([filter, action, init].map((f) => f.mock.calls.length)).toEqual([0, 0, 0]);

	emitter.onFilter('b', filter);
	emitter.onAction('b', action);
	emitter.onInit('b', init);
	emitter.offAll();

	await emitter.emitFilter('b', 1, {});
	emitter.emitAction('b', {});
	await emitter.emitInit('b', {});
	expect([filter, action, init].map((f) => f.mock.calls.length)).toEqual([0, 0, 0]);
});

test('useEmitter and the default export are the shared instance', () => {
	expect(useEmitter()).toBe(emitterDefault);
	expect(emitterDefault).toBeInstanceOf(Emitter);
});
