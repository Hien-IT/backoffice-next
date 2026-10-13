// Backoffice: the static list of built-in operations (feature 009, research R2)
import { expect, test } from 'vitest';
import { operations } from './index.js';

test('every operation has an id and a handler, ids are unique and sorted like the Directus folders', () => {
	const ids = operations.map((operation) => operation.id);

	for (const operation of operations) expect(typeof operation.handler).toBe('function');

	expect(new Set(ids).size).toBe(ids.length);
	expect(ids).toEqual([...ids].sort());
});
