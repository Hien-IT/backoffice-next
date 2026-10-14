import { mount } from '@vue/test-utils';
import { expect, test, vi } from 'vitest';
import { logout } from '../auth.ts';
import { i18n } from '../lang/index.ts';
import LogoutRoute from './LogoutRoute.vue';

vi.mock('../auth.ts', () => ({ logout: vi.fn() }));

test('logs out on mount and shows a busy progress indicator', () => {
	const wrapper = mount(LogoutRoute, { global: { plugins: [i18n] } });

	expect(logout).toHaveBeenCalledTimes(1);
	expect(logout).toHaveBeenCalledWith();
	expect(wrapper.attributes('aria-busy')).toBe('true');
	expect(wrapper.get('[role="progressbar"]').attributes('aria-label')).toBe('Loading...');
});
