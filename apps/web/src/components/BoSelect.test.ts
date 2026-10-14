import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import BoSelect from './BoSelect.vue';

const items = [
	{ text: 'Default', value: 'default' },
	{ text: 'LDAP', value: 'ldap' },
	{ text: 'Keycloak', value: 'keycloak' },
];

afterEach(() => {
	document.body.innerHTML = '';
});

function listbox() {
	return document.body.querySelector('[role="listbox"]');
}

async function key(el: HTMLElement, key: string) {
	el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	// Reka moves focus between options in a setTimeout.
	await new Promise((resolve) => setTimeout(resolve));
	await flushPromises();
}

describe('BoSelect', () => {
	test('label names the trigger and the current value is shown', async () => {
		const wrapper = mount(BoSelect, {
			props: { items, label: 'Provider', modelValue: 'ldap' },
			attachTo: document.body,
		});
		await flushPromises();
		const trigger = wrapper.get('button');

		expect(wrapper.get('label').attributes('for')).toBe(trigger.attributes('id'));
		expect(trigger.text()).toContain('LDAP');
		wrapper.unmount();
	});

	test('opens, moves and selects with the keyboard; Esc closes without change', async () => {
		const wrapper = mount(BoSelect, { props: { items, modelValue: 'default' }, attachTo: document.body });
		const trigger = wrapper.get('button').element;

		trigger.focus();
		await key(trigger, 'Enter');
		expect(listbox()).not.toBeNull();

		await key(document.activeElement as HTMLElement, 'ArrowDown');
		await key(document.activeElement as HTMLElement, 'Enter');

		expect(wrapper.emitted('update:modelValue')).toEqual([['ldap']]);
		expect(listbox()).toBeNull();

		await key(trigger, 'ArrowDown');
		expect(listbox()).not.toBeNull();
		await key(document.activeElement as HTMLElement, 'Escape');
		expect(listbox()).toBeNull();
		expect(wrapper.emitted('update:modelValue')).toHaveLength(1);
		wrapper.unmount();
	});

	test('is disabled when disabled or when there are no items', async () => {
		const wrapper = mount(BoSelect, { props: { items: [], placeholder: 'Pick' } });

		expect(wrapper.get('button').attributes('disabled')).toBeDefined();
		await wrapper.setProps({ items, disabled: true });
		expect(wrapper.get('button').attributes('disabled')).toBeDefined();
		await wrapper.setProps({ disabled: false });
		expect(wrapper.get('button').attributes('disabled')).toBeUndefined();
	});
});
