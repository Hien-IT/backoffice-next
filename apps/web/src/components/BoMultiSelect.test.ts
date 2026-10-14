import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { i18n } from '../lang/index.ts';
import BoMultiSelect from './BoMultiSelect.vue';

const items = [
	{ text: 'Red', value: 'red' },
	{ text: 'Green', value: 'green' },
	{ text: 'Blue', value: 'blue' },
	{ text: 'Gray', value: 'gray', disabled: true },
];
const global = { plugins: [i18n] };

afterEach(() => {
	document.body.innerHTML = '';
});

function options() {
	return [...document.body.querySelectorAll('[role="option"]')] as HTMLElement[];
}

// Option text without the (aria-hidden) check icon ligature.
function labels() {
	return options().map((o) => o.textContent?.replace('check', '').trim());
}

async function settle() {
	await new Promise((resolve) => setTimeout(resolve));
	await flushPromises();
}

async function openList(wrapper: ReturnType<typeof mount>) {
	await wrapper.get('button').trigger('click');
	await settle();
}

describe('BoMultiSelect', () => {
	test('trigger is a focusable field named by the label and the value; chips below the threshold', async () => {
		const wrapper = mount(BoMultiSelect, {
			props: { items, label: 'Colors', modelValue: ['red', 'blue'] },
			global,
			attachTo: document.body,
		});
		const trigger = wrapper.get('button');

		expect(trigger.attributes('tabindex')).toBe('0');
		expect(trigger.attributes('aria-label')).toBeUndefined();
		expect(trigger.attributes('aria-labelledby')).toBe(
			`${wrapper.get('label').attributes('id')} ${trigger.attributes('id')}`,
		);
		expect(wrapper.findAll('button span.rounded-full').map((c) => c.text())).toEqual(['Red', 'Blue']);
		// Display only: no interactive element inside the trigger.
		expect(trigger.findAll('button')).toHaveLength(0);
		wrapper.unmount();
	});

	test('previewThreshold: count or "All Items" instead of chips; placeholder when empty', async () => {
		const wrapper = mount(BoMultiSelect, {
			props: { items: items.slice(0, 3), modelValue: ['red', 'green'], previewThreshold: 2, placeholder: 'Pick' },
			global,
		});

		expect(wrapper.get('button').text()).toContain('2 Items');
		await wrapper.setProps({ modelValue: ['red', 'green', 'blue'] });
		expect(wrapper.get('button').text()).toContain('All Items');
		await wrapper.setProps({ modelValue: null });
		expect(wrapper.get('button').text()).toContain('Pick');
	});

	test('list toggles values and stays open; checked options are selected', async () => {
		const wrapper = mount(BoMultiSelect, { props: { items, modelValue: ['red'] }, global, attachTo: document.body });

		await openList(wrapper);
		expect(options().map((o) => o.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false']);
		expect(options()[3]!.getAttribute('data-disabled')).toBe('');
		options()[1]!.click();
		await settle();
		expect(wrapper.emitted('update:modelValue')).toEqual([[['red', 'green']]]);
		expect(options()).toHaveLength(4);
		wrapper.unmount();
	});

	test('search filters; empty state', async () => {
		const wrapper = mount(BoMultiSelect, { props: { items, modelValue: [] }, global, attachTo: document.body });

		await openList(wrapper);
		const input = document.body.querySelector('input') as HTMLInputElement;
		input.value = 'gre';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await settle();
		expect(labels()).toEqual(['Green']);

		input.value = 'zzz';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await settle();
		expect(options()).toHaveLength(0);
		expect(document.body.textContent).toContain('No Results');
		wrapper.unmount();
	});

	test('allowOther: typed text is offered and other values stay listed', async () => {
		const wrapper = mount(BoMultiSelect, {
			props: { items, modelValue: ['custom'], allowOther: true },
			global,
			attachTo: document.body,
		});

		await openList(wrapper);
		expect(labels()).toContain('custom');
		const input = document.body.querySelector('input') as HTMLInputElement;
		input.value = 'teal';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await settle();
		const add = options().find((o) => o.textContent?.includes('teal'))!;
		add.click();
		await settle();
		expect(wrapper.emitted('update:modelValue')).toEqual([[['custom', 'teal']]]);
		wrapper.unmount();
	});

	test('allowNone: Deselect All clears to null', async () => {
		const wrapper = mount(BoMultiSelect, {
			props: { items, modelValue: ['red'], allowNone: true },
			global,
			attachTo: document.body,
		});

		await openList(wrapper);
		options()[0]!.click();
		await settle();
		expect(wrapper.emitted('update:modelValue')).toEqual([[null]]);
		wrapper.unmount();
	});

	test('no items, loading, invalid, disabled', async () => {
		const wrapper = mount(BoMultiSelect, {
			props: { id: 'm', items: [], error: 'Required', hint: 'Pick' },
			global,
			attachTo: document.body,
		});
		const trigger = wrapper.get('button');

		expect(trigger.attributes('aria-invalid')).toBe('true');
		expect(trigger.attributes('aria-describedby')).toBe('m-hint m-error');
		await openList(wrapper);
		expect(document.body.textContent).toContain('No options available');
		await wrapper.setProps({ loading: true });
		expect(document.body.querySelector('[aria-busy="true"]')?.textContent).toContain('Loading...');

		await wrapper.setProps({ disabled: true });
		expect(trigger.attributes('disabled')).toBeDefined();
		wrapper.unmount();
	});
});

describe('BoMultiSelect form linking, prepend and nonEditable', () => {
	test('aria-labelledby and aria-describedby land on the trigger', () => {
		const wrapper = mount(BoMultiSelect, {
			props: { items, id: 'f-input', ariaLabelledby: 'f-label', ariaDescribedby: 'f-note', invalid: true },
			global,
		});
		const trigger = wrapper.get('button');

		expect(trigger.attributes('id')).toBe('f-input');
		expect(trigger.attributes('aria-labelledby')).toBe('f-label f-input');
		expect(trigger.attributes('aria-describedby')).toBe('f-note');
		expect(trigger.attributes('aria-invalid')).toBe('true');
	});

	test('prepend slot sits inside the trigger', () => {
		const wrapper = mount(BoMultiSelect, { props: { items }, slots: { prepend: '<i>star</i>' }, global });
		expect(wrapper.get('button [data-prepend]').text()).toBe('star');
	});

	test('nonEditable: opens to show the values even when disabled, but nothing can change', async () => {
		const wrapper = mount(BoMultiSelect, {
			props: { items, modelValue: ['red'], disabled: true, nonEditable: true, allowNone: true },
			global,
			attachTo: document.body,
		});

		expect(wrapper.get('button').attributes('disabled')).toBeUndefined();
		await openList(wrapper);
		expect(options()).toHaveLength(4);
		expect(options().every((o) => o.hasAttribute('data-disabled'))).toBe(true);
		expect(document.body.textContent).not.toContain('Deselect All');
		options()[1]!.click();
		await settle();
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();

		await wrapper.setProps({ modelValue: null });
		expect(wrapper.get('button').attributes('disabled')).toBeDefined();
		wrapper.unmount();
	});
});
