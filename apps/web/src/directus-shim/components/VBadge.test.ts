import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';
import VBadge from './VBadge.vue';

beforeEach(() => setActivePinia(createPinia()));

describe('VBadge', () => {
	test('value at the top end over the slot', () => {
		const wrapper = mount(VBadge, { props: { value: 3 }, slots: { default: '<i class="target" />' } });
		const badge = wrapper.get('span');

		expect(badge.text()).toBe('3');
		expect(badge.classes()).toEqual(expect.arrayContaining(['bg-error-600', '-top-1.75', '-end-1.75']));
		expect(wrapper.find('.target').exists()).toBe(true);
	});

	test('icon, left, bottom, bordered', () => {
		const badge = mount(VBadge, { props: { icon: 'check', left: true, bottom: true, bordered: true } }).get('span');

		expect(badge.find('[data-icon="check"]').exists()).toBe(true);
		expect(badge.classes()).toEqual(expect.arrayContaining(['-start-1.75', '-bottom-1.75', 'ring-2']));
	});

	test('dot without content; disabled hides the badge', () => {
		const dot = mount(VBadge, { props: { dot: true, value: 9 } }).get('span');
		expect(dot.classes()).toContain('size-2');
		expect(dot.text()).toBe('');

		expect(
			mount(VBadge, { props: { value: 1, disabled: true } })
				.find('span')
				.exists(),
		).toBe(false);
	});
});
