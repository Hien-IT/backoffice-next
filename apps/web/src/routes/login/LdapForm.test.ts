import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { login } from '../../auth.ts';
import { i18n } from '../../lang/index.ts';
import { useUserStore } from '../../stores/user.ts';
import type { AppUser } from '../../types/user.ts';
import LdapForm from './LdapForm.vue';

vi.mock('../../auth.ts', () => ({ login: vi.fn() }));

const apiError = (code: string) => ({ errors: [{ message: code, extensions: { code } }] });

beforeEach(() => {
	setActivePinia(createPinia());
	vi.mocked(login).mockReset();
});

async function mountForm(path = '/login', provider = 'ldap') {
	const component = { template: '<p />' };
	const router = createRouter({
		history: createMemoryHistory(),
		routes: ['/login', '/content', '/settings/project', '/users/me'].map((p) => ({ path: p, component })),
	});
	await router.push(path);

	const wrapper = mount(LdapForm, {
		props: { provider },
		global: { plugins: [router, i18n] },
		attachTo: document.body,
	});
	return { wrapper, router };
}

async function fill(wrapper: Awaited<ReturnType<typeof mountForm>>['wrapper'], identifier: string, password: string) {
	await wrapper.get('input[name="identifier"]').setValue(identifier);
	await wrapper.get('input[name="password"]').setValue(password);
}

describe('LdapForm', () => {
	test('labelled identifier and password fields with autocomplete', async () => {
		const { wrapper } = await mountForm();
		const identifier = wrapper.get('input[name="identifier"]');
		const password = wrapper.get('input[name="password"]');

		expect(wrapper.get(`label[for="${identifier.attributes('id')}"]`).text()).toBe('Identifier');
		expect(identifier.attributes('autocomplete')).toBe('username');
		expect(document.activeElement).toBe(identifier.element);
		expect(wrapper.get(`label[for="${password.attributes('id')}"]`).text()).toBe('Password');
		expect(password.attributes('autocomplete')).toBe('current-password');
		expect(wrapper.get('button[type="submit"]').text()).toBe('Sign In');
		wrapper.unmount();
	});

	test('sends identifier, password and provider, then goes to ?redirect, last_page or /content', async () => {
		vi.mocked(login).mockImplementation(async () => {
			useUserStore().currentUser = { last_page: '/users/me' } as AppUser;
		});
		const first = await mountForm();
		await fill(first.wrapper, 'jdoe', 'secret');
		await first.wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(login).toHaveBeenCalledWith({ provider: 'ldap', credentials: { identifier: 'jdoe', password: 'secret' } });
		expect(first.router.currentRoute.value.fullPath).toBe('/users/me');
		first.wrapper.unmount();

		const second = await mountForm('/login?redirect=/settings/project');
		await fill(second.wrapper, 'jdoe', 'secret');
		await second.wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(second.router.currentRoute.value.fullPath).toBe('/settings/project');
		second.wrapper.unmount();

		setActivePinia(createPinia());
		vi.mocked(login).mockReset().mockResolvedValue();
		const third = await mountForm();
		await fill(third.wrapper, 'jdoe', 'secret');
		await third.wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(third.router.currentRoute.value.fullPath).toBe('/content');
		third.wrapper.unmount();
	});

	test('empty fields do not call the API', async () => {
		const { wrapper } = await mountForm();
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(login).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	test('INVALID_OTP shows the OTP field and keeps the inputs; the next submit sends the otp', async () => {
		const { wrapper } = await mountForm();
		vi.mocked(login).mockRejectedValueOnce(apiError('INVALID_OTP'));

		await fill(wrapper, 'jdoe', 'pw');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		const otp = wrapper.get('input[name="otp"]');
		expect(wrapper.get(`label[for="${otp.attributes('id')}"]`).text()).toBe('One-Time Password');
		expect(otp.attributes('autocomplete')).toBe('one-time-code');
		expect(document.activeElement).toBe(otp.element);
		expect((wrapper.get('input[name="identifier"]').element as HTMLInputElement).value).toBe('jdoe');
		expect((wrapper.get('input[name="password"]').element as HTMLInputElement).value).toBe('pw');
		expect(wrapper.find('[role="alert"]').exists()).toBe(false);

		vi.mocked(login).mockRejectedValueOnce(apiError('INVALID_OTP'));
		await otp.setValue('123456');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(vi.mocked(login).mock.calls[1]![0]).toEqual({
			provider: 'ldap',
			credentials: { identifier: 'jdoe', password: 'pw', otp: '123456' },
		});
		expect(wrapper.get('[role="alert"]').text()).toContain(i18n.global.t('errors.INVALID_OTP'));

		// Changing the identifier hides the OTP field again
		await wrapper.get('input[name="identifier"]').setValue('other');
		expect(wrapper.find('input[name="otp"]').exists()).toBe(false);
		wrapper.unmount();
	});

	test('errors show translated in an alert; a provider change resets the form', async () => {
		const { wrapper } = await mountForm();

		vi.mocked(login).mockRejectedValueOnce(apiError('INVALID_CREDENTIALS'));
		await fill(wrapper, 'jdoe', 'pw');
		await wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(wrapper.get('[role="alert"]').text()).toContain(i18n.global.t('errors.INVALID_CREDENTIALS'));

		vi.mocked(login).mockRejectedValueOnce(new TypeError('Failed to fetch'));
		await wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(wrapper.get('[role="alert"]').text()).toContain('Unexpected Error');

		await wrapper.setProps({ provider: 'ldap2' });
		expect(wrapper.find('[role="alert"]').exists()).toBe(false);
		expect((wrapper.get('input[name="identifier"]').element as HTMLInputElement).value).toBe('');
		wrapper.unmount();
	});
});
