import type { Type } from '@directus/types';
import { expect, test } from 'vitest';
import { getDefaultDisplayForType } from './get-default-display-for-type.ts';

// spec FR-002
const expected: Record<Type, string> = {
	bigInteger: 'formatted-value',
	decimal: 'formatted-value',
	float: 'formatted-value',
	integer: 'formatted-value',
	string: 'formatted-value',
	text: 'formatted-value',
	uuid: 'formatted-value',
	hash: 'formatted-value',
	boolean: 'boolean',
	date: 'datetime',
	dateTime: 'datetime',
	time: 'datetime',
	timestamp: 'datetime',
	csv: 'labels',
	alias: 'raw',
	binary: 'raw',
	json: 'raw',
	unknown: 'raw',
	geometry: 'raw',
	'geometry.Point': 'raw',
	'geometry.LineString': 'raw',
	'geometry.Polygon': 'raw',
	'geometry.MultiPoint': 'raw',
	'geometry.MultiLineString': 'raw',
	'geometry.MultiPolygon': 'raw',
};

test.each(Object.entries(expected))('%s -> %s', (type, display) => {
	expect(getDefaultDisplayForType(type as Type)).toBe(display);
});

test('an unknown type falls back to raw', () => {
	expect(getDefaultDisplayForType('not-a-type' as Type)).toBe('raw');
});
