import { getSimpleHash } from '@backoffice/utils';
import knex, { type Knex } from 'knex';
import { createTracker, MockClient, type Tracker } from 'knex-mock-client';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchRolesTree } from '../../lib/fetch-roles-tree.js';
import { fetchGlobalAccess } from './fetch-global-access.js';

const store = new Map<string, unknown>();

vi.mock('../../cache.js', () => ({
	useCache: () => ({
		get: async (key: string) => store.get(key),
		set: async (key: string, value: unknown) => void store.set(key, value),
	}),
}));

let db: Knex;
let tracker: Tracker;

beforeAll(() => {
	db = knex.default({ client: MockClient });
	tracker = createTracker(db);
});

beforeEach(() => store.clear());
afterEach(() => tracker.reset());

// Same keys as directus/api/src/permissions (withCache: `<namespace>-<getSimpleHash(JSON of the key)>`).
const key = (namespace: string, value: unknown) => `${namespace}-${getSimpleHash(JSON.stringify(value))}`;

describe('shared permissions cache namespaces of feature 003', () => {
	test('fetchRolesTree caches under roles-tree with { start }', async () => {
		tracker.on.select('directus_roles').response({ id: 'child', parent: null });

		expect(await fetchRolesTree('child', { knex: db })).toEqual(['child']);
		expect(store.get(key('roles-tree', { start: 'child' }))).toEqual(['child']);
	});

	test('fetchGlobalAccess caches the result and its two parts like Directus', async () => {
		tracker.on.select('directus_access').responseOnce([{ admin_access: false, app_access: true, ip_access: null }]);
		tracker.on.select('directus_access').responseOnce([{ admin_access: true, app_access: false, ip_access: null }]);

		const access = await fetchGlobalAccess({ user: 'u', roles: ['r'], ip: '127.0.0.1' }, { knex: db });

		expect(access).toEqual({ app: true, admin: true });
		// Like Directus: the parts are keyed with the accountability IP, the result with the IP of the context (none
		// here, as in getAccountabilityForToken), and the roles part is the object the result mutates.
		expect(store.get(key('global-access-roles', { roles: ['r'], ip: '127.0.0.1' }))).toBe(access);
		expect(store.get(key('global-access-user', { user: 'u', ip: '127.0.0.1' }))).toEqual({ app: true, admin: true });
		expect(store.get(key('global-access', { user: 'u', roles: ['r'] }))).toBe(access);
	});

	test('a cached value is returned without a query', async () => {
		store.set(key('global-access', { roles: [] }), { app: false, admin: false });
		expect(await fetchGlobalAccess({ user: undefined, roles: [], ip: null } as never, { knex: db })).toEqual({
			app: false,
			admin: false,
		});
		expect(tracker.history.select).toHaveLength(0);
	});
});
