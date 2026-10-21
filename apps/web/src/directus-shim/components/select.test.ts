// Spec 020 T111: VSelect (BoSelect / BoMultiSelect / BoCombobox by mode, item key mapping, groups, preview and inline
// triggers) and VFancySelect (item key mapping onto BoFancySelect).
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { h } from 'vue';
import BoCombobox from '../../components/BoCombobox.vue';
import BoMultiSelect from '../../components/BoMultiSelect.vue';
import { i18n } from '../../lang/index.ts';
import VFancySelect from './VFancySelect.vue';
import VSelect from './VSelect.vue';

enableAutoUnmount(afterEach);

const global = { plugins: [i18n] };

async function key(el: Element, key: string) {
	el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	// Reka moves focus between options in a setTimeout.
	await new Promise((resolve) => setTimeout(resolve));
	await flushPromises();
}

const options = () => [...document.body.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim());

const items = [
	{ name: 'One', id: 1, symbol: 'looks_one' },
	{ name: 'Two', id: 2, off: true },
	{ divider: true },
	{
		name: 'Group',
		id: 'g',
		kids: [
			{ name: 'Three', id: 3, tint: 'var(--theme--primary)' },
			{ name: 'Sub', id: 's', pick: true, kids: [{ name: 'Four', id: 4 }] },
		],
	},
];
const keys = {
	itemText: 'name',
	itemValue: 'id',
	itemIcon: 'symbol',
	itemColor: 'tint',
	itemDisabled: 'off',
	itemSelectable: 'pick',
	itemChildren: 'kids',
};

describe('VSelect', () => {
	test('single: item keys, groups with a label or a selectable header, divider; emits the Directus value', async () => {
		const wrapper = mount(VSelect, { props: { items, ...keys, modelValue: 2 }, global, attachTo: document.body });
		const trigger = wrapper.get('button');

		expect(trigger.text()).toContain('Two');
		(trigger.element as HTMLElement).focus();
		await key(trigger.element, 'Enter');

		expect(options()).toEqual(['looks_one One', 'Twocheck', 'Three', 'Sub', 'Four']);
		expect(document.body.querySelector('[role="group"]')?.textContent).toContain('Group');
		expect(document.body.querySelector('[role="option"][aria-disabled="true"]')?.textContent).toContain('Two');
		expect(
			document.body.querySelector('[role="option"] [aria-hidden="true"][style*="background-color"]'),
		).not.toBeNull();

		await key(document.activeElement!, 'End');
		await key(document.activeElement!, 'Enter');
		expect(wrapper.emitted('update:modelValue')).toEqual([[4]]);

		await wrapper.setProps({ modelValue: 4 });
		expect(trigger.text()).toContain('Four');
	});

	test('string items, showDeselect emits null, a value outside the items is shown', async () => {
		const wrapper = mount(VSelect, {
			props: { items: ['a', 'b'], modelValue: 'zzz', showDeselect: true },
			global,
			attachTo: document.body,
		});
		const trigger = wrapper.get('button');

		expect(trigger.text()).toContain('zzz');
		(trigger.element as HTMLElement).focus();
		await key(trigger.element, 'Enter');
		expect(options()).toEqual(['Deselectclose', 'a', 'b']);

		await wrapper.setProps({ modelValue: 'a' });
		await key(trigger.element, 'Enter');
		await key(document.activeElement!, 'Home');
		await key(document.activeElement!, 'Enter');
		expect(wrapper.emitted('update:modelValue')).toEqual([[null]]);
	});

	test('multiple → BoMultiSelect with groups flattened; an empty selection is null', async () => {
		const wrapper = mount(VSelect, {
			props: {
				items,
				...keys,
				multiple: true,
				modelValue: [1] as unknown as string[],
				showDeselect: true,
				multiplePreviewThreshold: 5,
			},
			global,
		});
		const multi = wrapper.getComponent(BoMultiSelect);

		expect(multi.props('items')).toEqual([
			expect.objectContaining({ text: 'One', value: 1 }),
			expect.objectContaining({ text: 'Two', value: 2, disabled: true }),
			{ divider: true },
			{ divider: true },
			expect.objectContaining({ text: 'Three', value: 3 }),
			{ divider: true },
			expect.objectContaining({ text: 'Sub', value: 's' }),
			expect.objectContaining({ text: 'Four', value: 4 }),
		]);
		expect(multi.props()).toMatchObject({ modelValue: [1], allowNone: true, previewThreshold: 5 });

		multi.vm.$emit('update:modelValue', [1, 3]);
		multi.vm.$emit('update:modelValue', []);
		expect(wrapper.emitted('update:modelValue')).toEqual([[[1, 3]], [null]]);
	});

	test('allowOther → BoCombobox with icon and color keys; the typed value goes through', () => {
		const wrapper = mount(VSelect, { props: { items, ...keys, allowOther: true, modelValue: 'free' }, global });
		const combobox = wrapper.getComponent(BoCombobox);

		expect(combobox.props()).toMatchObject({
			modelValue: 'free',
			allowOther: true,
			itemIcon: 'icon',
			itemColor: 'color',
		});
		expect(combobox.props('items')[0]).toMatchObject({ text: 'One', value: 1, icon: 'looks_one' });

		combobox.vm.$emit('update:modelValue', 'other');
		expect(wrapper.emitted('update:modelValue')).toEqual([['other']]);
	});

	test('preview slot gets active and toggle; focus goes back to it on close', async () => {
		const wrapper = mount(VSelect, {
			props: { items: ['a', 'b'], modelValue: 'a' },
			slots: {
				preview: ({ active, toggle }: { active: boolean; toggle: () => void }) =>
					h('button', { type: 'button', class: 'preview', 'data-active': String(active), onClick: toggle }, 'Pick'),
			},
			global,
			attachTo: document.body,
		});
		const preview = wrapper.get('.preview');

		expect(preview.attributes('data-active')).toBe('false');
		await preview.trigger('click');
		await flushPromises();
		expect(preview.attributes('data-active')).toBe('true');
		expect(options()).toEqual(['acheck', 'b']);

		await key(document.activeElement!, 'ArrowDown');
		await key(document.activeElement!, 'Enter');
		expect(wrapper.emitted('update:modelValue')).toEqual([['b']]);
		expect(document.activeElement).toBe(preview.element);
	});

	test('inline: a button with the value text, expanded state, label style', async () => {
		const wrapper = mount(VSelect, {
			props: { items: [{ text: 'Alpha', value: 'a' }], modelValue: 'a', inline: true, label: true },
			global,
			attachTo: document.body,
		});
		const button = wrapper.get('button[aria-haspopup="listbox"]');

		expect(button.text()).toContain('Alpha');
		expect(button.classes()).toContain('bg-gray-100');
		await button.trigger('click');
		await flushPromises();
		expect(button.attributes('aria-expanded')).toBe('true');
	});

	test('the id attribute names the trigger, other attributes stay on the root', () => {
		const wrapper = mount(VSelect, { props: { items: ['a'] }, attrs: { id: 'pick', 'data-x': '1' }, global });

		expect(wrapper.attributes('data-x')).toBe('1');
		expect(wrapper.attributes('id')).toBeUndefined();
		expect(wrapper.get('button').attributes('id')).toBe('pick');
	});
});

describe('VFancySelect', () => {
	test('maps text, value and description keys; emits the value of itemValue', async () => {
		const wrapper = mount(VFancySelect, {
			props: {
				items: [
					{ icon: 'star', label: 'Star', key: 's', note: 'Shiny' } as any,
					{ divider: true },
					{ icon: 'bolt', label: 'Bolt', key: 'b', note: 'Fast' } as any,
				],
				itemText: 'label',
				itemValue: 'key',
				itemDescription: 'note',
			},
			global,
		});

		expect(wrapper.text()).toContain('StarShiny');
		expect(wrapper.find('hr').exists()).toBe(true);
		await wrapper.findAll('button[aria-pressed]')[1]!.trigger('click');
		expect(wrapper.emitted('update:modelValue')).toEqual([['b']]);

		await wrapper.setProps({ modelValue: 'b' });
		expect(wrapper.text()).not.toContain('Star');
	});
});
