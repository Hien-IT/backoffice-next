import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import BoNotice from './BoNotice.vue';

describe('BoNotice', () => {
	test('info is a status with the info icon and the slot text', () => {
		const wrapper = mount(BoNotice, { slots: { default: 'Hello' } });

		expect(wrapper.attributes('role')).toBe('status');
		expect(wrapper.get('.material-symbols-rounded').text()).toBe('info');
		expect(wrapper.text()).toContain('Hello');
	});

	test.each([
		['success', 'check_circle', 'status', 'border-success-500'],
		['warning', 'warning', 'status', 'border-warning-500'],
		['danger', 'error', 'alert', 'border-error-500'],
	] as const)('%s uses icon %s, role %s and a status border', (type, icon, role, border) => {
		const wrapper = mount(BoNotice, { props: { type }, slots: { default: 'Text' } });

		expect(wrapper.attributes('role')).toBe(role);
		expect(wrapper.classes()).toContain(border);
		expect(wrapper.get('.material-symbols-rounded').text()).toBe(icon);
		expect(wrapper.get('.text-sm').text()).toBe('Text');
	});

	test('normal is a gray static note; icon replaces the icon of the type', () => {
		const wrapper = mount(BoNotice, { props: { type: 'normal', icon: 'bolt' }, slots: { default: 'Text' } });

		expect(wrapper.attributes('role')).toBeUndefined();
		expect(wrapper.classes()).toContain('bg-gray-50');
		expect(wrapper.get('.material-symbols-rounded').text()).toBe('bolt');
	});
});
