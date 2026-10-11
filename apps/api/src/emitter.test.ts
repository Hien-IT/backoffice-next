import { describe, expect, test } from 'vitest';
import emitter, { useEmitter } from './emitter.js';

describe('emitter stand-in (D-29)', () => {
	test('filters return the payload unchanged', async () => {
		const payload = { a: 1 };
		await expect(emitter.emitFilter(['items.create', 'users.create'], payload, { collection: 'x' })).resolves.toBe(payload);
	});

	test('actions and init do nothing and never throw', async () => {
		expect(emitter.emitAction('users.update', { keys: [1] })).toBeUndefined();
		await expect(emitter.emitInit('app.before', {})).resolves.toBeUndefined();
	});

	test('useEmitter returns the shared instance', () => {
		expect(useEmitter()).toBe(emitter);
	});
});
