// Ported from directus/api/src/services/graphql/types/geojson.ts
import { GraphQLScalarType } from 'graphql';
import { GraphQLJSON } from 'graphql-compose';

export const GraphQLGeoJSON = new GraphQLScalarType({
	...GraphQLJSON,
	name: 'GraphQLGeoJSON',
	description: 'GeoJSON value',
});
