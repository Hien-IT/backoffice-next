// Backoffice (spec 024, D-188): the bo_show_* toggles of directus_collections read once per schema cache and checked
// on a sanitized query (research R1, R2).
import { SchemaBuilder } from '@backoffice/schema-builder';
import knex from 'knex';
import { createTracker, MockClient, type Tracker } from 'knex-mock-client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getCache } from '../cache.js';
import getDatabase from '../database/index.js';
import { assertCollectionToggles, assertToggle, getCollectionToggles, hasSearchOff } from './collection-toggles.js';

vi.mock('../cache.js');
vi.mock('../database/index.js');

class Client_PG extends MockClient {}

const message = (collection: string, path = 'root') =>
	`You don't have permission to access collection "${collection}" or it does not exist. Queried in ${path}.`;

let tracker: Tracker;
let store: Map<string, unknown>;

function rows(...values: Record<string, unknown>[]) {
	tracker.on.select('directus_collections').response(values);
}

beforeEach(() => {
	const db = knex.default({ client: Client_PG });
	tracker = createTracker(db);
	vi.mocked(getDatabase).mockReturnValue(db as any);
	store = new Map();

	vi.mocked(getCache).mockReturnValue({
		localSchemaCache: {
			get: async (key: string) => store.get(key),
			set: async (key: string, value: unknown) => void store.set(key, value),
		},
	} as any);
});

afterEach(() => {
	tracker.reset();
	vi.clearAllMocks();
});

describe('getCollectionToggles', () => {
	test('one select of the three columns, then the cached map', async () => {
		rows({ collection: 'a', bo_show_search: false, bo_show_import: true, bo_show_export: null });

		expect(await getCollectionToggles()).toEqual({ a: { search: false } });
		expect(await getCollectionToggles()).toEqual({ a: { search: false } });

		expect(tracker.history.select).toHaveLength(1);
		expect(tracker.history.select[0]!.sql).toBe(
			'select "collection", "bo_show_search", "bo_show_import", "bo_show_export" from "directus_collections"',
		);
	});

	test('false and 0 are off; null, true and 1 are shown (FR-008)', async () => {
		rows(
			{ collection: 'a', bo_show_search: 0, bo_show_import: 1, bo_show_export: false },
			{ collection: 'b', bo_show_search: null, bo_show_import: true, bo_show_export: 1 },
		);

		expect(await getCollectionToggles()).toEqual({ a: { search: false, export: false } });
	});

	test('missing columns (the select fails): every toggle shown, not cached (FR-008)', async () => {
		tracker.on.select('directus_collections').simulateError('no such column: bo_show_search');

		expect(await getCollectionToggles()).toEqual({});
		expect(store.size).toBe(0);
	});

	test('a cleared schema cache reads the table again (FR-013)', async () => {
		rows({ collection: 'a', bo_show_search: false, bo_show_import: null, bo_show_export: null });
		await getCollectionToggles();
		store.clear();
		await getCollectionToggles();

		expect(tracker.history.select).toHaveLength(2);
	});

	test('hasSearchOff', async () => {
		rows({ collection: 'a', bo_show_search: null, bo_show_import: false, bo_show_export: null });
		expect(await hasSearchOff()).toBe(false);

		store.clear();
		tracker.reset();
		rows({ collection: 'a', bo_show_search: false, bo_show_import: null, bo_show_export: null });
		expect(await hasSearchOff()).toBe(true);
	});
});

describe('assertToggle', () => {
	beforeEach(() => rows({ collection: 'a', bo_show_search: false, bo_show_import: false, bo_show_export: null }));

	test('the collection permission error of DR when off (FR-006)', async () => {
		await expect(assertToggle('a', 'import')).rejects.toMatchObject({ code: 'FORBIDDEN', message: message('a') });
		await expect(assertToggle('a', 'search', 'rel')).rejects.toMatchObject({ message: message('a', '"rel"') });
	});

	test('passes when shown, for another collection and for system collections (FR-010)', async () => {
		await expect(assertToggle('a', 'export')).resolves.toBeUndefined();
		await expect(assertToggle('b', 'import')).resolves.toBeUndefined();
		await expect(assertToggle('directus_users', 'search')).resolves.toBeUndefined();
	});
});

describe('assertCollectionToggles', () => {
	const schema = new SchemaBuilder()
		.collection('a', (c) => {
			c.field('id').id();
			c.field('title').string();
		})
		.collection('b', (c) => {
			c.field('id').id();
			c.field('owner').m2o('a');
			c.field('children').o2m('a', 'parent');
			c.field('items').m2a(['a']);
		})
		.build();

	beforeEach(() => rows({ collection: 'a', bo_show_search: false, bo_show_import: null, bo_show_export: false }));

	test('search and export of the collection (FR-002, FR-004)', async () => {
		await expect(assertCollectionToggles('a', { search: 'x' }, schema)).rejects.toMatchObject({
			message: message('a'),
		});
		await expect(assertCollectionToggles('a', { search: '  ' }, schema)).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(assertCollectionToggles('a', { export: 'csv' }, schema)).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(assertCollectionToggles('a', { filter: { title: { _eq: 'x' } } }, schema)).resolves.toBeUndefined();
		await expect(assertCollectionToggles('b', { search: 'x', export: 'csv' }, schema)).resolves.toBeUndefined();
	});

	test('_search of deep checks the collection of that level (FR-017)', async () => {
		const o2m = { deep: { children: { _search: 'x' } } };
		const m2o = { deep: { owner: { _search: 'x' } } };
		const m2a = { deep: { items: { 'item:a': { _search: 'x' } } } };

		await expect(assertCollectionToggles('b', o2m, schema)).rejects.toMatchObject({
			message: message('a', '"children"'),
		});
		await expect(assertCollectionToggles('b', m2o, schema)).rejects.toMatchObject({ message: message('a', '"owner"') });
		await expect(assertCollectionToggles('b', m2a, schema)).rejects.toMatchObject({
			message: message('a', '"items.item:a"'),
		});
	});

	test('deep keys can be aliases: query.alias at the root, _alias below (GraphQL, REST alias)', async () => {
		const root = { alias: { kids: 'children' }, deep: { kids: { _search: 'x' } } };
		const nested = { deep: { items: { _alias: { picked: 'item' }, 'picked:a': { _search: 'x' } } } };

		await expect(assertCollectionToggles('b', root, schema)).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(assertCollectionToggles('b', nested, schema)).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	test('passes without _search, on a field without relation and when nothing is off', async () => {
		await expect(assertCollectionToggles('b', { deep: { children: { _limit: 1 } } }, schema)).resolves.toBeUndefined();
		await expect(assertCollectionToggles('b', { deep: { owner: { _search: '' } } }, schema)).resolves.toBeUndefined();
		await expect(assertCollectionToggles('b', { deep: { title: { _search: 'x' } } }, schema)).resolves.toBeUndefined();

		store.clear();
		tracker.reset();
		rows();
		await expect(assertCollectionToggles('a', { search: 'x', export: 'csv' }, schema)).resolves.toBeUndefined();
	});
});
