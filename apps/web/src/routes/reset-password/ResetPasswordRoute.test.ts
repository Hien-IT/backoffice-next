import type { VueHeadClient } from '@unhead/vue';
import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { replaceQueue } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { json, mockApi } from '../../test-utils/fetch.ts';
import { mountLayout } from '../../test-utils/layout.ts';
import ResetPasswordRoute from './ResetPasswordRoute.vue';

const { t } = i18n.global;

const apiError =
	(code: string, status = 400) =>
	() =>
		json({ errors: [{ message: code, extensions: { code } }] }, status);

/** An unsigned JWT with this payload (the app only decodes it). */
const jwt = (payload: Record<string, unknown>) =>
	`e30.${btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}.sig`;

beforeEach(() => replaceQueue());
afterEach(() => {
	document.body.innerHTML = '';
});

function mountRoute(path: string) {
	return mountLayout(
		{ template: '<RouterView />' },
		{
			path,
			routes: [
				{ path: '/reset-password', component: ResetPasswordRoute },
				{ path: '/login', component: { template: '<p />' } },
			],
		},
	);
}

function body(fetch: ReturnType<typeof mockApi>, path: string) {
	const call = fetch.mock.calls.find(([input]) => String(input).endsWith(path));
	return JSON.parse(String(call![1]!.body));
}

async function title(head: VueHeadClient<any>) {
	return (await head.resolveTags()).find((tag) => tag.tag === 'title')?.textContent;
}

describe('ResetPasswordRoute without token', () => {
	test('email form → POST /auth/password/request { email }, sent notice with the contact-admin line', async () => {
		const fetch = mockApi({ 'POST /auth/password/request': () => new Response(null, { status: 204 }) });
		const { wrapper, head } = await mountRoute('/reset-password');

		expect(await title(head)).toBe('Reset Password');
		expect(wrapper.get('h1').text()).toBe('Reset Password');
		const email = wrapper.get('input[name="email"]');
		expect(wrapper.get(`label[for="${email.attributes('id')}"]`).text()).toBe('Email');
		expect(email.attributes('autocomplete')).toBe('username');
		expect(wrapper.get('a[href="/login"]').text()).toBe('Sign In');
		expect(wrapper.get('button[type="submit"]').text()).toBe('Reset');
		expect(wrapper.text()).not.toContain(t('contact_admin_for_link'));

		await email.setValue('user@example.com');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(body(fetch, '/auth/password/request')).toEqual({ email: 'user@example.com' });
		const notice = wrapper.get('[role="status"]');
		expect(notice.text()).toContain(t('password_reset_sent'));
		expect(notice.text()).toContain(t('contact_admin_for_link'));
		expect(wrapper.find('[role="alert"]').exists()).toBe(false);
		wrapper.unmount();
	});

	test('API errors are translated (rate limit, unknown code)', async () => {
		mockApi({ 'POST /auth/password/request': apiError('REQUESTS_EXCEEDED', 429) });
		const { wrapper } = await mountRoute('/reset-password');

		await wrapper.get('input[name="email"]').setValue('user@example.com');
		await wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(wrapper.get('[role="alert"]').text()).toContain(t('errors.REQUESTS_EXCEEDED'));
		expect(wrapper.find('[role="status"]').exists()).toBe(false);
		wrapper.unmount();

		mockApi({ 'POST /auth/password/request': apiError('SOMETHING_ELSE', 500) });
		const second = await mountRoute('/reset-password');
		await second.wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(second.wrapper.get('[role="alert"]').text()).toContain('Unexpected Error');
		second.wrapper.unmount();
	});
});

describe('ResetPasswordRoute with ?token=', () => {
	test('email from the token, new password → POST /auth/password/reset { password, token }, sign in button', async () => {
		const token = jwt({ email: 'reset@example.com', scope: 'password-reset' });
		const fetch = mockApi({ 'POST /auth/password/reset': () => new Response(null, { status: 204 }) });
		const { wrapper } = await mountRoute(`/reset-password?token=${token}`);

		const email = wrapper.get('input[name="email"]');
		expect((email.element as HTMLInputElement).value).toBe('reset@example.com');
		expect(email.attributes('disabled')).toBeDefined();
		const password = wrapper.get('input[name="password"]');
		expect(wrapper.get(`label[for="${password.attributes('id')}"]`).text()).toBe('Password');
		expect(password.attributes('autocomplete')).toBe('new-password');

		await password.setValue('new-secret');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(body(fetch, '/auth/password/reset')).toEqual({ password: 'new-secret', token });
		expect(wrapper.get('[role="status"]').text()).toContain(t('password_reset_successful'));
		expect(wrapper.get('input[name="password"]').attributes('disabled')).toBeDefined();
		expect(wrapper.find('button[type="submit"]').exists()).toBe(false);
		expect(wrapper.get('a[href="/login"]').text()).toBe('Sign In');
		wrapper.unmount();
	});

	test('a token that is not a JWT leaves the email empty; the API error is translated', async () => {
		const fetch = mockApi({ 'POST /auth/password/reset': apiError('INVALID_TOKEN', 403) });
		const { wrapper } = await mountRoute('/reset-password?token=broken');

		expect((wrapper.get('input[name="email"]').element as HTMLInputElement).value).toBe('');
		await wrapper.get('input[name="password"]').setValue('pw');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(body(fetch, '/auth/password/reset')).toEqual({ password: 'pw', token: 'broken' });
		expect(wrapper.get('[role="alert"]').text()).toContain(t('errors.INVALID_TOKEN'));
		expect(wrapper.get('button[type="submit"]').text()).toBe('Reset');
		wrapper.unmount();
	});
});
