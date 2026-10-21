// Spec 020 (T111, data-model §7 rows 10, 11, 45): VCheckbox (boolean and array model, indeterminate, checked, custom
// icons and value), VRadio and VCheckboxTree (caller search, showSelectionOnly, group-toggle) bridge to Bo*.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { i18n } from '../../lang/index.ts';
import VCheckbox from './VCheckbox.vue';
import VCheckboxTree from './VCheckboxTree.vue';
import VRadio from './VRadio.vue';

enableAutoUnmount(afterEach);

const global = { plugins: [i18n] };

const box = (wrapper: ReturnType<typeof mount>) => wrapper.get('[role="checkbox"]');

describe('VCheckbox', () => {
	test('boolean model: toggles, null shows indeterminate and becomes true', async () => {
		const wrapper = mount(VCheckbox, { props: { modelValue: false, label: 'Agree' }, global });

		expect(box(wrapper).attributes('aria-checked')).toBe('false');
		expect(wrapper.text()).toBe('Agree');
		await box(wrapper).trigger('click');
		expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);

		const empty = mount(VCheckbox, { global });
		expect(box(empty).attributes('aria-checked')).toBe('mixed');
		await box(empty).trigger('click');
		expect(empty.emitted('update:modelValue')).toEqual([[true]]);
	});

	test('array model with value adds and removes it; `checked` overrides the state', async () => {
		const wrapper = mount(VCheckbox, { props: { modelValue: ['a'], value: 'b' }, global });

		expect(box(wrapper).attributes('aria-checked')).toBe('false');
		await box(wrapper).trigger('click');
		expect(wrapper.emitted('update:modelValue')).toEqual([[['a', 'b']]]);

		await wrapper.setProps({ modelValue: ['a', 'b'] });
		expect(box(wrapper).attributes('aria-checked')).toBe('true');
		await box(wrapper).trigger('click');
		expect(wrapper.emitted('update:modelValue')![1]).toEqual([['a']]);

		await wrapper.setProps({ checked: false });
		expect(box(wrapper).attributes('aria-checked')).toBe('false');
	});

	test('indeterminate: shown, cleared with update:indeterminate on click; disabled does nothing', async () => {
		const wrapper = mount(VCheckbox, { props: { modelValue: true, indeterminate: true }, global });

		expect(box(wrapper).attributes('aria-checked')).toBe('mixed');
		await box(wrapper).trigger('click');
		expect(wrapper.emitted('update:indeterminate')).toEqual([[false]]);
		expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);

		const disabled = mount(VCheckbox, { props: { modelValue: true, disabled: true }, global });
		await box(disabled).trigger('click');
		expect(disabled.emitted('update:modelValue')).toBeUndefined();
	});

	test('custom icons draw the icon of the state; the default icons draw the recipe box', async () => {
		const wrapper = mount(VCheckbox, {
			props: { modelValue: true, iconOn: 'toggle_on', iconOff: 'toggle_off' },
			global,
		});
		expect(box(wrapper).text()).toBe('toggle_on');
		await wrapper.setProps({ modelValue: false });
		expect(box(wrapper).text()).toBe('toggle_off');

		const plain = mount(VCheckbox, { props: { modelValue: true }, global });
		expect(box(plain).classes()).toContain('border-[1.25px]');
	});

	test('customValue: a text input bound to `value` names the checkbox; slots and attrs', async () => {
		const wrapper = mount(VCheckbox, {
			props: { modelValue: [], value: 'mine', customValue: true, autofocusCustomInput: true },
			slots: { prepend: '<i data-prepend />', append: '<i data-append />' },
			attrs: { class: 'my-check', 'data-testid': 'check' },
			attachTo: document.body,
			global,
		});
		const input = wrapper.get('input[type="text"]');

		expect(document.activeElement).toBe(input.element);
		expect(box(wrapper).attributes('aria-label')).toBe('mine');
		expect(box(wrapper).attributes('data-testid')).toBe('check');
		expect(wrapper.classes()).toContain('my-check');
		expect(wrapper.find('[data-prepend]').exists() && wrapper.find('[data-append]').exists()).toBe(true);

		await input.setValue('other one');
		expect(wrapper.emitted('update:value')).toEqual([['other one']]);
		await input.trigger('blur');
		expect(wrapper.emitted('blur:custom-input')).toHaveLength(1);
	});
});

describe('VRadio', () => {
	test('checked when the model matches, emits its value, label slot, disabled', async () => {
		const wrapper = mount(VRadio, { props: { value: 'b', modelValue: 'a', label: 'B' }, global });

		expect(wrapper.attributes('role')).toBe('radio');
		expect(wrapper.attributes('aria-checked')).toBe('false');
		expect(wrapper.text()).toBe('B');
		await wrapper.trigger('click');
		expect(wrapper.emitted('update:modelValue')).toEqual([['b']]);

		await wrapper.setProps({ modelValue: 'b' });
		expect(wrapper.attributes('aria-checked')).toBe('true');

		await wrapper.setProps({ disabled: true });
		expect(wrapper.attributes('disabled')).toBeDefined();

		const slotted = mount(VRadio, { props: { value: 1 }, slots: { label: '<b>One</b>' }, global });
		expect(slotted.html()).toContain('<b>One</b>');
	});

	test('custom icons, block, nonEditable', () => {
		const wrapper = mount(VRadio, {
			props: { value: 1, modelValue: 1, iconOn: 'star', iconOff: 'star_outline', block: true },
			global,
		});
		expect(wrapper.text()).toContain('star');
		expect(wrapper.classes()).toEqual(expect.arrayContaining(['h-11', 'w-full', 'border']));

		const greyed = mount(VRadio, { props: { value: 1, disabled: true }, global });
		const kept = mount(VRadio, { props: { value: 1, disabled: true, nonEditable: true }, global });
		expect(greyed.classes()).toContain('text-gray-300');
		expect(kept.classes()).not.toContain('text-gray-300');
	});
});

describe('VCheckboxTree', () => {
	const choices = [
		{
			text: 'Fruit',
			value: 'fruit',
			children: [
				{ text: 'Apple', value: 'apple' },
				{ text: 'Pear', value: 'pear' },
			],
		},
		{ text: 'Nuts', value: 'nuts' },
	];

	test('no own search input nor switch; the caller search filters and opens the groups', async () => {
		const many = Array.from({ length: 12 }, (_, i) => ({ text: `Item ${i}`, value: `i${i}` }));
		const wrapper = mount(VCheckboxTree, { props: { choices: many }, global });
		expect(wrapper.find('input[type="search"]').exists()).toBe(false);
		expect(wrapper.find('[role="switch"]').exists()).toBe(false);

		const tree = mount(VCheckboxTree, { props: { choices, search: 'pea' }, global });
		await flushPromises();
		expect(tree.text()).toContain('Pear');
		expect(tree.text()).not.toContain('Apple');
		expect(tree.text()).not.toContain('Nuts');
	});

	test('showSelectionOnly shows the selected choices; the model defaults to []', async () => {
		const wrapper = mount(VCheckboxTree, {
			props: { choices, modelValue: ['nuts'], showSelectionOnly: true },
			global,
		});
		expect(wrapper.text()).toContain('Nuts');
		expect(wrapper.text()).not.toContain('Fruit');

		const empty = mount(VCheckboxTree, { props: { choices }, global });
		await empty.findAll('[role="treeitem"]')[1]!.trigger('click');
		expect(empty.emitted('update:modelValue')).toEqual([[['nuts']]]);
	});

	test('openGroups opens the groups; group-toggle gets { value, active }', async () => {
		const wrapper = mount(VCheckboxTree, { props: { choices, openGroups: ['fruit'] }, global });
		expect(wrapper.text()).toContain('Apple');

		const closed = mount(VCheckboxTree, { props: { choices }, global });
		await closed.get('[role="treeitem"] [aria-hidden="true"]').trigger('click');
		const [event] = closed.emitted('group-toggle')![0] as [{ value: string; active: { value: boolean } }];
		expect(event.value).toBe('fruit');
		expect(event.active.value).toBe(true);
	});
});
