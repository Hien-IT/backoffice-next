// Directus has no test for utils/geometry: every geometry type x storage format (spec FR-063), bbox and flatten.
import type { AnyGeometry, GeometryFormat, Type } from '@directus/types';
import { describe, expect, test } from 'vitest';
import {
	expandBBox,
	flatten,
	getBBox,
	getGeometryFormatForType,
	getGeometryParser,
	getParser,
	getSerializer,
	toGeoJSON,
} from './index.ts';

const GEOMETRIES: Record<string, { geojson: AnyGeometry; wkt: string; bbox: number[] }> = {
	Point: {
		geojson: { type: 'Point', coordinates: [105.85, 21.03] },
		wkt: 'POINT (105.85 21.03)',
		bbox: [105.85, 21.03, 105.85, 21.03],
	},
	LineString: {
		geojson: {
			type: 'LineString',
			coordinates: [
				[105, 21],
				[106, 22],
			],
		},
		wkt: 'LINESTRING (105 21, 106 22)',
		bbox: [105, 21, 106, 22],
	},
	Polygon: {
		geojson: {
			type: 'Polygon',
			coordinates: [
				[
					[105, 21],
					[106, 21],
					[106, 22],
					[105, 21],
				],
			],
		},
		wkt: 'POLYGON ((105 21, 106 21, 106 22, 105 21))',
		bbox: [105, 21, 106, 22],
	},
	MultiPoint: {
		geojson: {
			type: 'MultiPoint',
			coordinates: [
				[1, 2],
				[3, 4],
			],
		},
		wkt: 'MULTIPOINT (1 2, 3 4)',
		bbox: [1, 2, 3, 4],
	},
	MultiLineString: {
		geojson: {
			type: 'MultiLineString',
			coordinates: [
				[
					[0, 0],
					[1, 1],
				],
				[
					[2, 2],
					[3, -1],
				],
			],
		},
		wkt: 'MULTILINESTRING ((0 0, 1 1), (2 2, 3 -1))',
		bbox: [0, -1, 3, 2],
	},
	MultiPolygon: {
		geojson: {
			type: 'MultiPolygon',
			coordinates: [
				[
					[
						[0, 0],
						[1, 0],
						[1, 1],
						[0, 0],
					],
				],
				[
					[
						[5, 5],
						[6, 5],
						[6, 6],
						[5, 5],
					],
				],
			],
		},
		wkt: 'MULTIPOLYGON (((0 0, 1 0, 1 1, 0 0)), ((5 5, 6 5, 6 6, 5 5)))',
		bbox: [0, 0, 6, 6],
	},
};

const options = (geometryFormat: GeometryFormat) => ({ geometryFormat, geometryField: 'value' });

describe('getGeometryFormatForType', () => {
	test.each([
		['json', 'geojson'],
		['string', 'wkt'],
		['text', 'wkt'],
		['csv', 'lnglat'],
		['geometry', 'native'],
		['geometry.Point', 'native'],
		['geometry.MultiPolygon', 'native'],
		['integer', undefined],
	])('%s -> %s', (type, format) => {
		expect(getGeometryFormatForType(type as Type)).toBe(format);
	});
});

describe.each(Object.entries(GEOMETRIES))('%s', (_type, { geojson, wkt, bbox }) => {
	test.each(['native', 'geojson'] as const)('%s keeps the GeoJSON object', (format) => {
		expect(getSerializer(options(format))(geojson as never)).toBe(geojson);
		expect(getParser(options(format))({ value: geojson })).toBe(geojson);
	});

	test('wkt serializes and parses back', () => {
		const serialized = getSerializer(options('wkt'))(geojson as never);
		expect(serialized.replace(/\s*([(),])\s*/g, '$1')).toBe(wkt.replace(/\s*([(),])\s*/g, '$1'));
		expect(getParser(options('wkt'))({ value: serialized })).toEqual(geojson);
		expect(getParser(options('wkt'))({ value: wkt })).toEqual(geojson);
	});

	test('bbox', () => {
		expect(getBBox(geojson)).toEqual(bbox);
	});
});

describe('lnglat (csv)', () => {
	test('a point is stored as [lng, lat]', () => {
		expect(getSerializer(options('lnglat'))(GEOMETRIES['Point']!.geojson as never)).toEqual([105.85, 21.03]);
	});

	test('csv strings parse to numbers', () => {
		expect(getParser(options('lnglat'))({ value: ['105.85', '21.03'] })).toEqual({
			type: 'Point',
			coordinates: [105.85, 21.03],
		});
	});
});

describe('errors and empty values', () => {
	test('an unknown format throws the translated message', () => {
		expect(() => getSerializer(options('wkb' as GeometryFormat))).toThrow('Invalid format (wkb)');
		expect(() => getGeometryParser(options('wkb' as GeometryFormat))).toThrow('Invalid format (wkb)');
	});

	test('an empty value parses to undefined', () => {
		expect(getParser(options('geojson'))({ value: null })).toBeUndefined();
		expect(getParser(options('wkt'))({ value: '' })).toBeUndefined();
		// wellknown returns null for text that is not WKT
		expect(getParser(options('wkt'))({ value: 'not wkt' })).toBeUndefined();
	});
});

describe('bbox helpers', () => {
	test('expandBBox grows the box to include the coordinate', () => {
		expect(expandBBox([0, 0, 1, 1], [2, -1])).toEqual([0, -1, 2, 1]);
		expect(expandBBox([Infinity, Infinity, -Infinity, -Infinity], [3, 4])).toEqual([3, 4, 3, 4]);
	});

	test('toGeoJSON builds features with the other fields as properties and a common bbox', () => {
		const collection = toGeoJSON(
			[
				{ id: 1, geom: GEOMETRIES['Point']!.geojson },
				{ id: 2, geom: null },
				{ id: 3, geom: GEOMETRIES['MultiPoint']!.geojson },
			],
			{ geometryFormat: 'geojson', geometryField: 'geom' },
		);

		expect(collection.features).toHaveLength(2);
		expect(collection.features[0]).toEqual({
			type: 'Feature',
			properties: { id: 1 },
			geometry: GEOMETRIES['Point']!.geojson,
		});
		expect(collection.bbox).toEqual([1, 2, 105.85, 21.03]);
	});

	test('toGeoJSON without geometries has no bbox', () => {
		expect(toGeoJSON([{ geom: null }], { geometryFormat: 'wkt', geometryField: 'geom' })).toEqual({
			type: 'FeatureCollection',
			features: [],
		});
	});
});

describe('flatten (Multi* and collections become simple geometries)', () => {
	test('simple and empty', () => {
		expect(flatten(undefined)).toEqual([]);
		expect(flatten(GEOMETRIES['Point']!.geojson)).toEqual([GEOMETRIES['Point']!.geojson]);
	});

	test.each(['MultiPoint', 'MultiLineString', 'MultiPolygon'])('%s', (type) => {
		const multi = GEOMETRIES[type]!.geojson as { coordinates: unknown[] };
		expect(flatten(multi as AnyGeometry)).toEqual(
			multi.coordinates.map((coordinates) => ({ type: type.replace('Multi', ''), coordinates })),
		);
	});

	test('GeometryCollection', () => {
		const collection: AnyGeometry = {
			type: 'GeometryCollection',
			geometries: [GEOMETRIES['LineString']!.geojson as never, GEOMETRIES['MultiPoint']!.geojson as never],
		};

		expect(flatten(collection).map((g) => g.type)).toEqual(['LineString', 'Point', 'Point']);
	});
});
