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
		{ collection: 'articles', field: 'sort', hidden: 1 },
		{ collection: 'articles', field: 'title', hidden: false },
		{ collection: 'articles', field: 'body', hidden: null },
		{ collection: 'directus_users', field: 'tfa_secret', hidden: true },
	]);

	expect(await getHiddenFields()).toEqual({ articles: ['secret', 'sort'] });
	expect(await getHiddenFields()).toEqual({ articles: ['secret', 'sort'] });
	expect(tracker.history.select).toHaveLength(1);
});

test('a failing database means no hidden field', async () => {
	tracker.on.select('directus_fields').simulateError('down');
	expect(await getHiddenFields()).toEqual({});
	expect(store.size).toBe(0);
});
