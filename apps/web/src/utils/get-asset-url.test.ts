import { afterEach, describe, expect, test, vi } from 'vitest';
import { createSdk } from '../api/sdk.ts';
import { getAssetUrl } from './get-asset-url.ts';

afterEach(() => vi.useRealTimers());

describe('getAssetUrl', () => {
	test('builds the URL on the API base of config.json', () => {
		createSdk('https://api.example.com/base');

		expect(getAssetUrl('abc')).toBe('https://api.example.com/base/assets/abc');
		expect(getAssetUrl('abc', { imageKey: 'system-medium-cover', cacheBuster: '2026-01-01' })).toBe(
			'https://api.example.com/base/assets/abc?key=system-medium-cover&v=2026-01-01',
		);
	});

	test('adds params, download and a time cache buster, skipping empty params', () => {
		createSdk('/');
		vi.useFakeTimers({ now: 1000 });

		const url = new URL(
			getAssetUrl('abc', { isDownload: true, cacheBuster: true, width: 10, height: undefined, fit: null }),
		);

		expect(url.origin + url.pathname).toBe(`${window.location.origin}/assets/abc`);
		expect([...url.searchParams]).toEqual([
			['width', '10'],
			['download', ''],
			['v', '1000'],
		]);
	});
});
