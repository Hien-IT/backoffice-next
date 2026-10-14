import { createHead } from '@unhead/vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue } from '../api/sdk.ts';
import { i18n } from '../lang/index.ts';
import { useAppStore } from '../stores/app.ts';
import { useUserStore } from '../stores/user.ts';
import { calls, json, mockApi } from '../test-utils/fetch.ts';
import type { AppUser } from '../types/user.ts';
import TfaSetupRoute from './TfaSetupRoute.vue';

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,QR') } }));
vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

const STORAGE_KEY = 'backoffice-require_tfa_setup';

const user = (values: Partial<AppUser> = {}) =>
	({ id: 'u1', provider: 'default', enforce_tfa: false, tfa_secret: null, last_page: '/files', ...values }) as AppUser;

const answers = {
	'POST /users/me/tfa/generate': { secret: 'SECRET123', otpauth_url: 'otpauth://totp/x?secret=SECRET123' },
	'POST /users/me/tfa/enable': null,
	'GET /users/me': { id: 'u1', last_page: '/files', tfa_secret: 'set' },
	'GET /policies/me/globals': { app_access: true, admin_access: false, enforce_tfa: false },
	'GET /roles/me': [],
};

beforeEach(async () => {
	// No rate limit: the default queue spaces requests 500 ms apart after five.
	await replaceQueue();
	setActivePinia(createPinia());
	useAppStore().authenticated = true;
	useUserStore().currentUser = user();
	localStorage.setItem(STORAGE_KEY, JSON.stringify('u1'));
});
afterEach(() => {
	vi.unstubAllGlobals();
	localStorage.clear();
	document.body.innerHTML = '';
});

async function mountRoute(path = '/tfa-setup') {
	const component = { template: '<p />' };
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/tfa-setup', component: TfaSetupRoute },
			...['/login', '/files', '/settings/project'].map((p) => ({ path: p, component })),
		],
	});
	await router.push(path);
	const wrapper = mount(
		{ template: '<RouterView />' },
		{
			global: { plugins: [router, i18n, createHead()] },
			attachTo: document.body,
		},
	);
	await flushPromises();
	return { wrapper, router };
}

function body(fetch: ReturnType<typeof mockApi>, path: string) {
	const call = fetch.mock.calls.find(([input]) => String(input).endsWith(path));
	return JSON.parse(String(call![1]!.body));
}

describe('TfaSetupRoute', () => {
	test('password → QR code and secret → OTP → enabled, then last_page', async () => {
		const fetch = mockApi(answers);
		const { wrapper, router } = await mountRoute();

		const password = wrapper.get('input[name="password"]');
		expect(wrapper.get(`label[for="${password.attributes('id')}"]`).text()).toBe('Password');
		expect(wrapper.text()).toContain('Enter your password to enable Two-Factor Authentication');
		await password.setValue('pw');
		await wrapper.findAll('form')[0]!.trigger('submit');
		await flushPromises();

		expect(body(fetch, '/users/me/tfa/generate')).toEqual({ password: 'pw' });
		expect(wrapper.get('img[src="data:image/png;base64,QR"]').attributes('alt')).toBe(
			'Scan the code in your authenticator app to finish setting up 2FA',
		);
		expect(wrapper.get('[data-testid="tfa-secret"]').text()).toBe('SECRET123');
		const otp = wrapper.get('input[name="otp"]');
		expect(wrapper.get(`label[for="${otp.attributes('id')}"]`).text()).toBe('One-Time Password');
		expect(document.activeElement).toBe(otp.element);

		const done = wrapper.findAll('button[type="submit"]').at(-1)!;
		expect(done.attributes('disabled')).toBeDefined();
		await otp.setValue('123456');
		expect(done.attributes('disabled')).toBeUndefined();
		await wrapper.findAll('form').at(-1)!.trigger('submit');
		await flushPromises();

		expect(body(fetch, '/users/me/tfa/enable')).toEqual({ otp: '123456', secret: 'SECRET123' });
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
		expect(router.currentRoute.value.fullPath).toBe('/files');
	});

	test('a wrong password shows the translated error and stays on the first step', async () => {
		const error = { errors: [{ message: 'x', extensions: { code: 'INVALID_CREDENTIALS' } }] };
		mockApi({ ...answers, 'POST /users/me/tfa/generate': () => json(error, 401) });
		const { wrapper } = await mountRoute();

		await wrapper.get('input[name="password"]').setValue('wrong');
		await wrapper.findAll('form')[0]!.trigger('submit');
		await flushPromises();

		expect(wrapper.get('[role="alert"]').text()).toContain('Wrong username or password');
		expect(wrapper.get('input[name="password"]').isVisible()).toBe(true);
		expect(wrapper.find('img[src="data:image/png;base64,QR"]').exists()).toBe(false);
	});

	test('a wrong OTP shows the error and keeps the QR step', async () => {
		const error = { errors: [{ message: 'x', extensions: { code: 'INVALID_OTP' } }] };
		mockApi({ ...answers, 'POST /users/me/tfa/enable': () => json(error, 400) });
		const { wrapper, router } = await mountRoute();

		await wrapper.get('input[name="password"]').setValue('pw');
		await wrapper.findAll('form')[0]!.trigger('submit');
		await flushPromises();
		await wrapper.get('input[name="otp"]').setValue('000000');
		await wrapper.findAll('form').at(-1)!.trigger('submit');
		await flushPromises();

		expect(wrapper.get('[role="alert"]').text()).toContain(i18n.global.t('errors.INVALID_OTP'));
		expect(wrapper.get('[data-testid="tfa-secret"]').isVisible()).toBe(true);
		expect(router.currentRoute.value.fullPath).toBe('/tfa-setup');
	});

	test('?redirect is resolved through the API and used after enabling', async () => {
		const fetch = mockApi({ ...answers, 'POST /utils/resolve-redirect': '/settings/project' });
		const { wrapper, router } = await mountRoute('/tfa-setup?redirect=/settings/project');

		expect(calls(fetch)).toContain('POST /utils/resolve-redirect');
		await wrapper.get('input[name="password"]').setValue('pw');
		await wrapper.findAll('form')[0]!.trigger('submit');
		await flushPromises();
		await wrapper.get('input[name="otp"]').setValue('123456');
		await wrapper.findAll('form').at(-1)!.trigger('submit');
		await flushPromises();

		expect(router.currentRoute.value.fullPath).toBe('/settings/project');
	});

	test('cancel clears the request and leaves; no cancel when the role enforces TFA', async () => {
		mockApi(answers);
		const { wrapper, router } = await mountRoute();

		await wrapper.get('button[type="button"]').trigger('click');
		await flushPromises();
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
		expect(router.currentRoute.value.fullPath).toBe('/files');

		useUserStore().currentUser = user({ enforce_tfa: true });
		const enforced = await mountRoute();
		expect(enforced.wrapper.find('button[type="button"]').exists()).toBe(false);
	});

	test('an OAuth user skips the password', async () => {
		const fetch = mockApi(answers);
		useUserStore().currentUser = user({ provider: 'google' });
		const { wrapper } = await mountRoute();

		expect(wrapper.find('input[name="password"]').exists()).toBe(false);
		expect(wrapper.text()).toContain('Set up two-factor authentication to protect your account');
		await wrapper.findAll('form')[0]!.trigger('submit');
		await flushPromises();
		expect(body(fetch, '/users/me/tfa/generate')).toEqual({});
	});

	test('not authenticated goes to /login', async () => {
		mockApi(answers);
		useAppStore().authenticated = false;
		const { router } = await mountRoute();

		expect(router.currentRoute.value.fullPath).toBe('/login');
	});
});
