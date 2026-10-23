// DR has no test for basemap.ts: basemap selection from settings, Mapbox light/dark, styles, tile URLs.
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';
import { useSettingsStore, type Settings } from '../../stores/settings.ts';
import { useUserStore } from '../../stores/user.ts';
import {
	defaultBasemap,
	expandUrl,
	getBasemapSources,
	getMapboxTransformRequest,
	getStyleFromBasemapSource,
} from './basemap.ts';

const custom = { name: 'Custom', type: 'raster' as const, url: 'https://tiles.example.com/{z}/{x}/{y}.png' };

function setSettings(settings: Record<string, unknown> | null) {
	useSettingsStore().settings = settings as Settings | null;
}

beforeEach(() => setActivePinia(createPinia()));

describe('getBasemapSources', () => {
	test('OpenStreetMap only without settings', () => {
		setSettings(null);
		expect(getBasemapSources()).toEqual([defaultBasemap]);
		expect(defaultBasemap.attribution).toBe('© OpenStreetMap contributors');
	});

	test('settings basemaps come after the default', () => {
		setSettings({ basemaps: [custom], mapbox_key: null });
		expect(getBasemapSources()).toEqual([defaultBasemap, custom]);
	});

	test('a Mapbox key puts the Mapbox light style first', () => {
		setSettings({ basemaps: [custom], mapbox_key: 'pk.test' });
		expect(getBasemapSources()).toEqual([
			{ name: 'Mapbox', type: 'style', url: 'mapbox://styles/directus/cktaiz31c509n18nrxj63zdy6' },
			defaultBasemap,
			custom,
		]);
	});

	test('the dark appearance picks the Mapbox dark style', () => {
		setSettings({ mapbox_key: 'pk.test' });
		useUserStore().currentUser = { appearance: 'dark' } as never;
		expect(getBasemapSources()[0]!.url).toBe('mapbox://styles/directus/cl0bombrr001115taz5ilsynw');
	});
});

describe('getStyleFromBasemapSource', () => {
	test('raster: tiles expanded, tile size, attribution, glyphs', () => {
		expect(getStyleFromBasemapSource(defaultBasemap)).toEqual({
			version: 8,
			glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
			layers: [{ id: 'OpenStreetMap', source: 'OpenStreetMap', type: 'raster' }],
			sources: {
				OpenStreetMap: {
					type: 'raster',
					attribution: '© OpenStreetMap contributors',
					tiles: [
						'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
						'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
						'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
					],
					tileSize: 256,
				},
			},
		});
	});

	test('raster without tileSize uses 512', () => {
		const style = getStyleFromBasemapSource(custom) as unknown as { sources: Record<string, { tileSize: number }> };
		expect(style.sources['Custom']!.tileSize).toBe(512);
	});

	test('tile: TileJSON url', () => {
		const style = getStyleFromBasemapSource({ name: 'T', type: 'tile', url: 'https://example.com/tiles.json' });
		expect((style as unknown as { sources: unknown }).sources).toEqual({
			T: { type: 'raster', url: 'https://example.com/tiles.json' },
		});
	});

	test('style: the url itself', () => {
		expect(getStyleFromBasemapSource({ name: 'S', type: 'style', url: 'mapbox://styles/x/y' })).toBe(
			'mapbox://styles/x/y',
		);
	});
});

describe('expandUrl', () => {
	test.each([
		['https://{a-c}.t/{z}', ['https://a.t/{z}', 'https://b.t/{z}', 'https://c.t/{z}']],
		['https://s{1-3}.t/{z}', ['https://s1.t/{z}', 'https://s2.t/{z}', 'https://s3.t/{z}']],
		['https://{x1,y2}.t/{z}', ['https://x1.t/{z}', 'https://y2.t/{z}']],
		['https://t/{z}/{x}/{y}', ['https://t/{z}/{x}/{y}']],
	])('%s', (url, expected) => {
		expect(expandUrl(url)).toEqual(expected);
	});
});

describe('getMapboxTransformRequest (MapLibre 6 has no mapbox:// support)', () => {
	const transform = getMapboxTransformRequest('pk.test');

	test.each([
		['mapbox://styles/user/style1', 'https://api.mapbox.com/styles/v1/user/style1?access_token=pk.test'],
		[
			'mapbox://sprites/user/style1@2x.json',
			'https://api.mapbox.com/styles/v1/user/style1/sprite@2x.json?access_token=pk.test',
		],
		[
			'mapbox://sprites/user/style1.png',
			'https://api.mapbox.com/styles/v1/user/style1/sprite.png?access_token=pk.test',
		],
		[
			'mapbox://fonts/user/Open Sans/0-255.pbf',
			'https://api.mapbox.com/fonts/v1/user/Open Sans/0-255.pbf?access_token=pk.test',
		],
		[
			'mapbox://mapbox.mapbox-streets-v8',
			'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8.json?secure&access_token=pk.test',
		],
		['https://a.tiles.mapbox.com/v4/x/1/2/3.pbf', 'https://a.tiles.mapbox.com/v4/x/1/2/3.pbf?access_token=pk.test'],
		['https://api.mapbox.com/v4/x.json?access_token=other', 'https://api.mapbox.com/v4/x.json?access_token=other'],
		['https://tile.openstreetmap.org/1/2/3.png', 'https://tile.openstreetmap.org/1/2/3.png'],
		['https://evilmapbox.com/x', 'https://evilmapbox.com/x'],
	])('%s', (url, expected) => {
		expect(transform(url)).toEqual({ url: expected });
	});
});
