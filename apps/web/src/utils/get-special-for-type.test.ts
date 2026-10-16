// Directus has no test for get-special-for-type.ts: the special a field without meta gets when opened (FR-026).
import { expect, test } from 'vitest';
import { getSpecialForType } from './get-special-for-type.ts';

test.each([
	['json', ['cast-json']],
	['csv', ['cast-csv']],
	['boolean', ['cast-boolean']],
	['uuid', ['uuid']],
	['hash', ['hash']],
	['geometry', ['geometry']],
	['string', null],
	['integer', null],
] as const)('%s', (type, special) => {
	expect(getSpecialForType(type)).toEqual(special);
});
