import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import { h, ref, type Component } from 'vue';
import VTab from './VTab.vue';
import VTabItem from './VTabItem.vue';
import VTabs from './VTabs.vue';
import VTabsItems from './VTabsItems.vue';

function tabs(props: Record<string, unknown> = {}, disabled = '') {
	return mount(VTabs, {
		props,
		attachTo: document.body,
		slots: {
			default: () =>
				['one', 'two', 'three'].map((value) =>
					h(
						VTab as Component,
						{ value, disabled: value === disabled },
						{ default: ({ active }: { active: boolean }) => `${value} ${active}` },
					),
				),
		},
	});
}

test('single mandatory selection: the first tab is selected, a click selects another (v-model)', async () => {
	const wrapper = tabs();
	expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['one']]);

	await wrapper.setProps({ modelValue: ['one'] });
	const all = wrapper.findAll('[role="tab"]');
	expect(all.map((tab) => tab.attributes('aria-selected'))).toEqual(['true', 'false', 'false']);
	expect(all.map((tab) => tab.attributes('tabindex'))).toEqual(['0', '-1', '-1']);
	expect(all[0]!.text()).toBe('one true');

	await all[1]!.trigger('click');
	expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['two']]);
	wrapper.unmount();
});

test('arrows, Home and End move focus and select, skipping disabled tabs', async () => {
	const wrapper = tabs({ modelValue: ['one'] }, 'two');
	const all = wrapper.findAll('[role="tab"]');
	(all[0]!.element as HTMLElement).focus();

	await all[0]!.trigger('keydown', { key: 'ArrowRight' });
	expect(document.activeElement).toBe(all[2]!.element);
	expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['three']]);

	await all[2]!.trigger('keydown', { key: 'Home' });
	expect(document.activeElement).toBe(all[0]!.element);
	await all[0]!.trigger('keydown', { key: 'ArrowLeft' });
	expect(document.activeElement).toBe(all[2]!.element);
	await all[2]!.trigger('keydown', { key: 'End' });
	expect(document.activeElement).toBe(all[2]!.element);

	await all[1]!.trigger('click');
	expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['three']]);
	wrapper.unmount();
});

test('vertical: column tablist, Up/Down move, the tabs know they are vertical', async () => {
	const wrapper = tabs({ vertical: true, modelValue: ['one'] });
	expect(wrapper.attributes('aria-orientation')).toBe('vertical');
	const all = wrapper.findAll('[role="tab"]');
	expect(all[0]!.classes()).toContain('vertical');

	(all[0]!.element as HTMLElement).focus();
	await all[0]!.trigger('keydown', { key: 'ArrowDown' });
	expect(document.activeElement).toBe(all[1]!.element);
	wrapper.unmount();
});

test('VTabs + VTabsItems: the selected panel renders with { active, toggle }', async () => {
	const selection = ref<(string | number)[]>(['a']);
	const wrapper = mount({
		render: () => [
			h(VTabs, { modelValue: selection.value, 'onUpdate:modelValue': (v: string[]) => (selection.value = v) }, () => [
				h(VTab as Component, { value: 'a' }, () => 'A'),
				h(VTab as Component, { value: 'b' }, () => 'B'),
			]),
			h(VTabsItems, { modelValue: selection.value }, () => [
				h(VTabItem, { value: 'a' }, { default: ({ active }: { active: boolean }) => `Panel A ${active}` }),
				h(VTabItem, { value: 'b' }, () => 'Panel B'),
			]),
		],
	});

	expect(wrapper.findAll('.v-tab-item').map((item) => item.text())).toEqual(['Panel A true']);
	await wrapper.findAll('[role="tab"]')[1]!.trigger('click');
	expect(wrapper.findAll('.v-tab-item').map((item) => item.text())).toEqual(['Panel B']);
});
