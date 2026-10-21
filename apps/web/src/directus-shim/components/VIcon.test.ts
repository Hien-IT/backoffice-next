import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useUserStore } from '../../stores/user.ts';
import VIcon from './VIcon.vue';

beforeEach(() => setActivePinia(createPinia()));

describe('VIcon', () => {
	test('span with the Material Symbols glyph, filled, size and color variables', () => {
		const wrapper = mount(VIcon, {
			props: { name: 'star', filled: true, large: true, color: 'var(--theme--primary)' },
		});

		expect(wrapper.element.tagName).toBe('SPAN');
		expect(wrapper.get('[data-icon="star"]').text()).toBe('star');
		expect(wrapper.get('[data-icon="star"]').attributes('style')).toContain("'FILL' 1");
		expect(wrapper.attributes('style')).toContain('--v-icon-size: 2rem');
		expect(wrapper.attributes('style')).toContain('--v-icon-color: var(--theme--primary)');
		expect(wrapper.attributes('aria-label')).toBeUndefined();
	});

	test('sup, left and right spacing', () => {
		const wrapper = mount(VIcon, { props: { name: 'info', sup: true, left: true } });

		expect(wrapper.attributes('style')).toContain('--v-icon-size: 0.4375rem');
		expect(wrapper.classes()).toEqual(expect.arrayContaining(['align-[0.3125rem]', 'me-1.75']));
		expect(mount(VIcon, { props: { name: 'info', right: true, small: true } }).classes()).toContain('ms-1');
	});

	test('clickable: named button emits click, not when disabled', async () => {
		const wrapper = mount(VIcon, { props: { name: 'close', clickable: true } });

		expect(wrapper.element.tagName).toBe('BUTTON');
		expect(wrapper.attributes('aria-label')).toBe('close');
		await wrapper.trigger('click');
		expect(wrapper.emitted('click')).toHaveLength(1);

		await wrapper.setProps({ disabled: true });
		expect(wrapper.attributes('disabled')).toBeDefined();
		await wrapper.trigger('click');
		expect(wrapper.emitted('click')).toHaveLength(1);
	});

	test('RTL mirrors the directional icons only', () => {
		vi.spyOn(useUserStore(), 'textDirection', 'get').mockReturnValue('rtl');

		expect(
			mount(VIcon, { props: { name: 'arrow_back' } })
				.get('[data-icon]')
				.classes(),
		).toContain('-scale-x-100');
		expect(
			mount(VIcon, { props: { name: 'star' } })
				.get('[data-icon]')
				.classes(),
		).not.toContain('-scale-x-100');
	});
});
