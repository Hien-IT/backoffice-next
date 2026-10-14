// Ported from directus/api/src/services/graphql/errors/execution.ts
import { createError } from '@backoffice/errors';
import type { GraphQLError } from 'graphql';

interface GraphQLExecutionErrorExtensions {
	errors: GraphQLError[];
}

export const GraphQLExecutionError = createError<GraphQLExecutionErrorExtensions>(
	'GRAPHQL_EXECUTION',
	'GraphQL execution error.',
	400,
);
