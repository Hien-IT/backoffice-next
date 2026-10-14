import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { login } from '../../auth.ts';
import { i18n } from '../../lang/index.ts';
import { useUserStore } from '../../stores/user.ts';
import type { AppUser } from '../../types/user.ts';
import LoginForm from './LoginForm.vue';

vi.mock('../../auth.ts', () => ({ login: vi.fn() }));

const apiError = (code: string) => ({ errors: [{ message: code, extensions: { code } }] });

beforeEach(() => {
	setActivePinia(createPinia());
	vi.mocked(login).mockReset();
});

async function mountForm(path = '/login', props: Record<string, unknown> = {}) {
	const component = { template: '<p />' };
	const router = createRouter({
		history: createMemoryHistory(),
		routes: ['/login', '/content', '/reset-password', '/settings/project', '/users/me'].map((p) => ({
			path: p,
			component,
		})),
	});
	await router.push(path);

	const wrapper = mount(LoginForm, { props, global: { plugins: [router, i18n] }, attachTo: document.body });
	return { wrapper, router };
}

async function fill(wrapper: Awaited<ReturnType<typeof mountForm>>['wrapper'], email: string, password: string) {
	await wrapper.get('input[name="email"]').setValue(email);
	await wrapper.get('input[name="password"]').setValue(password);
}

describe('LoginForm', () => {
	test('labelled fields with autocomplete, forgot password link', async () => {
		const { wrapper } = await mountForm();
		const email = wrapper.get('input[name="email"]');
		const password = wrapper.get('input[name="password"]');

		expect(wrapper.get(`label[for="${email.attributes('id')}"]`).text()).toBe('Email');
		expect(email.attributes('autocomplete')).toBe('username');
		expect(wrapper.get(`label[for="${password.attributes('id')}"]`).text()).toBe('Password');
		expect(password.attributes('autocomplete')).toBe('current-password');
		expect(wrapper.get('a').attributes('href')).toBe('/reset-password');
		expect(wrapper.get('button[type="submit"]').text()).toBe('Sign In');
		wrapper.unmount();
	});

	test('sends the credentials and provider through login, then goes to last_page', async () => {
		const { wrapper, router } = await mountForm('/login', { provider: 'local2' });
		vi.mocked(login).mockImplementation(async () => {
			useUserStore().currentUser = { last_page: '/users/me' } as AppUser;
		});

		await fill(wrapper, 'admin@example.com', 'secret');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(login).toHaveBeenCalledWith({
			provider: 'local2',
			credentials: { email: 'admin@example.com', password: 'secret' },
		});
		expect(router.currentRoute.value.fullPath).toBe('/users/me');
		wrapper.unmount();
	});

	test('?redirect wins over last_page; default is /content', async () => {
		vi.mocked(login).mockResolvedValue();
		const first = await mountForm('/login?redirect=/settings/project');
		await fill(first.wrapper, 'a@b.co', 'x');
		await first.wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(first.router.currentRoute.value.fullPath).toBe('/settings/project');
		first.wrapper.unmount();

		const second = await mountForm();
		await fill(second.wrapper, 'a@b.co', 'x');
		await second.wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(second.router.currentRoute.value.fullPath).toBe('/content');
		second.wrapper.unmount();
	});

	test('INVALID_OTP shows the OTP field and keeps email and password; the next submit sends the otp', async () => {
		const { wrapper } = await mountForm();
		vi.mocked(login).mockRejectedValueOnce(apiError('INVALID_OTP'));

		await fill(wrapper, 'a@b.co', 'pw');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		const otp = wrapper.get('input[name="otp"]');
		expect(wrapper.get(`label[for="${otp.attributes('id')}"]`).text()).toBe('One-Time Password');
		expect(otp.attributes('autocomplete')).toBe('one-time-code');
		expect(document.activeElement).toBe(otp.element);
		expect((wrapper.get('input[name="email"]').element as HTMLInputElement).value).toBe('a@b.co');
		expect((wrapper.get('input[name="password"]').element as HTMLInputElement).value).toBe('pw');
		expect(wrapper.find('[role="alert"]').exists()).toBe(false);

		vi.mocked(login).mockRejectedValueOnce(apiError('INVALID_OTP'));
		await otp.setValue('123456');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(vi.mocked(login).mock.calls[1]![0]).toEqual({
			provider: 'local',
			credentials: { email: 'a@b.co', password: 'pw', otp: '123456' },
		});
		// A second INVALID_OTP is an error like any other
		expect(wrapper.get('[role="alert"]').text()).toContain(i18n.global.t('errors.INVALID_OTP'));
		wrapper.unmount();
	});

	test('other errors show translated in an alert; an invalid email does not call the API', async () => {
		const { wrapper } = await mountForm();

		await fill(wrapper, 'not-an-email', 'pw');
		await wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(login).not.toHaveBeenCalled();
		expect(wrapper.get('[role="alert"]').text()).toContain(i18n.global.t('errors.INVALID_CREDENTIALS'));

		vi.mocked(login).mockRejectedValueOnce(apiError('REQUESTS_EXCEEDED'));
		await fill(wrapper, 'a@b.co', 'pw');
		await wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(wrapper.get('[role="alert"]').text()).toContain(i18n.global.t('errors.REQUESTS_EXCEEDED'));

		vi.mocked(login).mockRejectedValueOnce(new TypeError('Failed to fetch'));
		await wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(wrapper.get('[role="alert"]').text()).toContain('Unexpected Error');
		wrapper.unmount();
	});

	test('Enter submits: implicit submission through the submit button (requestSubmit)', async () => {
		vi.mocked(login).mockResolvedValue();
		const { wrapper } = await mountForm();

		await fill(wrapper, 'a@b.co', 'pw');
		// happy-dom has no implicit submission; Enter in a field of a form with a submit button calls requestSubmit.
		(wrapper.get('form').element as HTMLFormElement).requestSubmit();
		await flushPromises();

		expect(login).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	test('shows the loading state while logging in', async () => {
		let resolve!: () => void;
		vi.mocked(login).mockReturnValue(new Promise<void>((r) => (resolve = r)));
		const { wrapper } = await mountForm();

		await fill(wrapper, 'a@b.co', 'pw');
		await wrapper.get('form').trigger('submit');

		expect(wrapper.get('button[type="submit"]').attributes('aria-busy')).toBe('true');
		resolve();
		await flushPromises();
		wrapper.unmount();
	});
});
