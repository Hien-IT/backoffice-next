import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import App from './App.vue';
import { i18n } from './lang/index.ts';
import { useAppStore } from './stores/app.ts';

beforeEach(() => setActivePinia(createPinia()));

async function mountApp() {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/', component: { template: '<p data-testid="route">route</p>' } }],
	});

	await router.push('/');

	const wrapper = mount(App, { global: { plugins: [router, i18n] } });
	await flushPromises();
	return wrapper;
}

describe('App', () => {
	test('shows the route', async () => {
		const wrapper = await mountApp();
		expect(wrapper.find('[data-testid="route"]').exists()).toBe(true);
	});

	test('shows a progress indicator while hydrating', async () => {
		useAppStore().hydrating = true;
		const wrapper = await mountApp();
		expect(wrapper.find('[role="progressbar"]').exists()).toBe(true);
	});

	test('shows the unexpected error screen with the API message and a reload button (FR-003)', async () => {
		const reload = vi.fn();
		vi.stubGlobal('location', { ...window.location, reload });
		useAppStore().error = { errors: [{ message: 'Service unavailable' }] };

		const wrapper = await mountApp();

		expect(wrapper.text()).toContain('Unexpected Error');
		expect(wrapper.get('[data-testid="app-error"]').text()).toBe('Service unavailable');
		expect(wrapper.find('[data-testid="route"]').exists()).toBe(false);

		await wrapper.get('button').trigger('click');
		expect(reload).toHaveBeenCalled();
		vi.unstubAllGlobals();
	});

	test('shows the message of a plain error', async () => {
		useAppStore().error = new TypeError('Failed to fetch');
		const wrapper = await mountApp();
		expect(wrapper.get('[data-testid="app-error"]').text()).toBe('Failed to fetch');
	});
});
