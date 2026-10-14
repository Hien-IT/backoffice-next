// Ported from directus/api/src/services/graphql/types/void.ts
import { GraphQLScalarType } from 'graphql';

export const GraphQLVoid = new GraphQLScalarType({
	name: 'Void',

	description: 'Represents NULL values',

	serialize() {
		return null;
	},

	parseValue() {
		return null;
	},

	parseLiteral() {
		return null;
	},
});
