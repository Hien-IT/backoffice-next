// Ported from directus/app/src/utils/geometry/basemap.ts
// Backoffice: maplibre-gl 6.14.0 instead of 1.15.3 (1.15.3 has a critical XSS advisory, fixed only in >= 6.4.1): the
// style types are the v6 style spec, `mapbox://` URLs need getMapboxTransformRequest; stored values are unaffected.
import type { MapOptions, RequestTransformFunction } from 'maplibre-gl';
import { useSettingsStore } from '../../stores/settings.ts';
import { useThemeConfiguration } from '../../theme/use-theme-configuration.ts';

type Style = Exclude<MapOptions['style'], string | undefined>;
type RasterSource = Extract<Style['sources'][string], { type: 'raster' }>;

export type BasemapSource = {
	name: string;
	type: 'raster' | 'tile' | 'style';
	url: string;
	tileSize?: number;
	attribution?: string;
};

export const defaultBasemap: BasemapSource = {
	name: 'OpenStreetMap',
	type: 'raster',
	url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
	tileSize: 256,
	attribution: '© OpenStreetMap contributors',
};

const baseStyle: Style = {
	version: 8,
	glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
	// Backoffice: required by the v6 style spec, filled below
	sources: {},
	layers: [],
};

export function getBasemapSources(): [BasemapSource] | BasemapSource[] {
	const settingsStore = useSettingsStore();
	const basemaps = (settingsStore.settings?.['basemaps'] as BasemapSource[] | null | undefined) || [];

	if (settingsStore.settings?.['mapbox_key']) {
		return [getDefaultMapboxBasemap(), defaultBasemap, ...basemaps];
	}

	return [defaultBasemap, ...basemaps];
}

export function getStyleFromBasemapSource(basemap: BasemapSource): Style | string {
	if (basemap.type == 'style') {
		return basemap.url;
	} else {
		const style: Style = { ...baseStyle };
		const source: RasterSource = { type: 'raster' };
		if (basemap.attribution) source.attribution = basemap.attribution;

		if (basemap.type == 'raster') {
			source.tiles = expandUrl(basemap.url);
			source.tileSize = basemap.tileSize || 512;
		}

		if (basemap.type == 'tile') {
			source.url = basemap.url;
		}

		style.layers = [{ id: basemap.name, source: basemap.name, type: 'raster' }];
		style.sources = { [basemap.name]: source };
		return style;
	}
}

// Backoffice: exported for the tests.
export function expandUrl(url: string): string[] {
	const urls = [];

	type UrlMatch = [string, string, string] | null;

	let match = /\{([a-z])-([a-z])\}/.exec(url) as UrlMatch;

	if (match) {
		// char range
		const startCharCode = match[1].charCodeAt(0);
		const stopCharCode = match[2].charCodeAt(0);
		let charCode;

		for (charCode = startCharCode; charCode <= stopCharCode; ++charCode) {
			urls.push(url.replace(match[0], String.fromCharCode(charCode)));
		}

		return urls;
	}

	match = /\{(\d+)-(\d+)\}/.exec(url) as UrlMatch;

	if (match) {
		// number range
		const stop = parseInt(match[2], 10);

		for (let i = parseInt(match[1], 10); i <= stop; i++) {
			urls.push(url.replace(match[0], i.toString()));
		}

		return urls;
	}

	match = /\{(([a-z0-9]+)(,([a-z0-9]+))+)\}/.exec(url) as UrlMatch;

	if (match) {
		// csv
		const subdomains = match[1].split(',');

		for (const subdomain of subdomains) {
			urls.push(url.replace(match[0], subdomain));
		}

		return urls;
	}

	urls.push(url);
	return urls;
}

function getDefaultMapboxBasemap(): BasemapSource {
	const defaultMapboxBasemap: BasemapSource = {
		name: 'Mapbox',
		type: 'style',
		url: 'mapbox://styles/directus/cktaiz31c509n18nrxj63zdy6',
	};

	// Backoffice: the appearance of the theme configuration (user, project default, browser) replaces getAppearance.
	if (useThemeConfiguration().darkMode.value) {
		defaultMapboxBasemap.url = 'mapbox://styles/directus/cl0bombrr001115taz5ilsynw';
	}

	return defaultMapboxBasemap;
}

/**
 * Backoffice: MapLibre 1.x loaded `mapbox://` URLs with the `accessToken` map option; MapLibre 2+ dropped both, so
 * the Mapbox style, sprite, glyph and TileJSON URLs are rewritten to the Mapbox API with the settings key, and Mapbox
 * tile URLs get the key too. shortcut: covers the URL kinds of Mapbox styles; extend if a basemap uses others.
 */
export function getMapboxTransformRequest(accessToken: string): RequestTransformFunction {
	const withToken = (url: string) => `${url}${url.includes('?') ? '&' : '?'}access_token=${accessToken}`;

	return (url) => {
		if (!url.startsWith('mapbox://')) {
			const mapboxHost = /^https:\/\/([a-z0-9-]+\.)*mapbox\.com\//.test(url);
			return { url: mapboxHost && !url.includes('access_token=') ? withToken(url) : url };
		}

		const path = url.slice('mapbox://'.length);
		let api: string;

		if (path.startsWith('styles/')) api = `styles/v1/${path.slice('styles/'.length)}`;
		else if (path.startsWith('sprites/'))
			api = path.replace(/^sprites\/([^/]+)\/([^@.]+)(.*)$/, 'styles/v1/$1/$2/sprite$3');
		else if (path.startsWith('fonts/')) api = `fonts/v1/${path.slice('fonts/'.length)}`;
		else api = `v4/${path}.json?secure`;

		return { url: withToken(`https://api.mapbox.com/${api}`) };
	};
}
