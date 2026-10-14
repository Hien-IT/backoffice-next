// Backoffice (feature 011, T011): generateSchema caches by `scope_type_role_user`, generates at most
// GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT schemas at a time (the rest wait, errors reach the caller) and checks the
// cache again inside the queue (spec FR-044, FR-045). The admin schema is built for real from a SchemaBuilder schema,
// which also exercises read.ts, write.ts, get-types.ts and the system resolvers.
import { useEnv } from '@backoffice/env';
import { SchemaBuilder } from '@backoffice/schema-builder';
import { GraphQLSchema } from 'graphql';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchAllowedFieldMap } from '../../../permissions/modules/fetch-allowed-field-map/fetch-allowed-field-map.js';
import { fetchInconsistentFieldMap } from '../../../permissions/modules/fetch-inconsistent-field-map/fetch-inconsistent-field-map.js';
import type { GraphQLService } from '../index.js';
import { cache } from '../schema-cache.js';
import { sanitizeGraphqlSchema } from '../utils/sanitize-gql-schema.js';
import { generateSchema } from './index.js';

vi.mock('@backoffice/env', () => ({
	useEnv: vi.fn(() => ({ GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT: 1, GRAPHQL_SCHEMA_CACHE_CAPACITY: 100 })),
}));
vi.mock('../../../logger/index.js', () => ({ useLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }) }));
vi.mock('../../bus/index.js', () => ({ useBus: () => ({ subscribe: vi.fn() }) }));
vi.mock('../../../database/index.js', () => ({ default: vi.fn(), getDatabase: vi.fn() }));
vi.mock('../../../permissions/modules/fetch-allowed-field-map/fetch-allowed-field-map.js');
vi.mock('../../../permissions/modules/fetch-inconsistent-field-map/fetch-inconsistent-field-map.js');
vi.mock('../utils/sanitize-gql-schema.js', async (importOriginal) => {
	const original = await importOriginal<typeof import('../utils/sanitize-gql-schema.js')>();
	return { sanitizeGraphqlSchema: vi.fn(original.sanitizeGraphqlSchema) };
});

const schema = new SchemaBuilder()
	.collection('articles', (c) => {
		c.field('id').integer().primary();
		c.field('title').string();
		c.field('author').m2o('directus_users');
	})
	.collection('directus_users', (c) => {
		c.field('id').uuid().primary();
		c.field('email').string();
	})
	.build();

function gql(overrides: Partial<GraphQLService> = {}): GraphQLService {
	return {
		scope: 'items',
		schema,
		knex: {} as any,
		accountability: { admin: true, role: 'r', user: 'u', app: true, roles: ['r'], ip: null },
		...overrides,
	} as GraphQLService;
}

beforeEach(() => {
	vi.clearAllMocks();
	cache.clear();
	vi.mocked(useEnv).mockReturnValue({
		GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT: 1,
		GRAPHQL_SCHEMA_CACHE_CAPACITY: 100,
	});
	vi.mocked(sanitizeGraphqlSchema).mockClear();
	vi.mocked(fetchAllowedFieldMap).mockResolvedValue({ articles: ['id', 'title'] });
	vi.mocked(fetchInconsistentFieldMap).mockResolvedValue({});
});

describe('generateSchema', () => {
	test('admin: a real schema with the collection types, cached under scope_type_role_user', async () => {
		const built = await generateSchema(gql());

		expect(built).toBeInstanceOf(GraphQLSchema);
		const s = built as GraphQLSchema;
		expect(s.getQueryType()!.getFields()['articles']).toBeDefined();
		expect(s.getQueryType()!.getFields()['articles_by_id']).toBeDefined();
		expect(s.getQueryType()!.getFields()['articles_aggregated']).toBeDefined();
		expect(s.getQueryType()!.getFields()['articles_by_version']).toBeDefined();
		expect(s.getMutationType()!.getFields()['create_articles_item']).toBeDefined();
		expect(s.getMutationType()!.getFields()['delete_articles_items']).toBeDefined();
		// Items scope: no system collection at the top level, but its type exists for the relation.
		expect(s.getQueryType()!.getFields()['directus_users']).toBeUndefined();
		expect(s.getType('directus_users')).toBeDefined();
		// FR-047: the Subscription type stays, named after the full collection name.
		expect(s.getSubscriptionType()!.getFields()['articles_mutated']).toBeDefined();
		expect(s.getSubscriptionType()!.getFields()['directus_users_mutated']).toBeDefined();

		expect(cache.get('items_schema_r_u')).toBe(built);
		expect(fetchAllowedFieldMap).not.toHaveBeenCalled();
	});

	test('sdl: a string, cached separately; the system scope strips the directus_ prefix', async () => {
		const sdl = await generateSchema(gql({ scope: 'system' }), 'sdl');

		expect(typeof sdl).toBe('string');
		expect(sdl).toContain('users_by_id');
		expect(sdl).toContain('server_ping');
		expect(sdl).not.toContain('articles_by_id');
		expect(cache.get('system_sdl_r_u')).toBe(sdl);
	});

	test('a cached schema is returned without generating again', async () => {
		await generateSchema(gql());
		await generateSchema(gql());
		expect(sanitizeGraphqlSchema).toHaveBeenCalledTimes(1);
	});

	test('a non-admin user gets the schema reduced by the allowed field map of each action', async () => {
		const built = (await generateSchema(
			gql({ accountability: { admin: false, role: 'r2', user: 'u2', app: true, roles: ['r2'], ip: null } }),
		)) as GraphQLSchema;

		expect(fetchAllowedFieldMap).toHaveBeenCalledTimes(4);
		expect(fetchInconsistentFieldMap).toHaveBeenCalled();
		expect(built.getQueryType()!.getFields()['articles']).toBeDefined();
		expect(cache.get('items_schema_r2_u2')).toBe(built);
	});

	test('the public (no accountability) gets the whole sanitized schema under the undefined key', async () => {
		await generateSchema(gql({ accountability: null }));
		expect(cache.get('items_schema_undefined_undefined')).toBeInstanceOf(GraphQLSchema);
		expect(fetchAllowedFieldMap).not.toHaveBeenCalled();
	});

	test('concurrent requests for the same key generate once (second cache check inside the queue)', async () => {
		const [a, b] = await Promise.all([generateSchema(gql()), generateSchema(gql())]);
		expect(a).toBe(b);
		expect(sanitizeGraphqlSchema).toHaveBeenCalledTimes(1);
	});

	test('a failing generation rejects the caller and caches nothing', async () => {
		vi.mocked(sanitizeGraphqlSchema).mockImplementationOnce(() => {
			throw new Error('boom');
		});

		await expect(generateSchema(gql())).rejects.toThrow('boom');
		expect(cache.size).toBe(0);

		// The next request generates again.
		await expect(generateSchema(gql())).resolves.toBeInstanceOf(GraphQLSchema);
	});
});
