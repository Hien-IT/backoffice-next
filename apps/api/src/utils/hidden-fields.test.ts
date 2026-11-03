// Backoffice (spec 005, D-209): the hidden fields of user collections read once per schema cache.
import knex from 'knex';
import { createTracker, MockClient, type Tracker } from 'knex-mock-client';
import { beforeEach, expect, test, vi } from 'vitest';
import { getCache } from '../cache.js';
import getDatabase from '../database/index.js';
import { getHiddenFields } from './hidden-fields.js';

vi.mock('../cache.js');
vi.mock('../database/index.js');

class Client_PG extends MockClient {}

let tracker: Tracker;
let store: Map<string, unknown>;

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

test('hidden fields of user collections, true or 1, cached; system collections and shown fields left out', async () => {
	tracker.on.select('directus_fields').response([
		{ collection: 'articles', field: 'secret', hidden: true },
		{ collection: 'articles', field: 'note', hidden: 1 },
		{ collection: 'articles', field: 'title', hidden: false },
		{ collection: 'articles', field: 'body', hidden: null },
		{ collection: 'directus_users', field: 'tfa_secret', hidden: true },
	]);
	tracker.on.select('directus_collections').response([{ collection: 'articles', archive_field: null, sort_field: null }]);

	expect(await getHiddenFields()).toEqual({ articles: ['secret', 'note'] });
	expect(await getHiddenFields()).toEqual({ articles: ['secret', 'note'] });
	expect(tracker.history.select).toHaveLength(2);
});

// Owner 2026-11-03: status (archive field) and sort (sort field) stay in a wildcard when hidden, like at DR.
test('the archive and sort fields of a collection are never listed as hidden', async () => {
	tracker.on.select('directus_fields').response([
		{ collection: 'articles', field: 'secret', hidden: true },
		{ collection: 'articles', field: 'status', hidden: true },
		{ collection: 'articles', field: 'sort', hidden: true },
	]);
	tracker.on.select('directus_collections').response([
		{ collection: 'articles', archive_field: 'status', sort_field: 'sort' },
	]);

	expect(await getHiddenFields()).toEqual({ articles: ['secret'] });
});

test('a failing database means no hidden field', async () => {
	tracker.on.select('directus_fields').simulateError('down');
	expect(await getHiddenFields()).toEqual({});
	expect(store.size).toBe(0);
});
