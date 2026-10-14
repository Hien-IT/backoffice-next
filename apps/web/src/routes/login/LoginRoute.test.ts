import { createHead } from '@unhead/vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import BoSelect from '../../components/BoSelect.vue';
import { hydrate } from '../../hydrate.ts';
import { i18n } from '../../lang/index.ts';
import { useAppStore } from '../../stores/app.ts';
import { type Info, useServerStore } from '../../stores/server.ts';
import { mockApi } from '../../test-utils/fetch.ts';
import LoginForm from './LoginForm.vue';
import LoginRoute from './LoginRoute.vue';

vi.mock('../../auth.ts', () => ({ login: vi.fn(), logout: vi.fn() }));
vi.mock('../../hydrate.ts', () => ({ hydrate: vi.fn() }));

beforeEach(() => {
	setActivePinia(createPinia());
	vi.mocked(hydrate).mockReset();
});
afterEach(() => vi.unstubAllGlobals());

async function mountRoute(path = '/login') {
	const component = { template: '<p />' };
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/login',
				component: LoginRoute,
				props: (route) => ({
					ssoErrorCode: route.query['error'] ? route.query['code'] : null,
					logoutReason: route.query['reason'],
				}),
			},
			...['/content', '/register', '/logout', '/reset-password', '/users/me'].map((p) => ({ path: p, component })),
		],
	});
	await router.push(path);

	const wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [router, i18n, createHead()] } });
	await flushPromises();
	return { wrapper, router };
}

describe('LoginRoute', () => {
	test('default provider only: title, local form, no select, not authenticated notice', async () => {
		const { wrapper } = await mountRoute();

		expect(wrapper.get('h1').text()).toBe('Sign In');
		expect(wrapper.findComponent(LoginForm).props('provider')).toBe('local');
		expect(wrapper.findComponent(BoSelect).exists()).toBe(false);
		expect(wrapper.text()).toContain('Not Authenticated');
		expect(wrapper.find('a[href="/register"]').exists()).toBe(false);
	});

	test('provider select when there is more than one option; LDAP renders no local form (Phase 6)', async () => {
		useServerStore().auth.providers = [{ name: 'ldap', driver: 'ldap' }];
		const { wrapper } = await mountRoute();
		const select = wrapper.findComponent(BoSelect);

		expect(select.props('items').map((item: { value: string }) => item.value)).toEqual(['local', 'ldap']);

		select.vm.$emit('update:modelValue', 'ldap');
		await flushPromises();
		expect(wrapper.findComponent(LoginForm).exists()).toBe(false);

		select.vm.$emit('update:modelValue', 'local');
		await flushPromises();
		expect(wrapper.findComponent(LoginForm).props('provider')).toBe('local');
	});

	test('disableDefault starts on the first provider; SSO providers are not in the select', async () => {
		const serverStore = useServerStore();
		serverStore.auth.disableDefault = true;
		serverStore.auth.providers = [
			{ name: 'local2', driver: 'local' },
			{ name: 'google', driver: 'openid' },
		];
		const { wrapper } = await mountRoute();

		expect(wrapper.findComponent(BoSelect).exists()).toBe(false);
		expect(wrapper.findComponent(LoginForm).props('provider')).toBe('local2');
	});

	test('?reason shows the logout reason notice; an unknown reason falls back', async () => {
		const expired = await mountRoute('/login?reason=SESSION_EXPIRED');
		expect(expired.wrapper.text()).toContain('Session expired');

		const unknown = await mountRoute('/login?reason=NOPE');
		expect(unknown.wrapper.text()).toContain('Not Authenticated');
	});

	test('register link only with public_registration', async () => {
		useServerStore().info.project = { public_registration: true } as NonNullable<Info['project']>;
		const { wrapper } = await mountRoute();

		expect(wrapper.get('a[href="/register"]').text()).toBe('Sign up now');
		expect(wrapper.text()).toContain("Don't have an account?");
	});

	test('authenticated: continue as, no form; ?continue hydrates and goes to last_page', async () => {
		mockApi({ 'GET /users/me': { first_name: 'Ada', last_name: null, email: 'a@b.co', last_page: '/users/me' } });
		useAppStore().authenticated = true;
		const { wrapper } = await mountRoute();

		expect(wrapper.findComponent(LoginForm).exists()).toBe(false);
		expect(wrapper.text()).toContain('Ada is currently authenticated');
		expect(wrapper.text()).toContain('Authenticated');
		expect(hydrate).not.toHaveBeenCalled();

		const { router } = await mountRoute('/login?continue');
		expect(hydrate).toHaveBeenCalled();
		expect(router.currentRoute.value.fullPath).toBe('/users/me');
	});
});
