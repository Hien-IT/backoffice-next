import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { logout } from '../../auth.ts';
import { hydrate } from '../../hydrate.ts';
import { i18n } from '../../lang/index.ts';
import { calls, json, mockApi } from '../../test-utils/fetch.ts';
import ContinueAs from './ContinueAs.vue';

vi.mock('../../auth.ts', () => ({ logout: vi.fn() }));
vi.mock('../../hydrate.ts', () => ({ hydrate: vi.fn() }));

beforeEach(() => {
	setActivePinia(createPinia());
	vi.mocked(hydrate).mockReset();
	vi.mocked(logout).mockReset();
});
afterEach(() => vi.unstubAllGlobals());

async function mountContinueAs(path = '/login') {
	const component = { template: '<p />' };
	const router = createRouter({
		history: createMemoryHistory(),
		routes: ['/login', '/content', '/logout', '/files', '/users/me'].map((p) => ({ path: p, component })),
	});
	await router.push(path);
	const wrapper = mount(ContinueAs, { global: { plugins: [router, i18n] } });
	await flushPromises();
	return { wrapper, router };
}

describe('ContinueAs', () => {
	test('names the user; continue hydrates and goes to last_page; sign out links to /logout', async () => {
		const fetch = mockApi({ 'GET /users/me': { first_name: 'Ada', last_name: 'Lovelace', last_page: '/files' } });
		const { wrapper, router } = await mountContinueAs();

		expect(calls(fetch)).toEqual(['GET /users/me?fields=email,first_name,last_name,last_page']);
		expect(wrapper.get('b').text()).toBe('Ada Lovelace');
		expect(wrapper.get('a').attributes('href')).toBe('/logout');
		expect(wrapper.get('a').text()).toBe('Sign Out');
		expect(hydrate).not.toHaveBeenCalled();

		await wrapper.get('button').trigger('click');
		await flushPromises();

		expect(hydrate).toHaveBeenCalled();
		expect(router.currentRoute.value.fullPath).toBe('/files');
	});

	test('?redirect wins; /content without last_page', async () => {
		mockApi({ 'GET /users/me': { email: 'a@b.co', last_page: null } });
		const first = await mountContinueAs('/login?continue&redirect=/users/me');
		expect(first.router.currentRoute.value.fullPath).toBe('/users/me');

		const second = await mountContinueAs('/login?continue');
		expect(second.router.currentRoute.value.fullPath).toBe('/content');
	});

	test('a share user is logged out; a failed request shows an alert', async () => {
		mockApi({ 'GET /users/me': { share: 's1' } });
		await mountContinueAs();
		expect(logout).toHaveBeenCalled();

		mockApi({ 'GET /users/me': () => json({ errors: [{ message: 'x', extensions: { code: 'FORBIDDEN' } }] }, 403) });
		const { wrapper } = await mountContinueAs();
		expect(wrapper.get('[role="alert"]').text()).toContain(i18n.global.t('errors.FORBIDDEN'));
	});
});
