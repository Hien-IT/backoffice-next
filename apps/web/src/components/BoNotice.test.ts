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
		['success', 'check_circle', 'status', 'border-eh-status-success'],
		['warning', 'warning', 'status', 'border-eh-status-warning'],
		['danger', 'error', 'alert', 'border-eh-status-danger'],
	] as const)('%s uses icon %s, role %s and a status border', (type, icon, role, border) => {
		const wrapper = mount(BoNotice, { props: { type }, slots: { default: 'Text' } });

		expect(wrapper.attributes('role')).toBe(role);
		expect(wrapper.classes()).toContain(border);
		expect(wrapper.get('.material-symbols-rounded').text()).toBe(icon);
		expect(wrapper.get('.text-eh-text-primary').text()).toBe('Text');
	});
});
