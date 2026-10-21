import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import VAvatar from './VAvatar.vue';

describe('VAvatar', () => {
	test('div with the slot, round, default size', () => {
		const wrapper = mount(VAvatar, { slots: { default: '<img src="a.png" alt="Ada" />' } });

		expect(wrapper.element.tagName).toBe('DIV');
		expect(wrapper.find('img').exists()).toBe(true);
		expect(wrapper.classes()).toEqual(expect.arrayContaining(['rounded-full', 'size-10']));
	});

	test('tile, sizes, border color, clickable button', () => {
		expect(mount(VAvatar, { props: { tile: true, xSmall: true } }).classes()).toEqual(
			expect.arrayContaining(['rounded-lg', 'size-6']),
		);
		expect(mount(VAvatar, { props: { tile: true, round: true } }).classes()).toContain('rounded-full');
		expect(mount(VAvatar, { props: { border: true } }).classes()).toContain('border-gray-200');

		const colored = mount(VAvatar, { props: { border: 'var(--theme--primary)' } });
		expect(colored.attributes('style')).toContain('--v-avatar-border-color: var(--theme--primary)');

		const button = mount(VAvatar, { props: { clickable: true } });
		expect(button.element.tagName).toBe('BUTTON');
		expect(button.attributes('type')).toBe('button');
	});
});
