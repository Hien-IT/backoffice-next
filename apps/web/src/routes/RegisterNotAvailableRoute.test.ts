import { describe, expect, test } from 'vitest';
import { i18n } from '../lang/index.ts';
import { mountLayout } from '../test-utils/layout.ts';
import RegisterNotAvailableRoute from './RegisterNotAvailableRoute.vue';

describe('RegisterNotAvailableRoute', () => {
	test('not available message, no form, link to sign in, title Register', async () => {
		const { wrapper, head } = await mountLayout(RegisterNotAvailableRoute, { path: '/register' });

		expect((await head.resolveTags()).find((tag) => tag.tag === 'title')?.textContent).toBe('Register');
		expect(wrapper.get('h1').text()).toBe(i18n.global.t('register_not_available_title'));
		expect(wrapper.text()).toContain(i18n.global.t('register_not_available'));
		expect(wrapper.find('form').exists()).toBe(false);
		expect(wrapper.get('a[href="/login"]').text()).toBe('Sign In');
		wrapper.unmount();
	});
});
