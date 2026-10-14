import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import BoTabs from './BoTabs.vue';

const items = [
	{ value: 'one', label: 'One' },
	{ value: 'two', label: 'Two' },
	{ value: 'off', label: 'Off', disabled: true },
];

function mountTabs(props: Record<string, unknown> = {}) {
	return mount(BoTabs, {
		props: { items, modelValue: 'one', label: 'Sections', ...props },
		slots: { content: '<template #content="{ item }"><p data-content>{{ item.label }} body</p></template>' },
		attachTo: document.body,
	});
}

describe('BoTabs', () => {
	test('one trigger per item, the active one selected, only its panel rendered', () => {
		const wrapper = mountTabs();
		const tabs = wrapper.findAll('[role="tab"]');

		expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBe('Sections');
		expect(tabs.map((tab) => tab.text())).toEqual(['One', 'Two', 'Off']);
		expect(tabs[0]!.attributes('aria-selected')).toBe('true');
		expect(tabs[2]!.attributes('data-disabled')).toBeDefined();
		expect(wrapper.findAll('[data-content]').map((el) => el.text())).toEqual(['One body']);
		wrapper.unmount();
	});

	test('a click and the arrow keys activate another tab', async () => {
		const wrapper = mountTabs();
		const tabs = wrapper.findAll('[role="tab"]');

		await tabs[1]!.trigger('mousedown', { button: 0 });
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['two']);

		await wrapper.setProps({ modelValue: 'one' });
		(tabs[0]!.element as HTMLElement).focus();
		await tabs[0]!.trigger('keydown', { key: 'ArrowRight' });
		expect(document.activeElement).toBe(tabs[1]!.element);
		wrapper.unmount();
	});

	test('fillWidth stretches the triggers; dir is passed to the root; the active style is the recipe', () => {
		const wrapper = mountTabs({ fillWidth: true, dir: 'rtl' });
		const tab = wrapper.get('[role="tab"]');

		expect(tab.classes()).toContain('flex-1');
		expect(tab.classes()).toContain('data-[state=active]:border-brand-500');
		expect(wrapper.get('[role="tablist"]').attributes('dir')).toBe('rtl');
		wrapper.unmount();

		const plain = mountTabs();
		expect(plain.get('[role="tab"]').classes()).not.toContain('flex-1');
		plain.unmount();
	});

	test('the trigger slot replaces the label', () => {
		const wrapper = mount(BoTabs, {
			props: { items, modelValue: 'two' },
			slots: { trigger: '<template #trigger="{ item, active }">{{ item.value }}:{{ active }}</template>' },
		});

		expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual(['one:false', 'two:true', 'off:false']);
	});
});
