import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import { h, type Component } from 'vue';
import VItem from './VItem.vue';
import VItemGroup from './VItemGroup.vue';

function group(props: Record<string, unknown>) {
	return mount(VItemGroup, {
		props,
		slots: {
			default: () =>
				['a', 'b', 'c'].map((value) =>
					h(
						VItem as Component,
						{ value },
						{
							default: ({ active, toggle }: { active: boolean; toggle: () => void }) =>
								h('button', { 'data-value': value, 'data-active': String(active), onClick: toggle }, value),
						},
					),
				),
		},
	});
}

test('single selection: v-model and the { active, toggle } slot', async () => {
	const wrapper = group({ modelValue: ['b'] });
	expect(wrapper.get('[data-value="b"]').attributes('data-active')).toBe('true');

	await wrapper.get('[data-value="a"]').trigger('click');
	expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['a']]);

	// Not mandatory: a second click clears the selection.
	await wrapper.setProps({ modelValue: ['a'] });
	await wrapper.get('[data-value="a"]').trigger('click');
	expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[]]);
});

test('multiple with max, mandatory', async () => {
	const multiple = group({ modelValue: ['a'], multiple: true, max: 2 });
	await multiple.get('[data-value="b"]').trigger('click');
	expect(multiple.emitted('update:modelValue')?.at(-1)).toEqual([['a', 'b']]);

	await multiple.setProps({ modelValue: ['a', 'b'] });
	await multiple.get('[data-value="c"]').trigger('click');
	expect(multiple.emitted('update:modelValue')).toHaveLength(1);

	const mandatory = group({ mandatory: true });
	expect(mandatory.emitted('update:modelValue')?.[0]).toEqual([['a']]);
});

test('scope: an item of another scope is not part of the group; outside a group the item is inert', async () => {
	const wrapper = mount(VItemGroup, {
		props: { modelValue: [], scope: 'mine' },
		slots: {
			default: () =>
				h(
					VItem as Component,
					{ value: 'a' },
					{
						default: ({ toggle }: { toggle: () => void }) => h('button', { onClick: toggle }, 'a'),
					},
				),
		},
	});
	await wrapper.get('button').trigger('click');
	expect(wrapper.emitted('update:modelValue')).toBeUndefined();

	const alone = mount(VItem, { slots: { default: '<span>{{ params.active }}</span>' } });
	expect(alone.text()).toBe('false');
});
