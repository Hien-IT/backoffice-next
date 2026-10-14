import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { i18n } from '../lang/index.ts';
import BoChip from './BoChip.vue';

const global = { plugins: [i18n] };

describe('BoChip', () => {
	test('text with the base colors and no button by default', () => {
		const wrapper = mount(BoChip, { props: { text: 'Draft' }, global });

		expect(wrapper.text()).toBe('Draft');
		expect(wrapper.classes()).toContain('bg-gray-100');
		expect(wrapper.classes()).toContain('text-theme-xs');
		expect(wrapper.find('button').exists()).toBe(false);
	});

	test('icon, data colors by style, medium size', () => {
		const wrapper = mount(BoChip, {
			props: {
				text: 'Hot',
				icon: 'local_fire_department',
				color: 'var(--color-white)',
				background: 'var(--color-error-600)',
				size: 'md',
			},
			global,
		});

		expect(wrapper.text()).toContain('local_fire_department');
		expect(wrapper.attributes('style')).toContain('background-color: var(--color-error-600)');
		expect(wrapper.attributes('style')).toContain('color: var(--color-white)');
		expect(wrapper.classes()).not.toContain('bg-gray-100');
		expect(wrapper.classes()).toContain('text-sm');
	});

	test('the leading slot replaces the icon', () => {
		const wrapper = mount(BoChip, {
			props: { text: 'Hot', icon: 'star' },
			slots: { leading: '<i class="dot"></i>' },
			global,
		});

		expect(wrapper.find('.dot').exists()).toBe(true);
		expect(wrapper.text()).toBe('Hot');
	});

	test('removable: named delete button emits remove; disabled blocks it', async () => {
		const wrapper = mount(BoChip, { props: { text: 'vue', removable: true }, global });
		const button = wrapper.get('button');

		expect(button.attributes('aria-label')).toBe('Remove vue');
		await button.trigger('click');
		expect(wrapper.emitted('remove')).toHaveLength(1);

		await wrapper.setProps({ disabled: true });
		expect(button.attributes('disabled')).toBeDefined();
	});
});
