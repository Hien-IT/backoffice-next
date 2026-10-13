// Ported from directus/packages/extensions/src/shared/utils/define-extension.test.ts (defineOperationApi case)
import { expect, test } from 'vitest';
import { defineOperationApi } from './define-operation-api.js';

test('defineOperationApi returns the config unchanged', () => {
	const operationApiConfig = { id: 'test', handler: () => undefined };

	expect(defineOperationApi(operationApiConfig)).toBe(operationApiConfig);
});
