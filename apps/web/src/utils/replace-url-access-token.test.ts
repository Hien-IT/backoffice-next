import { beforeEach, expect, test } from 'vitest';
import { createSdk } from '../api/sdk.ts';
import { replaceUrlAccessToken } from './replace-url-access-token.ts';

beforeEach(() => {
	createSdk('https://api.example.com/');
});

test('sets, replaces and removes the access token of asset URLs', () => {
	expect(replaceUrlAccessToken('https://api.example.com/assets/abc', 't1')).toBe(
		'https://api.example.com/assets/abc?access_token=t1',
	);

	expect(replaceUrlAccessToken('https://api.example.com/assets/abc?width=10&access_token=old', 't2')).toBe(
		'https://api.example.com/assets/abc?width=10&access_token=t2',
	);

	expect(replaceUrlAccessToken('https://api.example.com/assets/abc?access_token=old', null)).toBe(
		'https://api.example.com/assets/abc',
	);

	expect(replaceUrlAccessToken('https://api.example.com/assets/abc?width=10&access_token=old', undefined)).toBe(
		'https://api.example.com/assets/abc?width=10',
	);
});

test('leaves other URLs untouched', () => {
	expect(replaceUrlAccessToken('https://cdn.example.com/image.png', 't1')).toBe('https://cdn.example.com/image.png');
});
