import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createSdk } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import type { AuthProvider } from '../../types/login.ts';
import SsoLinks from './SsoLinks.vue';

const PROVIDERS: AuthProvider[] = [
	{ name: 'ldap', driver: 'ldap' },
	{ name: 'local2', driver: 'local' },
	{ name: 'keycloak', driver: 'openid', label: 'Company SSO', icon: 'key' },
	{ name: 'github_oauth', driver: 'oauth2' },
	{ name: 'okta', driver: 'saml' },
];

const API = 'http://127.0.0.1:8955/api/';
const APP = 'http://localhost:8181/admin/login';

const link = (name: string, redirect: string, otp?: string) => {
	const url = new URL(`auth/login/${name}`, API);
	url.searchParams.set('redirect', redirect);
	if (otp) url.searchParams.set('otp', otp);
	return url.toString();
};

let hrefSet: ReturnType<typeof vi.fn>;

beforeEach(() => {
	createSdk(API);
	localStorage.clear();
	sessionStorage.clear();
	hrefSet = vi.fn();
	vi.spyOn(window.location, 'href', 'set').mockImplementation(hrefSet);
});
afterEach(() => vi.restoreAllMocks());

async function mountLinks(query = '', props: { providers?: AuthProvider[]; ssoErrorCode?: string | null } = {}) {
	(window as any).happyDOM.setURL(APP + query);
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/login', component: { template: '<p />' } }],
	});
	await router.push('/login' + query);

	const wrapper = mount(SsoLinks, {
		props: { providers: PROVIDERS, ...props },
		global: { plugins: [router, i18n] },
		attachTo: document.body,
	});
	await flushPromises();
	return wrapper;
}

describe('SsoLinks', () => {
	test('one link per SSO driver (openid, oauth2, saml) to <apiUrl>auth/login/<name>?redirect=<login URL>?continue', async () => {
		const wrapper = await mountLinks();
		const links = wrapper.findAll('a');

		// The icon is aria-hidden: the accessible name is the label only
		expect(links.map((a) => a.findAll('span').at(-1)!.text())).toEqual([
			'Log In with Company SSO',
			'Log In with GitHub Oauth',
			'Log In with Okta',
		]);
		expect(links[0]!.attributes('href')).toBe(link('keycloak', `${APP}?continue=`));
		expect(links[0]!.attributes('href')).toBe(
			'http://127.0.0.1:8955/api/auth/login/keycloak?redirect=http%3A%2F%2Flocalhost%3A8181%2Fadmin%2Flogin%3Fcontinue%3D',
		);
		expect(links[1]!.attributes('href')).toBe(link('github_oauth', `${APP}?continue=`));
		expect(links[0]!.text()).toContain('key');
		expect(links[1]!.text()).toContain('account_circle');
		expect(wrapper.find('[role="alert"]').exists()).toBe(false);
		wrapper.unmount();
	});

	test('the redirect keeps the current query', async () => {
		const wrapper = await mountLinks('?redirect=%2Fusers%2Fme');

		expect(wrapper.get('a').attributes('href')).toBe(link('keycloak', `${APP}?redirect=%2Fusers%2Fme&continue=`));
		wrapper.unmount();
	});

	test('no SSO provider renders nothing', async () => {
		const wrapper = await mountLinks('', { providers: PROVIDERS.slice(0, 2) });

		expect(wrapper.html()).toBe('<!--v-if-->');
		wrapper.unmount();
	});

	test('a click saves the provider in localStorage and keeps the link navigation', async () => {
		const wrapper = await mountLinks();
		const prevent = (event: Event) => event.preventDefault();
		document.addEventListener('click', prevent);

		await wrapper.findAll('a')[1]!.trigger('click');

		expect(localStorage.getItem('backoffice-sso-provider')).toBe('github_oauth');
		document.removeEventListener('click', prevent);
		wrapper.unmount();
	});

	test('?error&code and ?reason=<CODE> show the translated error; SIGN_OUT and SESSION_EXPIRED do not', async () => {
		const code = await mountLinks('?error=true&code=INVALID_CREDENTIALS', { ssoErrorCode: 'INVALID_CREDENTIALS' });
		expect(code.get('[role="alert"]').text()).toContain(i18n.global.t('errors.INVALID_CREDENTIALS'));
		code.unmount();

		const reason = await mountLinks('?reason=INVALID_PROVIDER');
		expect(reason.get('[role="alert"]').text()).toContain(i18n.global.t('errors.INVALID_PROVIDER'));
		reason.unmount();

		const signOut = await mountLinks('?reason=SIGN_OUT');
		expect(signOut.find('[role="alert"]').exists()).toBe(false);
		signOut.unmount();
	});

	test('?reason=INVALID_OTP: OTP field under the saved provider, 6 digits resend through that provider with otp', async () => {
		localStorage.setItem('backoffice-sso-provider', 'github_oauth');
		const wrapper = await mountLinks('?reason=INVALID_OTP');

		expect(wrapper.find('[role="alert"]').exists()).toBe(false);
		const otp = wrapper.get('input[name="otp"]');
		expect(wrapper.get(`label[for="${otp.attributes('id')}"]`).text()).toBe('One-Time Password');
		expect(otp.attributes('autocomplete')).toBe('one-time-code');
		expect(document.activeElement).toBe(otp.element);
		// The field sits right after the saved provider's link
		expect(otp.element.closest('div')!.previousElementSibling!.textContent).toContain('GitHub Oauth');

		await otp.setValue('12345');
		await otp.trigger('keydown', { key: 'Enter' });
		expect(hrefSet).not.toHaveBeenCalled();

		await otp.setValue('123456');
		await flushPromises();

		expect(sessionStorage.getItem('sso_otp_attempted')).toBe('1');
		expect(hrefSet).toHaveBeenCalledTimes(1);
		expect(hrefSet).toHaveBeenCalledWith(link('github_oauth', `${APP}?reason=INVALID_OTP&continue=`, '123456'));

		// Enter while submitting does not navigate twice
		await otp.trigger('keydown', { key: 'Enter' });
		expect(hrefSet).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	test('?reason=INVALID_OTP after an attempt shows the inline error once; no saved provider shows no field', async () => {
		localStorage.setItem('backoffice-sso-provider', 'keycloak');
		sessionStorage.setItem('sso_otp_attempted', '1');
		const attempted = await mountLinks('?reason=INVALID_OTP');

		expect(attempted.get('[role="alert"]').text()).toContain(i18n.global.t('errors.INVALID_OTP'));
		expect(sessionStorage.getItem('sso_otp_attempted')).toBeNull();
		attempted.unmount();

		localStorage.clear();
		const unsaved = await mountLinks('?reason=INVALID_OTP');
		expect(unsaved.find('input[name="otp"]').exists()).toBe(false);
		unsaved.unmount();
	});
});
