import type { VueHeadClient } from '@unhead/vue';
import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { replaceQueue } from '../api/sdk.ts';
import { login, logout } from '../auth.ts';
import { i18n } from '../lang/index.ts';
import { useAppStore } from '../stores/app.ts';
import { calls, json, mockApi } from '../test-utils/fetch.ts';
import { mountLayout } from '../test-utils/layout.ts';
import SharedRoute from './SharedRoute.vue';

vi.mock('../auth.ts', () => ({ login: vi.fn(), logout: vi.fn() }));

const { t } = i18n.global;

const ID = '6b8e1c3a-1111-4222-8333-944455556666';

const share = (values: Record<string, unknown> = {}) => ({
	id: ID,
	collection: 'articles',
	item: '1',
	password: null,
	date_start: null,
	date_end: null,
	max_uses: null,
	times_used: 0,
	...values,
});

const apiError =
	(code: string, status = 400) =>
	() =>
		json({ errors: [{ message: code, extensions: { code } }] }, status);

beforeEach(() => {
	vi.mocked(login).mockReset();
	vi.mocked(logout).mockReset();
	return replaceQueue();
});
afterEach(() => {
	vi.unstubAllGlobals();
	document.body.innerHTML = '';
});

function mountRoute(authenticated = false) {
	return mountLayout(
		{ template: '<RouterView />' },
		{
			path: `/shared/${ID}`,
			routes: [
				{ path: '/shared/:id', component: SharedRoute },
				{ path: '/content/:collection/:item', component: { template: '<p />' } },
			],
			beforeMount: () => {
				useAppStore().authenticated = authenticated;
			},
		},
	);
}

async function title(head: VueHeadClient<any>) {
	return (await head.resolveTags()).find((tag) => tag.tag === 'title')?.textContent;
}

describe('SharedRoute', () => {
	test('password share: uses left, labelled password, share login, then the item route', async () => {
		const fetch = mockApi({
			[`GET /shares/info/${ID}`]: share({ password: '**********', max_uses: 5, times_used: 3 }),
		});
		vi.mocked(login).mockResolvedValue();
		const { wrapper, router, head } = await mountRoute();

		expect(calls(fetch)).toEqual([`GET /shares/info/${ID}`]);
		expect(await title(head)).toBe('Access Shared Page');
		const notice = wrapper.get('[role="status"]');
		expect(notice.text()).toContain('There are currently 2 views remaining');
		expect(notice.classes()).toContain('border-eh-status-warning');
		const password = wrapper.get('input[name="password"]');
		expect(wrapper.get(`label[for="${password.attributes('id')}"]`).text()).toBe('Password');
		expect(password.attributes('placeholder')).toBe(t('shared_enter_passcode'));
		expect(wrapper.get('button[type="submit"]').text()).toBe('Access Shared Page');
		expect(login).not.toHaveBeenCalled();

		await password.setValue('pw');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(login).toHaveBeenCalledWith({ share: true, credentials: { share: ID, password: 'pw' } });
		expect(router.currentRoute.value.fullPath).toBe('/content/articles/1');
		wrapper.unmount();
	});

	test('wrong password shows under the field and stays; other login errors are translated', async () => {
		mockApi({ [`GET /shares/info/${ID}`]: share({ password: '**********' }) });
		vi.mocked(login).mockRejectedValueOnce({ errors: [{ extensions: { code: 'INVALID_CREDENTIALS' } }] });
		const { wrapper, router } = await mountRoute();

		await wrapper.get('input[name="password"]').setValue('wrong');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		const password = wrapper.get('input[name="password"]');
		expect(password.attributes('aria-invalid')).toBe('true');
		expect(wrapper.get(`#${password.attributes('aria-describedby')}`).text()).toContain(
			t('errors.INVALID_CREDENTIALS'),
		);
		expect(router.currentRoute.value.fullPath).toBe(`/shared/${ID}`);

		vi.mocked(login).mockRejectedValueOnce({ errors: [{ extensions: { code: 'REQUESTS_EXCEEDED' } }] });
		await wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(wrapper.get('[role="alert"]').text()).toContain(t('errors.REQUESTS_EXCEEDED'));
		wrapper.unmount();
	});

	test('no password and no use limit: signs in at once and opens the item route', async () => {
		mockApi({ [`GET /shares/info/${ID}`]: share({ item: 'a b' }) });
		vi.mocked(login).mockResolvedValue();
		const { wrapper, router } = await mountRoute();

		expect(login).toHaveBeenCalledWith({ share: true, credentials: { share: ID } });
		expect(router.currentRoute.value.fullPath).toBe('/content/articles/a%20b');
		wrapper.unmount();
	});

	test('expired or unknown share (403/404): not found message and title', async () => {
		mockApi({ [`GET /shares/info/${ID}`]: apiError('FORBIDDEN', 403) });
		const { wrapper, head } = await mountRoute();

		expect(await title(head)).toBe('Unknown Share Page');
		expect(wrapper.text()).toContain(t('share_access_not_found'));
		expect(wrapper.text()).toContain(t('share_access_not_found_desc'));
		expect(wrapper.find('form').exists()).toBe(false);
		expect(login).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	test('used up share: notice without password field or button; other info errors are translated', async () => {
		mockApi({ [`GET /shares/info/${ID}`]: share({ password: '**********', max_uses: 2, times_used: 2 }) });
		const used = await mountRoute();

		expect(used.wrapper.get('[role="status"]').text()).toContain('There are currently 0 views remaining');
		expect(used.wrapper.find('input').exists()).toBe(false);
		expect(used.wrapper.find('button').exists()).toBe(false);
		used.wrapper.unmount();

		mockApi({ [`GET /shares/info/${ID}`]: apiError('INTERNAL_SERVER_ERROR', 500) });
		const failed = await mountRoute();
		expect(failed.wrapper.get('[role="alert"]').text()).toContain(t('errors.INTERNAL_SERVER_ERROR'));
		failed.wrapper.unmount();
	});

	test('already signed in: a user opens the item route, another share is signed out first', async () => {
		mockApi({ [`GET /shares/info/${ID}`]: share({ password: '**********' }), 'GET /users/me': { id: 'u1' } });
		const user = await mountRoute(true);

		expect(user.router.currentRoute.value.fullPath).toBe('/content/articles/1');
		expect(login).not.toHaveBeenCalled();
		user.wrapper.unmount();

		mockApi({
			[`GET /shares/info/${ID}`]: share({ password: '**********' }),
			'GET /users/me': { share: 'other-share' },
		});
		vi.mocked(logout).mockImplementation(async () => {
			useAppStore().authenticated = false;
		});
		const other = await mountRoute(true);

		expect(logout).toHaveBeenCalledWith({ navigate: false });
		expect(other.router.currentRoute.value.fullPath).toBe(`/shared/${ID}`);
		expect(other.wrapper.find('input[name="password"]').exists()).toBe(true);
		other.wrapper.unmount();
	});
});
