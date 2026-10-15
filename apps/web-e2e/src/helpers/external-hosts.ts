// Feature 014 (FR-112, research R11): the map layout and live preview load outside hosts (tiles, glyphs, Mapbox, the
// preview_url iframe). E2E never reaches the internet: those hosts get small stubs, every other outside host is aborted.
// Local hosts (the web app, the APIs, the parity services, docker names like `idp`) pass through.
import type { Page, Route } from '@playwright/test';

// A transparent 1×1 PNG.
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64',
);

/** Minimal Mapbox style (no source, no layer): enough for maplibre to load the map. */
export const MAPBOX_STYLE = { version: 8, name: 'web-e2e', sources: {}, layers: [] };

export function isLocalHost(hostname: string): boolean {
	return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || !hostname.includes('.');
}

/** What an outside URL gets: a stub, or undefined to abort it. */
export function externalStub(url: URL): Parameters<Route['fulfill']>[0] | undefined {
	// OpenStreetMap tiles come from a, b and c subdomains.
	const host = url.hostname.endsWith('.tile.openstreetmap.org') ? 'tile.openstreetmap.org' : url.hostname;

	switch (host) {
		case 'tile.openstreetmap.org':
			return { status: 200, contentType: 'image/png', body: PNG };
		case 'fonts.openmaptiles.org':
			return { status: 204 };
		case 'api.mapbox.com':
			return url.pathname.startsWith('/geocoding/')
				? { json: { type: 'FeatureCollection', features: [] } }
				: { json: MAPBOX_STYLE };
		case 'preview.example':
			return { status: 200, contentType: 'text/html', body: '<!doctype html><title>preview</title>' };
		default:
			return undefined;
	}
}

export async function stubExternalHosts(page: Page): Promise<void> {
	await page.route('**/*', async (route) => {
		const url = new URL(route.request().url());
		if (!url.protocol.startsWith('http') || isLocalHost(url.hostname)) return route.fallback();
		const stub = externalStub(url);
		return stub ? route.fulfill(stub) : route.abort('blockedbyclient');
	});
}
