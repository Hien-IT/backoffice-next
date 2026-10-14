// Ported from directus/app/src/interfaces/index.test.ts
import { describe, expect, test } from 'vitest';
import { getInterface, getInterfaces, sortInterfaces } from './index.ts';
import type { InterfaceConfig } from './types.ts';

/**
 * Vite v3 reworked the glob import with it's own internal sorting,
 * so this is to ensure any changes to vite's internal sorting to not affect the expected sort outcome.
 *
 *  @see {@link https://github.com/directus/directus/pull/15672#issuecomment-1289975933}
 */

// Backoffice: `system-raw-editor` is the only `_system` interface of 013 (D-57), so it replaces `system-collection`.
const expectedInterfacesSortOrder = [
	'boolean',
	'input',
	'input-autocomplete-api',
	'input-code',
	'input-hash',
	'input-multiline',
	'input-rich-text-html',
	'input-rich-text-md',
	'system-raw-editor',
];

// Backoffice: the interfaces are added by later tasks, so the sort is checked on configs in glob order
// (`./_system/*` first, then `./*` by folder name, as Vite returns them).
const globOrder = [
	'system-raw-editor',
	'boolean',
	'input-autocomplete-api',
	'input-code',
	'input-hash',
	'input-multiline',
	'input-rich-text-html',
	'input-rich-text-md',
	'input',
	'tags',
].map((id) => ({ id }) as InterfaceConfig);

describe('interfaces', () => {
	test('getInterfaces() should return the expected sorted order of interfaces', () => {
		const interfaces = sortInterfaces(globOrder);
		const interfaceIds = interfaces.map((inter) => inter.id);
		const interfacesToTest = interfaceIds.filter((inter) => expectedInterfacesSortOrder.includes(inter));

		// test all expected sort order
		expect(interfacesToTest).toEqual(expectedInterfacesSortOrder);
		// test whether input interface is the first one among all the input related interfaces
		expect(interfacesToTest.filter((inter) => inter.includes('input')).findIndex((inter) => inter === 'input')).toBe(0);
		// system-raw-editor should be not be at the start after sorting. It is within the folder called "_system",
		// so it will be the first item by default without our added sort logic in getInterface().
		expect(interfacesToTest.findIndex((inter) => inter === 'system-raw-editor')).not.toBe(0);
	});

	test('getInterfaces() returns the registered configs sorted by id', () => {
		const ids = getInterfaces().map((inter) => inter.id);
		expect(ids).toEqual([...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
	});

	test('getInterface() finds a config by id and returns undefined otherwise', () => {
		for (const inter of getInterfaces()) expect(getInterface(inter.id)).toBe(inter);
		expect(getInterface('does-not-exist')).toBeUndefined();
		expect(getInterface(null)).toBeUndefined();
	});
});
