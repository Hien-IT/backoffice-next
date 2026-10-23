// Backoffice (feature 011, T004): DR has no tests for its GraphQL scalars; these pin the parse, serialize and
// error messages the parity suite compares (spec FR-052) and the type map of utils/get-graphql-type.ts.
import { GraphQLBoolean, GraphQLFloat, GraphQLID, GraphQLInt, GraphQLList, GraphQLString, Kind } from 'graphql';
import { GraphQLJSON } from 'graphql-compose';
import { describe, expect, test } from 'vitest';
import { getGraphQLType } from '../../../utils/get-graphql-type.js';
import { GraphQLBigInt } from './bigint.js';
import { GraphQLDate } from './date.js';
import { GraphQLGeoJSON } from './geojson.js';
import { GraphQLHash } from './hash.js';
import { GraphQLStringOrFloat } from './string-or-float.js';
import { GraphQLVoid } from './void.js';

describe('GraphQLBigInt', () => {
	test('serializes numbers to strings and passes strings and empty values through', () => {
		expect(GraphQLBigInt.serialize(42)).toBe('42');
		expect(GraphQLBigInt.serialize('9223372036854775807')).toBe('9223372036854775807');
		expect(GraphQLBigInt.serialize(null)).toBeNull();
		expect(() => GraphQLBigInt.serialize({})).toThrow('Value must be a Number');
	});

	test('parses safe integers to numbers and big ones to strings, within int64', () => {
		expect(GraphQLBigInt.parseValue('42')).toBe(42);
		expect(GraphQLBigInt.parseValue('9223372036854775807')).toBe('9223372036854775807');
		expect(() => GraphQLBigInt.parseValue('9223372036854775808')).toThrow('Invalid GraphQLBigInt');
		expect(() => GraphQLBigInt.parseValue('abc')).toThrow('Invalid GraphQLBigInt');
		expect(() => GraphQLBigInt.parseValue(42)).toThrow('Value must be a String');
		expect(GraphQLBigInt.parseLiteral({ kind: Kind.STRING, value: '7' })).toBe(7);
		expect(() => GraphQLBigInt.parseLiteral({ kind: Kind.INT, value: '7' })).toThrow('Value must be a String');
	});
});

describe('GraphQLStringOrFloat', () => {
	test('accepts strings and numbers, rejects the rest', () => {
		expect(GraphQLStringOrFloat.serialize('a')).toBe('a');
		expect(GraphQLStringOrFloat.serialize(1.5)).toBe(1.5);
		expect(() => GraphQLStringOrFloat.serialize(true)).toThrow('Value must be either a String or a Float');
		expect(GraphQLStringOrFloat.parseValue(2)).toBe(2);
		expect(() => GraphQLStringOrFloat.parseValue(null)).toThrow('Value must be either a String or a Float');
		expect(GraphQLStringOrFloat.parseLiteral({ kind: Kind.INT, value: '3' })).toBe(3);
		expect(GraphQLStringOrFloat.parseLiteral({ kind: Kind.FLOAT, value: '3.5' })).toBe(3.5);
		expect(GraphQLStringOrFloat.parseLiteral({ kind: Kind.STRING, value: 'x' })).toBe('x');
		expect(() => GraphQLStringOrFloat.parseLiteral({ kind: Kind.BOOLEAN, value: true })).toThrow(
			'Value must be either a String or a Float',
		);
	});
});

describe('Date, Hash, GeoJSON, Void', () => {
	test('Date and Hash behave as String under their own names and descriptions', () => {
		expect(GraphQLDate.name).toBe('Date');
		expect(GraphQLDate.description).toBe('ISO8601 Date values');
		expect(GraphQLDate.serialize('2026-10-14T00:00:00Z')).toBe('2026-10-14T00:00:00Z');
		expect(GraphQLDate.parseValue('abc')).toBe('abc');
		expect(() => GraphQLDate.parseValue(1)).toThrow();
		expect(GraphQLHash.name).toBe('Hash');
		expect(GraphQLHash.description).toBe('Hashed string values');
	});

	test('GeoJSON behaves as JSON; Void is always null', () => {
		expect(GraphQLGeoJSON.name).toBe('GraphQLGeoJSON');
		expect(GraphQLGeoJSON.description).toBe('GeoJSON value');
		expect(GraphQLGeoJSON.serialize({ type: 'Point' })).toEqual({ type: 'Point' });
		expect(GraphQLVoid.description).toBe('Represents NULL values');
		expect(GraphQLVoid.serialize('x')).toBeNull();
		expect(GraphQLVoid.parseValue('x')).toBeNull();
		expect(GraphQLVoid.parseLiteral({ kind: Kind.STRING, value: 'x' })).toBeNull();
	});
});

describe('getGraphQLType', () => {
	test('maps every Directus type and the conceal special', () => {
		expect(getGraphQLType('string', ['conceal'])).toBe(GraphQLHash);
		expect(getGraphQLType('boolean', [])).toBe(GraphQLBoolean);
		expect(getGraphQLType('bigInteger', [])).toBe(GraphQLBigInt);
		expect(getGraphQLType('integer', [])).toBe(GraphQLInt);
		expect(getGraphQLType('decimal', [])).toBe(GraphQLFloat);
		expect(getGraphQLType('float', [])).toBe(GraphQLFloat);
		expect(getGraphQLType('csv', [])).toBeInstanceOf(GraphQLList);
		expect((getGraphQLType('csv', []) as GraphQLList<any>).ofType).toBe(GraphQLString);
		expect(getGraphQLType('json', [])).toBe(GraphQLJSON);
		expect(getGraphQLType('geometry', [])).toBe(GraphQLGeoJSON);
		expect(getGraphQLType('time', [])).toBe(GraphQLDate);
		expect(getGraphQLType('timestamp', [])).toBe(GraphQLDate);
		expect(getGraphQLType('dateTime', [])).toBe(GraphQLDate);
		expect(getGraphQLType('date', [])).toBe(GraphQLDate);
		expect(getGraphQLType('hash', [])).toBe(GraphQLHash);
		expect(getGraphQLType('uuid', [])).toBe(GraphQLID);
		expect(getGraphQLType('string', [])).toBe(GraphQLString);
		expect(getGraphQLType('alias', [])).toBe(GraphQLString);
		expect(getGraphQLType('unknown', [])).toBe(GraphQLString);
	});
});
