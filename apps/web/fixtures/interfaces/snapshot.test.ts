// T026 (contracts/tests.md §2): the fixture snapshot covers every interface and display id of Directus 11.17.4, and
// every hand-written expected value names its Directus source (FR-100, CHK051).
import { describe, expect, test } from 'vitest';
import { loadSnapshot } from '../../src/test-utils/fixtures.ts';
import registry from './directus-registry.json';

const snapshot = loadSnapshot();
const interfaceIds = Object.keys(registry.interfaces);
const displayIds = Object.keys(registry.displays);

// Ids this database cannot hold, with the reason. Empty on Postgres with PostGIS (the parity database); an id only
// goes here when seed.mjs prints "Refused: ..." for every field that uses it.
const UNSEEDABLE: Record<string, string> = {};

describe('every registry id has a fixture field', () => {
	test.each(interfaceIds.filter((id) => !(id in UNSEEDABLE)))('interface %s', (id) => {
		expect(snapshot.fields.some((f) => f.meta?.interface === id)).toBe(true);
	});

	test.each(displayIds)('display %s', (id) => {
		expect(snapshot.fields.some((f) => f.meta?.display === id)).toBe(true);
	});

	test('the registry has the 41 interfaces and 18 displays of Directus 11.17.4', () => {
		expect(registry.directusVersion).toBe(snapshot.meta.version);
		expect([interfaceIds.length, displayIds.length]).toEqual([41, 18]);
		expect(Object.keys(UNSEEDABLE).filter((id) => !interfaceIds.includes(id))).toEqual([]);
	});

	test('geometry fields exist when the export saw native geometry', () => {
		const geometry = snapshot.fields.filter((f) => f.type.startsWith('geometry')).map((f) => f.type);
		expect(geometry.length > 0).toBe(snapshot.meta.geometry);
	});
});

test('every expected value names its source', () => {
	for (const [id, scenarios] of Object.entries(snapshot.expected)) {
		expect(interfaceIds, `expected.${id}.json`).toContain(id);

		for (const [scenario, entry] of Object.entries(scenarios)) {
			expect(entry, `expected.${id}.json ${scenario}`).toHaveProperty('value');
			expect(typeof entry.source === 'string' && entry.source.trim() !== '', `expected.${id}.json ${scenario}`).toBe(
				true,
			);
		}
	}
});
