// fetchPolicies, fetchPermissions and fetchAllowedFieldMap on real SQLite tables. Feature 004 reads them through
// AccessService and PermissionsService like DR (the knex shortcut of features 001 and 002 is gone), so the schema
// is the one of the database (system collections and relations) plus the `articles` collection of the test.
import { createInspector } from '@backoffice/schema';
import { SchemaBuilder } from '@backoffice/schema-builder';
import type { SchemaOverview } from '@backoffice/types';
import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { getSimpleHash } from '@backoffice/utils';
import { PUBLIC_POLICY, createDirectusDb } from '../../test/directus-db.js';
import { _resetCache, useCache } from './cache.js';
import { fetchPermissions } from './lib/fetch-permissions.js';
import { fetchPolicies } from './lib/fetch-policies.js';
import { getDatabaseSchema } from '../schema/get-database-schema.js';
import { fetchAllowedFieldMap } from './modules/fetch-allowed-field-map/fetch-allowed-field-map.js';

const POLICY_B = '11111111-1111-4111-8111-111111111111';
const POLICY_IP = '22222222-2222-4222-8222-222222222222';
const ROLE = '33333333-3333-4333-8333-333333333333';

let db: Knex;
let schema: SchemaOverview;
const articles = new SchemaBuilder().collection('articles', (c) => c.field('id').id()).build();
const ctx = () => ({ knex: db, schema });

beforeEach(async () => {
	// The permissions cache (feature 002) is local without Redis; empty it so each test reads its own tables.
	_resetCache();
	db = await createDirectusDb();
	const database = await getDatabaseSchema(db, createInspector(db));
	schema = { collections: { ...database.collections, ...articles.collections }, relations: database.relations };

	await db('directus_policies').insert([
		{ id: PUBLIC_POLICY, name: '$t:public_label', ip_access: null },
		{ id: POLICY_B, name: 'b', ip_access: '' },
		{ id: POLICY_IP, name: 'ip', ip_access: '10.0.0.0/8,192.168.1.1' },
	]);

	await db('directus_access').insert([
		{ id: '00000000-0000-4000-8000-00000000000a', role: null, user: null, policy: POLICY_IP, sort: 3 },
		{ id: '00000000-0000-4000-8000-00000000000b', role: null, user: null, policy: PUBLIC_POLICY, sort: 1 },
		{ id: '00000000-0000-4000-8000-00000000000c', role: null, user: null, policy: POLICY_B, sort: 2 },
		{ id: '00000000-0000-4000-8000-00000000000d', role: ROLE, user: null, policy: POLICY_B, sort: 1 },
	]);

	await db('directus_permissions').insert([
		{
			collection: 'articles',
			action: 'read',
			fields: 'id,title',
			permissions: '{"status":{"_eq":"published"}}',
			validation: null,
			presets: '{bad',
			policy: POLICY_B,
		},
		{
			collection: 'articles',
			action: 'read',
			fields: 'title,body',
			permissions: null,
			validation: null,
			presets: null,
			policy: PUBLIC_POLICY,
		},
		{
			collection: 'articles',
			action: 'update',
			fields: '*',
			permissions: null,
			validation: null,
			presets: null,
			policy: PUBLIC_POLICY,
		},
		{
			collection: 'authors',
			action: 'read',
			fields: null,
			permissions: null,
			validation: null,
			presets: null,
			policy: POLICY_IP,
		},
	]);
});

afterEach(() => db.destroy());

describe('fetchPolicies', () => {
	test('public (no role, no user): ordered by sort, IP-restricted policies dropped for other IPs', async () => {
		expect(await fetchPolicies({ roles: [], user: null, ip: '1.2.3.4' }, ctx())).toEqual([PUBLIC_POLICY, POLICY_B]);
	});

	test('IP allow list (cast-csv) accepts matching IPs; unknown IP never passes', async () => {
		expect(await fetchPolicies({ roles: [], user: null, ip: '10.1.2.3' }, ctx())).toEqual([
			PUBLIC_POLICY,
			POLICY_B,
			POLICY_IP,
		]);
		expect(await fetchPolicies({ roles: [], user: null, ip: null }, ctx())).toEqual([PUBLIC_POLICY, POLICY_B]);
	});

	test('role and user policies (used from feature 003)', async () => {
		expect(await fetchPolicies({ roles: [ROLE], user: null, ip: '1.1.1.1' }, ctx())).toEqual([POLICY_B]);
		expect(
			await fetchPolicies({ roles: [ROLE], user: '44444444-4444-4444-8444-444444444444', ip: '1.1.1.1' }, ctx()),
		).toEqual([POLICY_B]);
	});
});

describe('fetchPermissions', () => {
	test('reads by policy and action, casts csv/json, sorts by policy order', async () => {
		const permissions = await fetchPermissions({ action: 'read', policies: [PUBLIC_POLICY, POLICY_B] }, ctx());

		expect(permissions.map((p) => [p.policy, p.collection, p.fields])).toEqual([
			[PUBLIC_POLICY, 'articles', ['title', 'body']],
			[POLICY_B, 'articles', ['id', 'title']],
		]);

		expect(permissions[1]!.permissions).toEqual({ status: { _eq: 'published' } });
		expect(permissions[1]!.presets).toBe('{bad');
	});

	test('filters by collection; no policies → no query', async () => {
		expect(
			(await fetchPermissions({ policies: [PUBLIC_POLICY], collections: ['articles'] }, ctx())).map((p) => p.action),
		).toEqual(['read', 'update']);
		expect(await fetchPermissions({ policies: [] }, ctx())).toEqual([]);
	});
});

describe('fetchAllowedFieldMap', () => {
	test('public: merged, de-duplicated fields per collection', async () => {
		const map = await fetchAllowedFieldMap(
			{
				accountability: { roles: [], user: null, role: null, ip: '10.0.0.1', admin: false, app: false },
				action: 'read',
			},
			ctx(),
		);
		expect(map).toEqual({ articles: ['title', 'body', 'id'], authors: [] });
	});

	test('admin: every field of the schema', async () => {
		const map = await fetchAllowedFieldMap(
			{ accountability: { roles: [], user: null, role: null, ip: null, admin: true, app: false }, action: 'read' },
			ctx(),
		);
		expect(map['articles']).toEqual(['id']);
		expect(Object.keys(map)).toEqual(Object.keys(schema.collections));
	});
});

// Feature 002: the shared permissions cache (contracts/redis.md §4, research R5)
describe('permissions cache', () => {
	const publicAccountability = { roles: [], user: null, ip: '1.2.3.4', app: false, role: null };

	test('a second call with the same arguments does not query the database', async () => {
		let queries = 0;
		db.on('query', () => queries++);

		const policies = await fetchPolicies(publicAccountability, ctx());
		await fetchPermissions({ action: 'read', policies, accountability: publicAccountability }, ctx());
		const first = queries;

		expect(await fetchPolicies(publicAccountability, ctx())).toEqual(policies);
		await fetchPermissions({ action: 'read', policies, accountability: publicAccountability }, ctx());
		expect(queries).toBe(first);
	});

	test('keys are those Directus computes on the public OAS path', async () => {
		const policies = await fetchPolicies(publicAccountability, ctx());
		await fetchPermissions({ action: 'read', policies, accountability: publicAccountability }, ctx());
		await fetchPermissions({ policies, accountability: publicAccountability }, ctx());
		// withCache does not await set()
		await new Promise((r) => setTimeout(r, 10));

		const cache = useCache();
		const hash = (args: unknown) => getSimpleHash(JSON.stringify(args));
		expect(await cache.get(`policies-${hash({ roles: [], user: null, ip: '1.2.3.4' })}`)).toEqual(policies);
		expect(
			await cache.get(`raw-permissions-${hash({ policies, action: 'read', accountability: { app: false } })}`),
		).toBeInstanceOf(Array);
		expect(await cache.get(`raw-permissions-${hash({ policies, accountability: { app: false } })}`)).toBeInstanceOf(
			Array,
		);
	});
});
