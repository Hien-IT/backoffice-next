// Directus has no test for select-dropdown: spec FR-030 options, fixture bo_std fields, edit shapes, states, keyboard.
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { computed } from 'vue';
import BoCombobox from '../../components/BoCombobox.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import { translate } from '../../utils/translate-object-values.ts';
import config from './index.ts';
import SelectDropdown from './SelectDropdown.vue';

afterEach(() => {
	document.body.innerHTML = '';
});

const choices = [
	{ text: 'Alpha', value: 'alpha', icon: 'star', color: '#6644FF' }, // raw-color-allowed: Directus data default (Q-C)
	{ text: 'Beta', value: 'beta' },
];

// Like FormFieldInterface: the translated `meta.options` (fields store) spread as props, plus value and width.
function fixtureProps(field: string, id = 1) {
	const raw = fieldsOf('bo_std').find((f) => f.field === field)!;
	return { ...translate(raw.meta!.options ?? {}), value: itemOf('bo_std', id)[field], width: raw.meta!.width };
}

function mountDropdown(props: Record<string, unknown>, provide: Record<symbol, unknown> = {}) {
	return mount(SelectDropdown, {
		props: { value: null, ...props } as never,
		global: { plugins: [i18n], provide },
		attachTo: document.body,
	});
}

async function settle() {
	await new Promise((resolve) => setTimeout(resolve));
	await flushPromises();
}

async function key(el: Element, key: string) {
	el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	await settle();
}

function options() {
	return [...document.body.querySelectorAll<HTMLElement>('[role="option"]')];
}

describe('select-dropdown', () => {
	test('is registered with the Directus config', () => {
		expect(config).toMatchObject({ id: 'select-dropdown', component: SelectDropdown });
	});

	test('fixture bo_std.select_dropdown_int: shows the choice of the seeded value, no input on mount', async () => {
		const wrapper = mountDropdown(fixtureProps('select_dropdown_int'));
		await settle();

		expect(wrapper.get('button').text()).toContain('Two');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('fixture bo_std.select_dropdown: allowOther uses the combobox and keeps a value that is not a choice', async () => {
		const wrapper = mountDropdown(fixtureProps('select_dropdown', 3));
		await settle();

		expect(wrapper.findComponent(BoCombobox).exists()).toBe(true);
		expect(wrapper.get('input').element.value).toBe('not-a-choice');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('missing options: Directus defaults (placeholder select_an_item, no deselect row, no icon)', async () => {
		const wrapper = mountDropdown({ choices });

		expect(wrapper.get('button').text()).toContain('Select an item...');
		expect(wrapper.find('[data-prepend]').exists()).toBe(false);

		await key(wrapper.get('button').element, 'Enter');
		expect(options().map((o) => o.textContent)).not.toContain('Deselectclose');
		expect(options()).toHaveLength(2);
	});

	test('option:select-dropdown.choices: choices with icon and color dot, integer values emitted as numbers', async () => {
		const wrapper = mountDropdown({
			choices: [
				{ text: 'One', value: 1, icon: 'star', color: '#6644FF' }, // raw-color-allowed: Directus data default (Q-C)
				{ text: 'Two', value: 2, color: '#2ECDA7' }, // raw-color-allowed: Directus data default (Q-C)
			],
		});

		await key(wrapper.get('button').element, 'Enter');
		const [one, two] = options();
		expect(one!.querySelector('.material-symbols-rounded')?.getAttribute('style')).toContain('color');
		expect(two!.querySelector('.rounded-full')?.getAttribute('style')).toContain('background-color');

		await key(two!, 'Enter');
		expect(wrapper.emitted('input')).toEqual([[2]]);
	});

	test('option:select-dropdown.allowNone: a "Deselect" row emits null, disabled when empty', async () => {
		const wrapper = mountDropdown({ choices, allowNone: true, value: 'beta' });

		await key(wrapper.get('button').element, 'Enter');
		const deselect = options()[0]!;
		expect(deselect.textContent).toContain('Deselect');
		await key(deselect, 'Enter');
		expect(wrapper.emitted('input')).toEqual([[null]]);

		document.body.innerHTML = '';
		const empty = mountDropdown({ choices, allowNone: true, value: null });
		await key(empty.get('button').element, 'Enter');
		expect(options()[0]!.getAttribute('data-disabled')).toBe('');
	});

	test('option:select-dropdown.allowNone with allowOther: a clear button emits null; hidden when nonEditable', async () => {
		const wrapper = mountDropdown({ choices, allowOther: true, allowNone: true, value: 'beta' });

		await wrapper.get('button[aria-label="Deselect"]').trigger('click');
		expect(wrapper.emitted('input')).toEqual([[null]]);

		await wrapper.setProps({ nonEditable: true, disabled: true });
		expect(wrapper.find('button[aria-label="Deselect"]').exists()).toBe(false);
	});

	test('option:select-dropdown.allowOther: the typed text becomes the value', async () => {
		const wrapper = mountDropdown({ choices, allowOther: true });

		wrapper.findComponent(BoCombobox).vm.$emit('update:modelValue', 'custom');
		expect(wrapper.emitted('input')).toEqual([['custom']]);
	});

	test('option:select-dropdown.icon: shown when no choice has an icon; given to choices without icon or color', async () => {
		const plain = mountDropdown({ choices: [{ text: 'Beta', value: 'beta' }], icon: 'list', value: 'beta' });
		expect(plain.get('[data-prepend]').text()).toBe('list');

		document.body.innerHTML = '';
		// A choice has an icon: the global icon shows only while the value is empty, then the choice icon shows.
		const empty = mountDropdown({ choices, icon: 'list', value: null });
		expect(empty.get('[data-prepend]').text()).toBe('list');
		await key(empty.get('button').element, 'Enter');
		expect(options()[1]!.querySelector('.material-symbols-rounded')?.textContent).toBe('list');

		document.body.innerHTML = '';
		const alpha = mountDropdown({ choices, icon: 'list', value: 'alpha' });
		expect(alpha.get('[data-prepend]').text()).toBe('star');
	});

	test('option:select-dropdown.placeholder: replaces the default placeholder', () => {
		const wrapper = mountDropdown({ choices, placeholder: 'Pick one' });
		expect(wrapper.get('button').text()).toContain('Pick one');
	});

	test('emits null when the choices change and the value is no longer a choice', async () => {
		const wrapper = mountDropdown({ choices, value: 'beta' });

		await wrapper.setProps({ choices: [...choices] });
		expect(wrapper.emitted('input')).toBeUndefined();

		await wrapper.setProps({ choices: [choices[0]!] });
		expect(wrapper.emitted('input')).toEqual([[null]]);
	});

	test('disabled, and invalid from the form field', async () => {
		const disabled = mountDropdown({ choices, disabled: true });
		expect(disabled.get('button').attributes('disabled')).toBe('');

		const invalid = mountDropdown(
			{ choices },
			{
				[FORM_FIELD_A11Y]: computed(() => ({ inputId: 'f1', labelId: 'f1-label', describedBy: 'f1-error', invalid: true })),
			},
		);
		const trigger = invalid.get('button');
		expect(trigger.attributes('id')).toBe('f1');
		expect(trigger.attributes('aria-invalid')).toBe('true');
		expect(trigger.attributes('aria-describedby')).toBe('f1-error');
		expect(trigger.attributes('aria-labelledby')).toBe('f1-label f1');
	});

	test('keyboard: Enter opens, arrows move, Enter selects', async () => {
		const wrapper = mountDropdown({ choices, value: 'alpha' });
		const trigger = wrapper.get('button').element;

		trigger.focus();
		await key(trigger, 'Enter');
		await key(document.activeElement!, 'ArrowDown');
		await key(document.activeElement!, 'Enter');

		expect(wrapper.emitted('input')).toEqual([['beta']]);
	});

	test('more than 10 choices: a search row filters on text or value (Directus v-select)', async () => {
		const many = Array.from({ length: 11 }, (_, index) => ({ text: `Item ${index}`, value: `v${index}` }));
		const wrapper = mountDropdown({ choices: many });

		await key(wrapper.get('button').element, 'Enter');
		const search = document.body.querySelector<HTMLInputElement>('input[type="search"]')!;
		expect(search.getAttribute('aria-label')).toBe('Search');
		expect(options()).toHaveLength(11);

		search.value = 'item 10';
		search.dispatchEvent(new Event('input'));
		await settle();
		expect(options().map((option) => option.textContent)).toEqual(['Item 10']);

		search.value = 'v3';
		search.dispatchEvent(new Event('input'));
		await settle();
		expect(options().map((option) => option.textContent)).toEqual(['Item 3']);

		document.body.innerHTML = '';
		const few = mountDropdown({ choices: many.slice(0, 10) });
		await key(few.get('button').element, 'Enter');
		expect(document.body.querySelector('input[type="search"]')).toBeNull();
	});

	test('allowOther: choice icons and the global icon are the combobox prepend', async () => {
		const wrapper = mountDropdown({ choices, allowOther: true, value: 'alpha' });
		await settle();
		expect(wrapper.get('[data-prepend]').text()).toBe('star');
		expect(wrapper.find('[role="group"]').exists()).toBe(false);

		document.body.innerHTML = '';
		const global = mountDropdown({ choices: [{ text: 'Beta', value: 'beta' }], allowOther: true, icon: 'list' });
		expect(global.get('[data-prepend]').text()).toBe('list');
	});

	test('allowOther: the combobox input carries the form ids', () => {
		const wrapper = mountDropdown(
			{ choices, allowOther: true },
			{
				[FORM_FIELD_A11Y]: computed(() => ({ inputId: 'f1', labelId: 'f1-label', describedBy: 'f1-error', invalid: true })),
			},
		);
		const input = wrapper.get('input');
		expect(input.attributes('id')).toBe('f1');
		expect(input.attributes('aria-describedby')).toBe('f1-error');
		expect(input.attributes('aria-invalid')).toBe('true');
	});
});
