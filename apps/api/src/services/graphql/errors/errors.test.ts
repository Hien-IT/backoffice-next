// Backoffice (feature 011, T006): DR has no tests for its GraphQL errors; these pin the codes, status and the
// `extensions.errors` list the parity suite compares (spec FR-002, FR-050), and formatError's GraphQLError wrapping.
import { createError, isBackofficeError } from '@backoffice/errors';
import { GraphQLError } from 'graphql';
import { describe, expect, test } from 'vitest';
import { GraphQLExecutionError, GraphQLValidationError } from './index.js';
import { formatError } from './format.js';

describe('GraphQL errors', () => {
	test('validation: GRAPHQL_VALIDATION, 400, the GraphQL errors in extensions.errors', () => {
		const inner = new GraphQLError('Cannot query field "x" on type "Query".');
		const error = new GraphQLValidationError({ errors: [inner] });

		expect(isBackofficeError(error)).toBe(true);
		expect(error.code).toBe('GRAPHQL_VALIDATION');
		expect(error.status).toBe(400);
		expect(error.message).toBe('GraphQL validation error.');
		expect(error.extensions.errors).toEqual([inner]);
	});

	test('execution: GRAPHQL_EXECUTION, 400', () => {
		const error = new GraphQLExecutionError({ errors: [new GraphQLError('boom')] });

		expect(error.code).toBe('GRAPHQL_EXECUTION');
		expect(error.status).toBe(400);
		expect(error.message).toBe('GraphQL execution error.');
	});

	test('formatError wraps a Backoffice error (or the first of a list) as the GraphQLError originalError with its code', () => {
		const Forbidden = createError('FORBIDDEN', "You don't have permission to access this.", 403);
		const single = formatError(new Forbidden());

		expect(single).toBeInstanceOf(GraphQLError);
		expect(single.message).toBe("You don't have permission to access this.");
		expect(single.originalError).toBeInstanceOf(Forbidden);
		expect((single.originalError as any).extensions.code).toBe('FORBIDDEN');

		const first = new Forbidden();
		const list = formatError([first, new Forbidden()]);
		expect(list.originalError).toBe(first);
	});
});
