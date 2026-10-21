// Ported from directus/packages/extensions/src/shared/utils/define-extension.test.ts (API side helpers only)
import { describe, expect, it } from 'vitest';
import { defineEndpoint, defineHook, defineOperationApi } from './define-extension.js';

describe('define*', () => {
	it('returns the config unchanged', () => {
		const hook = () => undefined;
		const endpoint = { id: 'demo', handler: () => undefined };
		const operation = { id: 'op', handler: () => 'done' };

		expect(defineHook(hook)).toBe(hook);
		expect(defineEndpoint(endpoint)).toBe(endpoint);
		expect(defineOperationApi(operation)).toBe(operation);
	});
});
