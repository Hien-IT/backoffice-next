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

	test('48px by default, 40px with `small` (sidebar user menu)', () => {
		expect(mount(BoAvatar, { props: { name: 'A' } }).classes()).toContain('size-12');
		const small = mount(BoAvatar, { props: { name: 'A', small: true } });
		expect(small.classes()).toContain('size-10');
		expect(small.get('.material-symbols-rounded').attributes('style')).toContain('font-size: 2rem');
	});

	test('shows the account_circle icon without avatar', () => {
		const icon = mount(BoAvatar, { props: { avatarId: null, name: 'Admin User' } }).get('.material-symbols-rounded');

		expect(icon.text()).toBe('account_circle');
		expect(icon.attributes('aria-label')).toBe('Admin User');
		// The avatar's size wins over the BoIcon size.
		expect(icon.attributes('style')).toBe('font-size: 2.5rem;');
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
