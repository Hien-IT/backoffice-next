import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { calls, json, mockApi } from '../test-utils/fetch.ts';
import { useSafeRedirect } from './use-safe-redirect.ts';

beforeEach(() => {
	setActivePinia(createPinia());
	(window as any).happyDOM.setURL('http://app.test/admin/tfa-setup');
});
afterEach(() => vi.unstubAllGlobals());

async function resolve(answer: unknown, value: string | null = '/x', provider?: string) {
	const fetch = mockApi({ 'POST /utils/resolve-redirect': answer });
	const { redirect, resolveRedirect } = useSafeRedirect();
	await resolveRedirect(value, provider);
	return { redirect: redirect.value, fetch };
}

describe('useSafeRedirect', () => {
	test('posts redirect and provider and keeps a relative answer', async () => {
		const { redirect, fetch } = await resolve('/settings/project', '/settings/project', 'google');

		expect(redirect).toBe('/settings/project');
		expect(calls(fetch)).toEqual(['POST /utils/resolve-redirect']);
		expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body))).toEqual({
			redirect: '/settings/project',
			provider: 'google',
		});
	});

	test('an absolute URL on the app root becomes an app path', async () => {
		expect((await resolve('http://app.test/admin/content/articles')).redirect).toBe('/content/articles');
	});

	test('an absolute URL elsewhere stays absolute', async () => {
		expect((await resolve('https://other.test/page')).redirect).toBe('https://other.test/page');
	});

	test('an error or an empty answer gives null; no value sends nothing', async () => {
		const rejected = () => json({ errors: [{ message: 'x', extensions: { code: 'INVALID_PAYLOAD' } }] }, 400);
		expect((await resolve(rejected, 'https://evil.test')).redirect).toBeNull();
		expect((await resolve(null)).redirect).toBeNull();

		const { fetch } = await resolve('/x', null);
		expect(fetch).not.toHaveBeenCalled();
	});
});
