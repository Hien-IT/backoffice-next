import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { i18n } from '../lang/index.ts';
import BoCombobox from './BoCombobox.vue';

const items = [
	{ text: 'Apple', value: 'apple' },
	{ text: 'Banana', value: 'banana' },
	{ text: 'Cherry', value: 'cherry' },
];
const global = { plugins: [i18n] };

afterEach(() => {
	document.body.innerHTML = '';
});

function options() {
	return [...document.body.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim());
}

async function type(wrapper: ReturnType<typeof mount>, text: string) {
	const input = wrapper.get('input');
	await input.setValue(text);
	await new Promise((resolve) => setTimeout(resolve));
	await flushPromises();
}

describe('BoCombobox', () => {
	test('input is the labelled combobox and shows the selected item text', async () => {
		const wrapper = mount(BoCombobox, {
			props: { items, label: 'Fruit', modelValue: 'banana' },
			global,
			attachTo: document.body,
		});
		await flushPromises();
		const input = wrapper.get('input');

		expect(input.attributes('role')).toBe('combobox');
		expect(input.attributes('aria-autocomplete')).toBe('list');
		expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'));
		expect(input.element.value).toBe('Banana');
		wrapper.unmount();
	});

	test('typing filters, emits update:search, and choosing an item emits its value', async () => {
		const wrapper = mount(BoCombobox, { props: { items }, global, attachTo: document.body });

		await type(wrapper, 'an');
		expect(wrapper.emitted('update:search')?.at(-1)).toEqual(['an']);
		expect(options()).toEqual(['Banana']);

		(document.body.querySelector('[role="option"]') as HTMLElement).click();
		await flushPromises();
		expect(wrapper.emitted('update:modelValue')).toEqual([['banana']]);
		wrapper.unmount();
	});

	test('no match shows the empty state; allowOther offers the typed text', async () => {
		const wrapper = mount(BoCombobox, { props: { items }, global, attachTo: document.body });

		await type(wrapper, 'kiwi');
		expect(options()).toEqual([]);
		expect(document.body.textContent).toContain('No Results');

		await wrapper.setProps({ allowOther: true });
		await flushPromises();
		expect(options()).toHaveLength(1);
		expect(options()[0]).toContain('kiwi');
		(document.body.querySelector('[role="option"]') as HTMLElement).click();
		await flushPromises();
		expect(wrapper.emitted('update:modelValue')).toEqual([['kiwi']]);
		wrapper.unmount();
	});

	test('remote items: ignoreFilter keeps every item; loading shows a busy row', async () => {
		const wrapper = mount(BoCombobox, { props: { items, ignoreFilter: true }, global, attachTo: document.body });

		await type(wrapper, 'zzz');
		expect(options()).toEqual(['Apple', 'Banana', 'Cherry']);

		await wrapper.setProps({ loading: true });
		expect(document.body.querySelector('[aria-busy="true"]')?.textContent).toContain('Loading...');
		wrapper.unmount();
	});

	test('invalid, hint, error, disabled', () => {
		const wrapper = mount(BoCombobox, {
			props: { id: 'c', items, hint: 'Pick', error: 'Required', disabled: true },
			global,
		});
		const input = wrapper.get('input');

		expect(input.attributes('aria-describedby')).toBe('c-hint c-error');
		expect(input.attributes('aria-invalid')).toBe('true');
		expect(input.attributes('disabled')).toBeDefined();
	});
});

describe('BoCombobox form linking, prepend and item icons', () => {
	test('id, aria-labelledby, aria-describedby and invalid land on the input', async () => {
		const wrapper = mount(BoCombobox, {
			props: {
				items,
				id: 'f-input',
				ariaLabelledby: 'f-label',
				ariaDescribedby: 'f-note',
				invalid: true,
				hint: 'Hint',
			},
			global,
		});
		const input = wrapper.get('input');

		expect(input.attributes('id')).toBe('f-input');
		expect(input.attributes('aria-labelledby')).toBe('f-label');
		expect(input.attributes('aria-describedby')).toBe('f-note f-input-hint');
		expect(input.attributes('aria-invalid')).toBe('true');
	});

	test('prepend slot, else the selected item icon or color (itemIcon / itemColor)', async () => {
		const colored = [
			{ text: 'Apple', value: 'apple', icon: 'nutrition', color: '#FF0000' }, // raw-color-allowed: test data
			{ text: 'Banana', value: 'banana', color: '#FFFF00' }, // raw-color-allowed: test data
		];
		const wrapper = mount(BoCombobox, {
			props: { items: colored, modelValue: 'apple', itemIcon: 'icon', itemColor: 'color' },
			global,
			attachTo: document.body,
		});
		await flushPromises();

		expect(wrapper.get('[data-prepend]').text()).toBe('nutrition');
		expect(wrapper.get('input').classes()).toContain('ps-11');
		await wrapper.setProps({ modelValue: 'banana' });
		expect(wrapper.get('[data-prepend] span').attributes('style')).toContain('background-color');

		await wrapper.get('input').trigger('keydown', { key: 'ArrowDown' });
		await new Promise((resolve) => setTimeout(resolve));
		await flushPromises();
		expect(options()[0]).toContain('nutrition');

		const slotted = mount(BoCombobox, { props: { items }, slots: { prepend: '<i>star</i>' }, global });
		expect(slotted.get('[data-prepend]').text()).toBe('star');
		expect(mount(BoCombobox, { props: { items }, global }).find('[data-prepend]').exists()).toBe(false);
		wrapper.unmount();
	});

	test('append slot before the chevron; the input makes room for it', () => {
		const items = [{ text: 'A', value: 'a' }];
		const wrapper = mount(BoCombobox, { props: { items }, slots: { append: '<i>list</i>' }, global });

		expect(wrapper.get('[data-append]').text()).toBe('list');
		expect(wrapper.get('input').classes()).toContain('pe-20');
		expect(mount(BoCombobox, { props: { items }, global }).find('[data-append]').exists()).toBe(false);
	});
});
