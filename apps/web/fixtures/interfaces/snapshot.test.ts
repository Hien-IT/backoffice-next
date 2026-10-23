// T026 (contracts/tests.md §2): the fixture snapshot covers every interface and display id of DR 11.17.4, and
// every hand-written expected value names its DR source (FR-100, CHK051).
import { describe, expect, test } from 'vitest';
import { loadSnapshot } from '../../src/test-utils/fixtures.ts';
import registry from './directus-registry.json';

const snapshot = loadSnapshot();
const interfaceIds = Object.keys(registry.interfaces);
const displayIds = Object.keys(registry.displays);

// Ids this database cannot hold, with the reason. Empty on Postgres with PostGIS (the parity database); an id only
// goes here when seed.mjs prints "Refused: ..." for every field that uses it.
const UNSEEDABLE: Record<string, string> = {
	// Feature 014: system interfaces of the app screens (search filter, bookmark name), never set on a user field.
	'system-filter': 'system interface of the Content module search (014), tested in its own folder',
	'system-input-translated-string': 'system interface of the bookmark dialog (014), tested in its own folder',
	// Feature 015 (FR-086): system interfaces of the directus_users system fields, tested in their own folders.
	'system-language': 'directus_users.language (015), tested in its own folder',
	'system-input-password': 'registry only in 015 (CHK050), tested in its own folder',
	'system-mfa-setup': 'directus_users.tfa_secret (015), tested in its own folder',
	'system-token': 'directus_users.token (015), tested in its own folder',
	'system-theme': 'directus_users.theme_light / theme_dark (015), tested in its own folder',
	'system-theme-overrides': 'directus_users.theme_*_overrides (015), tested in its own folder',
	// Feature 016 (D-57): system interfaces of the Settings forms (directus_collections), tested in their own folders.
	'system-collection': 'Settings forms and the field duplicate dialog (016), tested in its own folder',
	'system-field': 'directus_collections.archive_field / sort_field (016), tested in its own folder',
	'system-field-tree': 'directus_collections.item_duplication_fields (016), tested in its own folder',
	'system-display-template': 'directus_collections.display_template (016), tested in its own folder',
	'system-collections-translations': 'directus_collections.translations_enable_helper (016), tested in its own folder',
	'system-interface': 'field drawer and list options (016), tested in its own folder',
	'system-interface-options': 'field drawer and list options (016), tested in its own folder',
	'system-display': 'field drawer and list options (016), tested in its own folder',
	'system-display-options': 'field drawer and list options (016), tested in its own folder',
	'system-fields': 'Settings forms (016), tested in its own folder',
	'system-inline-fields': 'Settings forms (016), tested in its own folder',
	'system-collections': 'Settings forms (016), tested in its own folder',
	'system-manual-flow-select': 'Settings forms (016), tested in its own folder',
	'system-permissions': 'Policy page matrix (016), tested in its own folder',
	'system-owner': 'Project settings (016), tested in its own folder',
	'system-modules': 'Project settings (016), tested in its own folder',
	'system-folder': 'Project settings (016), tested in its own folder',
	'system-scope': 'Preset editor (016), tested in its own folder',
};

describe('every registry id has a fixture field', () => {
	test.each(interfaceIds.filter((id) => !(id in UNSEEDABLE)))('interface %s', (id) => {
		expect(snapshot.fields.some((f) => f.meta?.interface === id)).toBe(true);
	});

	test.each(displayIds)('display %s', (id) => {
		expect(snapshot.fields.some((f) => f.meta?.display === id)).toBe(true);
	});

	test('the registry has the 67 interfaces (41 of 013, 2 system ones of 014, 6 of 015, 18 of 016) and 18 displays of Directus 11.17.4', () => {
		expect(registry.directusVersion).toBe(snapshot.meta.version);
		expect([interfaceIds.length, displayIds.length]).toEqual([67, 18]);
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
	expect(
		snapshot.presets
			.filter((p) => p['bookmark'] !== null)
			.map((p) => p['bookmark'])
			.sort(),
	).toEqual(['bo-bookmark', 'bo-global-bookmark']);
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
