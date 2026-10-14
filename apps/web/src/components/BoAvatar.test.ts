import { mount } from '@vue/test-utils';
import { beforeAll, describe, expect, test } from 'vitest';
import { createSdk } from '../api/sdk.ts';
import BoAvatar from './BoAvatar.vue';

beforeAll(() => createSdk('https://api.example.com'));

describe('BoAvatar', () => {
	test('shows the system-medium-cover thumbnail with the name as alt', () => {
		const img = mount(BoAvatar, { props: { avatarId: 'f1', name: 'Admin User', cacheBuster: '2026-10-01' } }).get(
			'img',
		);

		expect(img.attributes('src')).toBe('https://api.example.com/assets/f1?key=system-medium-cover&v=2026-10-01');
		expect(img.attributes('alt')).toBe('Admin User');
	});

	test('shows the account_circle icon without avatar', () => {
		const icon = mount(BoAvatar, { props: { avatarId: null, name: 'Admin User' } }).get('.material-symbols-rounded');

		expect(icon.text()).toBe('account_circle');
		expect(icon.attributes('aria-label')).toBe('Admin User');
	});

	test('falls back to the icon when the image fails, and retries for a new avatar', async () => {
		const wrapper = mount(BoAvatar, { props: { avatarId: 'f1', name: 'A' } });

		await wrapper.get('img').trigger('error');
		expect(wrapper.find('img').exists()).toBe(false);
		expect(wrapper.text()).toBe('account_circle');

		await wrapper.setProps({ avatarId: 'f2' });
		expect(wrapper.get('img').attributes('src')).toContain('/assets/f2');
	});
});
