import { afterEach, describe, expect, test, vi } from 'vitest';
import { loadRuntimeConfig } from './runtime-config.ts';

afterEach(() => vi.unstubAllGlobals());

describe('loadRuntimeConfig', () => {
	test('reads config.json next to index.html at run time', async () => {
		const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ apiUrl: 'https://api.example.com' })));
		vi.stubGlobal('fetch', fetch);

		await expect(loadRuntimeConfig()).resolves.toEqual({ apiUrl: 'https://api.example.com' });
		expect(fetch).toHaveBeenCalledWith('/admin/config.json', { cache: 'no-store' });
	});

	test('falls back to / when config.json is missing', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 })));

		await expect(loadRuntimeConfig()).resolves.toEqual({ apiUrl: '/' });
	});

	test('falls back to / when config.json is invalid or the request fails', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{ "apiUrl": 1 }')));
		await expect(loadRuntimeConfig()).resolves.toEqual({ apiUrl: '/' });

		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
		await expect(loadRuntimeConfig()).resolves.toEqual({ apiUrl: '/' });
	});
});
