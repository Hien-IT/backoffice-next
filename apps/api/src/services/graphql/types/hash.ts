// Ported from directus/api/src/services/graphql/types/hash.ts
import { GraphQLScalarType, GraphQLString } from 'graphql';

export const GraphQLHash = new GraphQLScalarType({
	...GraphQLString,
	name: 'Hash',
	description: 'Hashed string values',
});
