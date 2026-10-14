// Backoffice (feature 011, T012): Directus has no test for GraphQLService.execute; these pin the validation error with
// its path, the resolver errors through processError, the execution error and the extensions pass-through (spec
// FR-002, FR-050, FR-051).
import { ForbiddenError } from '@backoffice/errors';
import { useEnv } from '@backoffice/env';
import { GraphQLObjectType, GraphQLSchema, GraphQLString, parse } from 'graphql';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { GraphQLService } from './index.js';
import { generateSchema } from './schema/index.js';

vi.mock('@backoffice/env', () => ({ useEnv: vi.fn(() => ({})) }));
vi.mock('../../logger/index.js', () => ({ useLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }) }));
vi.mock('../../bus/index.js', () => ({ useBus: () => ({ subscribe: vi.fn() }) }));
vi.mock('../../database/index.js', () => ({ default: vi.fn(() => ({})), getDatabase: vi.fn(() => ({})) }));
vi.mock('../../utils/get-service.js');
vi.mock('./schema/index.js', () => ({ generateSchema: vi.fn() }));

const schema = new GraphQLSchema({
	query: new GraphQLObjectType({
		name: 'Query',
		fields: {
			ok: { type: GraphQLString, resolve: () => 'fine' },
			forbidden: {
				type: GraphQLString,
				resolve: () => {
					throw new ForbiddenError();
				},
			},
			crash: {
				type: GraphQLString,
				resolve: () => {
					throw new Error('db exploded');
				},
			},
		},
	}),
});

const params = (query: string, variables: Record<string, unknown> | null = null) => ({
	query,
	document: parse(query),
	variables,
	operationName: null,
	contextValue: { cache: new Map() },
});

const service = (admin: boolean) =>
	new GraphQLService({
		accountability: { admin, role: 'r', user: 'u', app: true, roles: ['r'], ip: null },
		schema: { collections: {}, relations: [] },
		scope: 'items',
	});

beforeEach(() => {
	vi.mocked(useEnv).mockReturnValue({});
	vi.mocked(generateSchema).mockResolvedValue(schema);
});

describe('GraphQLService.execute', () => {
	test('data of a valid document', async () => {
		await expect(service(true).execute(params('{ ok }'))).resolves.toEqual({ data: { ok: 'fine' } });
	});

	test('a validation error → GraphQLValidationError with the errors and their location', async () => {
		const error = await service(true)
			.execute(params('{ nope }'))
			.catch((e) => e);

		expect(error.code).toBe('GRAPHQL_VALIDATION');
		expect(error.status).toBe(400);
		expect(error.extensions.errors[0].message).toBe('Cannot query field "nope" on type "Query".');
		expect(error.extensions.errors[0].locations).toEqual([{ line: 1, column: 3 }]);
	});

	test('a resolver throwing a Backoffice error → 200 data null and the code for everyone', async () => {
		for (const admin of [true, false]) {
			const result = await service(admin).execute(params('{ forbidden }'));
			expect(result.data).toEqual({ forbidden: null });
			expect(result.errors).toEqual([
				{
					message: "You don't have permission to access this.",
					extensions: { code: 'FORBIDDEN' },
					locations: [{ line: 1, column: 3 }],
					path: ['forbidden'],
				},
			]);
		}
	});

	test('any other resolver error: the admin sees the message, the others "An unexpected error occurred."', async () => {
		const admin = await service(true).execute(params('{ crash }'));
		expect(admin.errors![0]).toEqual({
			message: 'db exploded',
			extensions: { code: 'INTERNAL_SERVER_ERROR' },
			locations: [{ line: 1, column: 3 }],
			path: ['crash'],
		});

		const user = await service(false).execute(params('{ crash }'));
		expect(user.errors![0]).toEqual({
			message: 'An unexpected error occurred.',
			extensions: { code: 'INTERNAL_SERVER_ERROR' },
		});
	});

	test('a variable of the wrong kind → GraphQLValidationError (validate runs before execute)', async () => {
		const error = await service(true)
			.execute(params('query ($v: Int!) { ok }', { v: 'x' }))
			.catch((e) => e);
		expect(error.code).toBe('GRAPHQL_VALIDATION');
	});

	test('an execute failure outside the resolvers (variables not an object) → GraphQLExecutionError', async () => {
		const error = await service(true)
			.execute({ ...params('{ ok }'), variables: 'x' as any })
			.catch((e) => e);
		expect(error.code).toBe('GRAPHQL_EXECUTION');
		expect(error.status).toBe(400);
		expect(error.extensions.errors[0]).toMatch(/Variables must be provided as an Object/);
	});

	test('GRAPHQL_INTROSPECTION=false adds the no-introspection validation rule', async () => {
		vi.resetModules();
		vi.mocked(useEnv).mockReturnValue({ GRAPHQL_INTROSPECTION: false });
		const { GraphQLService: Service } = await import('./index.js');
		const { generateSchema: generate } = await import('./schema/index.js');
		vi.mocked(generate).mockResolvedValue(schema);

		const error = await new Service({
			accountability: null,
			schema: { collections: {}, relations: [] },
			scope: 'items',
		})
			.execute(params('{ __schema { queryType { name } } }'))
			.catch((e) => e);

		expect(error.code).toBe('GRAPHQL_VALIDATION');
		expect(error.extensions.errors[0].message).toMatch(/introspection/i);
	});
});
