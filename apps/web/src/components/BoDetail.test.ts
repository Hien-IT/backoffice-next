import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { i18n } from '../lang/index.ts';
import BoDetail from './BoDetail.vue';

function setup(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
	const wrapper = mount(BoDetail, {
		props: { title: 'Details', modelValue: false, ...props },
		slots: { default: '<p data-content>Body</p>', ...slots },
		global: { plugins: [i18n] },
	});

	wrapper.setProps({ 'onUpdate:modelValue': (value: boolean) => wrapper.setProps({ modelValue: value }) });
	return wrapper;
}

describe('BoDetail', () => {
	test('the header button toggles the content and reports aria-expanded', async () => {
		const wrapper = setup();
		const button = wrapper.get('button');

		expect(button.text()).toContain('Details');
		expect(button.attributes('aria-expanded')).toBe('false');
		expect(wrapper.find('[data-content]').exists()).toBe(false);

		await button.trigger('click');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([true]);
		expect(button.attributes('aria-expanded')).toBe('true');
		expect(button.attributes('aria-controls')).toBe(wrapper.get('[data-content]').element.parentElement!.id);
	});

	test('without a color the theme classes apply; a data color goes to style', () => {
		const plain = setup({ icon: 'info' });
		expect(plain.get('button').classes()).toContain('text-gray-800');
		expect(plain.get('button').attributes('style')).toBeUndefined();
		expect(plain.get('button').text()).toContain('info');

		const colored = setup({ icon: 'info', color: 'rgb(46, 205, 167)' }); // raw-color-allowed: test data color
		expect(colored.get('button').classes()).not.toContain('text-gray-800');
		expect(colored.get('button').attributes('style')).toContain('color: rgb(46, 205, 167)'); // raw-color-allowed: test data color
	});

	test('edited dot with its text, badge slot, disabled', async () => {
		const wrapper = setup({ edited: true, disabled: true }, { badge: '<span data-badge>!</span>' });
		const button = wrapper.get('button');

		expect(wrapper.get('[data-edited]').text()).toBe(i18n.global.t('edited'));
		expect(wrapper.find('[data-badge]').exists()).toBe(true);
		expect(button.attributes('disabled')).toBeDefined();
		await button.trigger('click');
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();

		expect(setup().find('[data-edited]').exists()).toBe(false);
	});

	test('the chevron has no transition under reduced motion', () => {
		const chevron = setup().findAll('button > span').at(-1)!;
		expect(chevron.text()).toBe('expand_more');
		expect(chevron.classes()).toContain('motion-reduce:transition-none');
	});
});
