// Ported from directus/packages/memory/src/utils/with-namespace.test.ts
import { expect, test } from 'vitest';
import { withNamespace } from './with-namespace.js';

test('Prepends given key with given namespace', () => {
	expect(withNamespace('key', 'namespace')).toBe('namespace:key');
});
