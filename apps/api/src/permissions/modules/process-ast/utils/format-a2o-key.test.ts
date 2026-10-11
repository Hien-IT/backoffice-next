// Ported from directus/api/src/permissions/modules/process-ast/utils/format-a2o-key.test.ts
import { expect, test } from 'vitest';
import { formatA2oKey } from './format-a2o-key.js';

test('Joins strings with `:` character', () => {
	expect(formatA2oKey('item', 'headings')).toBe('item:headings');
});
