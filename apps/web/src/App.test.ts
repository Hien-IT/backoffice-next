import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, describe, expect, test, vi } from 'vitest';
import App from './App.vue';
import { createAppI18n, messages } from './i18n/index.ts';
import { createAppRouter } from './router/index.ts';

afterEach(() => vi.unstubAllGlobals());

async function mountApp(fetch: ReturnType<typeof vi.fn>, { apiUrl = '/', locale = 'en-US' } = {}) {
	vi.stubGlobal('fetch', fetch);
	const router = createAppRouter();
	await router.push('/');

	const wrapper = mount(App, {
		props: { apiUrl },
		global: { plugins: [createPinia(), router, createAppI18n(locale)] },
	});

	await flushPromises();
	return wrapper;
}

describe('App', () => {
	test('shows Backoffice and the result of GET <apiUrl>/server/ping', async () => {
		const fetch = vi.fn().mockResolvedValue(new Response('pong'));
		const wrapper = await mountApp(fetch, { apiUrl: 'https://api.example.com/base' });

		expect(wrapper.text()).toContain('Backoffice');
		expect(String(fetch.mock.calls[0]![0])).toBe('https://api.example.com/base/server/ping');
		expect(wrapper.get('[data-testid="ping-result"]').text()).toBe('pong');
		expect(wrapper.get('[data-testid="ping-status"]').text()).toBe('Success');
	});

	test('shows the error when the API does not answer', async () => {
		const wrapper = await mountApp(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

		expect(wrapper.get('[data-testid="ping-status"]').text()).toBe('Unexpected Error');
		expect(wrapper.get('[data-testid="ping-result"]').text()).toBe('Failed to fetch');
	});

	test('shows a non-2xx answer as an error', async () => {
		const wrapper = await mountApp(vi.fn().mockResolvedValue(new Response('Service Unavailable', { status: 503 })));

		expect(wrapper.get('[data-testid="ping-status"]').text()).toBe('Unexpected Error');
	});

	test('translates the labels in vi-VN, falling back to en-US for missing keys', async () => {
		const wrapper = await mountApp(vi.fn().mockRejectedValue(new Error('x')), { locale: 'vi-VN' });

		expect(wrapper.text()).toContain('Trạng thái');
		expect(wrapper.get('[data-testid="ping-status"]').text()).toBe('Lỗi Bất Thường');
	});
});

describe('i18n', () => {
	test('loads one file per language and falls back to en-US for an unknown locale', () => {
		expect(Object.keys(messages).sort()).toEqual(['en-US', 'vi-VN']);
		expect(createAppI18n('fr-FR').global.locale.value).toBe('en-US');
		expect(createAppI18n('vi-VN').global.t('success')).toBe('Success');
	});
});
