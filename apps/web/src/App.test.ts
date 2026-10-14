import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createHead } from '@unhead/vue';
import App from './App.vue';
import { i18n } from './lang/index.ts';
import { useAppStore } from './stores/app.ts';
import { useServerStore } from './stores/server.ts';

beforeEach(() => {
	setActivePinia(createPinia());
	document.head.innerHTML = '<style id="custom-css"></style>';
	document.body.innerHTML = '';
});

async function mountApp() {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/', component: { template: '<p data-testid="route">route</p>' } }],
	});

	await router.push('/');

	const wrapper = mount(App, { global: { plugins: [router, i18n, createHead()] }, attachTo: document.body });
	await flushPromises();
	return wrapper;
}

describe('App', () => {
	test('shows the route', async () => {
		const wrapper = await mountApp();
		expect(wrapper.find('[data-testid="route"]').exists()).toBe(true);
	});

	test('shows a progress indicator and no route while hydrating', async () => {
		useAppStore().hydrating = true;
		const wrapper = await mountApp();
		expect(wrapper.find('[role="progressbar"]').exists()).toBe(true);
		expect(wrapper.find('[data-testid="route"]').exists()).toBe(false);
	});

	test('puts custom_css of the settings in #custom-css as text', async () => {
		useServerStore().info.project = { custom_css: '.a { color: red } </style><script>x()</script>' } as never;
		await mountApp();

		const style = document.getElementById('custom-css')!;
		expect(style.textContent).toBe('.a { color: red } </style><script>x()</script>');
		expect(style.children).toHaveLength(0);
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
