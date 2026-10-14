import type { VueHeadClient } from '@unhead/vue';
import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { replaceQueue } from '../api/sdk.ts';
import { i18n } from '../lang/index.ts';
import { json, mockApi } from '../test-utils/fetch.ts';
import { mountLayout } from '../test-utils/layout.ts';
import AcceptInviteRoute from './AcceptInviteRoute.vue';

const { t } = i18n.global;

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
				{ path: '/accept-invite', component: AcceptInviteRoute },
				{ path: '/login', component: { template: '<p />' } },
			],
		},
	);
}

function body(fetch: ReturnType<typeof mockApi>) {
	const call = fetch.mock.calls.find(([input]) => String(input).endsWith('/users/invite/accept'));
	return JSON.parse(String(call![1]!.body));
}

async function title(head: VueHeadClient<any>) {
	return (await head.resolveTags()).find((tag) => tag.tag === 'title')?.textContent;
}

describe('AcceptInviteRoute', () => {
	test('email from the token, password → POST /users/invite/accept { password, token }, sign in button', async () => {
		const token = jwt({ email: 'invited@example.com', scope: 'invite' });
		const fetch = mockApi({ 'POST /users/invite/accept': () => new Response(null, { status: 204 }) });
		const { wrapper, head } = await mountRoute(`/accept-invite?token=${token}`);

		expect(await title(head)).toBe('Create Account');
		expect(wrapper.get('h1').text()).toBe('Create Account');
		const email = wrapper.get('input[name="email"]');
		expect(wrapper.get(`label[for="${email.attributes('id')}"]`).text()).toBe('Email');
		expect((email.element as HTMLInputElement).value).toBe('invited@example.com');
		expect(email.attributes('disabled')).toBeDefined();
		const password = wrapper.get('input[name="password"]');
		expect(wrapper.get(`label[for="${password.attributes('id')}"]`).text()).toBe('Password');
		expect(password.attributes('autocomplete')).toBe('new-password');
		expect(wrapper.get('button[type="submit"]').text()).toBe('Create');

		await password.setValue('secret');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(body(fetch)).toEqual({ password: 'secret', token });
		expect(wrapper.get('[role="status"]').text()).toContain(t('account_created_successfully'));
		expect(wrapper.text()).not.toContain(t('contact_admin_for_link'));
		expect(wrapper.get('a[href="/login"]').text()).toBe('Sign In');
		wrapper.unmount();
	});

	test('a token that is not a JWT: empty email, the form still posts, the error shows with the contact-admin line', async () => {
		const fetch = mockApi({
			'POST /users/invite/accept': () =>
				json({ errors: [{ message: 'Invalid token', extensions: { code: 'INVALID_TOKEN' } }] }, 403),
		});
		const { wrapper } = await mountRoute('/accept-invite?token=not-a-jwt');

		expect((wrapper.get('input[name="email"]').element as HTMLInputElement).value).toBe('');
		await wrapper.get('input[name="password"]').setValue('pw');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(body(fetch)).toEqual({ password: 'pw', token: 'not-a-jwt' });
		const alert = wrapper.get('[role="alert"]');
		expect(alert.text()).toContain(t('errors.INVALID_TOKEN'));
		expect(alert.text()).toContain(t('contact_admin_for_link'));
		expect(wrapper.get('button[type="submit"]').text()).toBe('Create');
		wrapper.unmount();
	});
});
