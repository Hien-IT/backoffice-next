import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { i18n } from '../lang/index.ts';
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
	test('the trigger shows the icon of the chosen item as an icon, not its ligature name; the placeholder when empty', async () => {
		const withIcons = [
			{ text: 'Table', value: 'tabular', icon: 'table_rows' },
			{ text: 'Cards', value: 'cards', icon: 'grid_view' },
		];
		const wrapper = mount(BoSelect, {
			props: { items: withIcons, modelValue: 'tabular', placeholder: 'Select an item...' },
			attachTo: document.body,
		});
		await flushPromises();
		const trigger = wrapper.get('button');

		expect(trigger.text()).toContain('Table');
		expect(trigger.find('[data-icon="table_rows"]').attributes('aria-hidden')).toBe('true');
		expect(trigger.text().replace('table_rows', '')).not.toContain('table_rows');

		await wrapper.setProps({ modelValue: null });
		expect(trigger.text()).toContain('Select an item...');
		wrapper.unmount();
	});

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

	test('a disabled item is skipped; the Deselect row emits deselect (Directus show-deselect)', async () => {
		const wrapper = mount(BoSelect, {
			props: { items: [items[0]!, { ...items[1]!, disabled: true }, items[2]!], modelValue: 'default', showDeselect: true },
			global: { plugins: [i18n] },
			attachTo: document.body,
		});
		const trigger = wrapper.get('button').element;

		trigger.focus();
		await key(trigger, 'Enter');
		const options = [...document.body.querySelectorAll('[role="option"]')];
		expect(options.map((o) => o.textContent?.trim())).toEqual(['Deselectclose', 'Defaultcheck', 'LDAP', 'Keycloak']);
		expect(options[2]!.getAttribute('aria-disabled')).toBe('true');

		await key(document.activeElement as HTMLElement, 'ArrowDown');
		await key(document.activeElement as HTMLElement, 'Enter');
		expect(wrapper.emitted('update:modelValue')).toEqual([['keycloak']]);

		await key(trigger, 'Enter');
		await key(document.activeElement as HTMLElement, 'Home');
		await key(document.activeElement as HTMLElement, 'Enter');
		expect(wrapper.emitted('deselect')).toHaveLength(1);
		wrapper.unmount();
	});
});
