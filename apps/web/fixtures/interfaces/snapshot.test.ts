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

test('the Content module set of feature 014 is complete (data-model §9)', () => {
	const snapshot = loadSnapshot();
	const collection = (name: string) => snapshot.collections.find((c) => c['collection'] === name);

	expect(collection('bo_folder')?.['schema']).toBeNull();
	expect(collection('bo_content')?.['meta']).toMatchObject({
		group: 'bo_folder',
		versioning: true,
		archive_field: 'status',
		archive_value: 'archived',
		display_template: '{{ title }}',
		sort_field: 'sort',
	});
	expect(collection('bo_singleton')?.['meta']).toMatchObject({ singleton: true });
	expect(snapshot.items['bo_content']).toHaveLength(30);
	expect(snapshot.items['bo_singleton']).toHaveLength(1);

	expect(snapshot.presets.filter((p) => p['bookmark'] === null)).toHaveLength(3);
	expect(snapshot.presets.filter((p) => p['bookmark'] !== null).map((p) => p['bookmark']).sort()).toEqual([
		'bo-bookmark',
		'bo-global-bookmark',
	]);
	expect(snapshot.versions.map((v) => v['key'])).toEqual(['draft', 'local-1']);
	expect(snapshot.shares).toHaveLength(1);
	expect(snapshot.comments).toHaveLength(2);
	const revisions = snapshot.revisions['bo_content']!;
	expect(revisions.filter((r) => r['version'] === null).map((r) => r['activity']['action'])).toEqual([
		'create',
		'update',
		'update',
	]);
	// One revision per version save (the draft and local-1).
	expect(revisions.filter((r) => r['version'] !== null)).toHaveLength(2);
	expect(snapshot.flows.map((f) => f.name).sort()).toEqual(['bo-flow', 'bo-flow-content', 'bo-flow-item']);
	expect(snapshot.contentExpected['presetFirstWrite']?.body).toMatchObject({ layout: null, collection: 'bo_std' });
});
