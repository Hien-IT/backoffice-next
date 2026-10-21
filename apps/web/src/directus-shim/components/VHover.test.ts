import { mount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import VHover from './VHover.vue';

afterEach(() => vi.useRealTimers());

test('slot gets hover after the delays, in the given tag; disabled ignores the mouse', async () => {
	vi.useFakeTimers();
	const wrapper = mount(VHover, {
		props: { tag: 'section', openDelay: 100, closeDelay: 50 },
		slots: { default: '<template #default="{ hover }">{{ hover ? "on" : "off" }}</template>' },
	});

	expect(wrapper.element.tagName).toBe('SECTION');
	await wrapper.trigger('mouseenter');
	vi.advanceTimersByTime(99);
	await wrapper.vm.$nextTick();
	expect(wrapper.text()).toBe('off');
	vi.advanceTimersByTime(1);
	await wrapper.vm.$nextTick();
	expect(wrapper.text()).toBe('on');

	await wrapper.trigger('mouseleave');
	vi.advanceTimersByTime(50);
	await wrapper.vm.$nextTick();
	expect(wrapper.text()).toBe('off');

	await wrapper.setProps({ disabled: true });
	await wrapper.trigger('mouseenter');
	vi.advanceTimersByTime(100);
	await wrapper.vm.$nextTick();
	expect(wrapper.text()).toBe('off');
});
