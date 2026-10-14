import type { Type } from '@directus/types';
import { expect, test } from 'vitest';
import { getDefaultInterfaceForType } from './get-default-interface-for-type.ts';

// spec FR-002
const expected: Record<Type, string> = {
	alias: 'input',
	bigInteger: 'input',
	binary: 'input',
	decimal: 'input',
	float: 'input',
	integer: 'input',
	string: 'input',
	uuid: 'input',
	unknown: 'input',
	boolean: 'boolean',
	date: 'datetime',
	dateTime: 'datetime',
	time: 'datetime',
	timestamp: 'datetime',
	json: 'input-code',
	text: 'input-multiline',
	csv: 'tags',
	hash: 'input-hash',
	geometry: 'map',
	'geometry.Point': 'map',
	'geometry.LineString': 'map',
	'geometry.Polygon': 'map',
	'geometry.MultiPoint': 'map',
	'geometry.MultiLineString': 'map',
	'geometry.MultiPolygon': 'map',
};

test.each(Object.entries(expected))('%s -> %s', (type, inter) => {
	expect(getDefaultInterfaceForType(type as Type)).toBe(inter);
});

test('an unknown type falls back to input', () => {
	expect(getDefaultInterfaceForType('not-a-type' as Type)).toBe('input');
});
