import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { i18n } from '../../lang/index.ts';
import VChip from './VChip.vue';

const global = { plugins: [i18n] };

describe('VChip', () => {
	test('default slot, squared by default, sizes, outlined', () => {
		const wrapper = mount(VChip, { slots: { default: 'Draft' }, global });

		expect(wrapper.text()).toBe('Draft');
		expect(wrapper.classes()).toEqual(expect.arrayContaining(['rounded-lg', 'text-sm', 'bg-gray-100']));

		const pill = mount(VChip, {
			props: { label: false, xSmall: true, outlined: true },
			slots: { default: 'x' },
			global,
		});
		expect(pill.classes()).toEqual(expect.arrayContaining(['rounded-full', 'text-theme-xs', 'ring-gray-300']));
		expect(mount(VChip, { props: { large: true }, global }).classes()).toContain('text-base');
	});

	test('click on a clickable chip; disabled blocks it', async () => {
		const wrapper = mount(VChip, { props: { clickable: true }, slots: { default: 'Tag' }, global });

		expect(wrapper.element.tagName).toBe('BUTTON');
		await wrapper.trigger('click');
		expect(wrapper.emitted('click')).toHaveLength(1);

		await wrapper.setProps({ disabled: true });
		expect(wrapper.attributes('disabled')).toBeDefined();
	});

	test('close: emits close with the event and update:active, hides itself, no click', async () => {
		const wrapper = mount(VChip, { props: { close: true, closeIcon: 'cancel' }, slots: { default: 'Tag' }, global });
		const close = wrapper.get('button');

		expect(close.attributes('aria-label')).toBe('Remove');
		expect(close.text()).toBe('cancel');
		await close.trigger('click');

		expect(wrapper.emitted('close')?.[0]?.[0]).toBeInstanceOf(Event);
		expect(wrapper.emitted('update:active')).toEqual([[false]]);
		expect(wrapper.emitted('click')).toBeUndefined();
		expect(wrapper.html()).toBe('<!--v-if-->');
	});

	test('controlled active', async () => {
		const wrapper = mount(VChip, { props: { active: false }, slots: { default: 'Tag' }, global });

		expect(wrapper.text()).toBe('');
		await wrapper.setProps({ active: true });
		expect(wrapper.text()).toBe('Tag');
	});
});
