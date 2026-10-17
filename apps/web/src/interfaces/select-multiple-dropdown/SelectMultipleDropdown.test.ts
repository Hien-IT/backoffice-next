// Directus has no test for select-multiple-dropdown: spec FR-031 options, fixture bo_std fields, edit shapes, states.
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { computed } from 'vue';
import BoMultiSelect from '../../components/BoMultiSelect.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import { translate } from '../../utils/translate-object-values.ts';
import config from './index.ts';
import SelectMultipleDropdown from './SelectMultipleDropdown.vue';

afterEach(() => {
	document.body.innerHTML = '';
});

const choices = [
	{ text: 'Alpha', value: 'alpha' },
	{ text: 'Beta', value: 'beta' },
	{ text: 'Gamma', value: 'gamma' },
];

function fixtureProps(field: string, id = 1) {
	const raw = fieldsOf('bo_std').find((f) => f.field === field)!;
	return { ...translate(raw.meta!.options ?? {}), value: itemOf('bo_std', id)[field], width: raw.meta!.width };
}

function mountDropdown(props: Record<string, unknown>, provide: Record<symbol, unknown> = {}) {
	return mount(SelectMultipleDropdown, {
		props: props as never,
		global: { plugins: [i18n], provide },
		attachTo: document.body,
	});
}

async function settle() {
	await new Promise((resolve) => setTimeout(resolve));
	await flushPromises();
}

function options() {
	return [...document.body.querySelectorAll<HTMLElement>('[role="option"]')];
}

describe('select-multiple-dropdown', () => {
	test('is registered with the Directus config', () => {
		expect(config).toMatchObject({ id: 'select-multiple-dropdown', types: ['json', 'csv'] });
		expect(config.component).toBe(SelectMultipleDropdown);
	});

	test('fixture bo_std.select_multiple_dropdown_csv: chips of the seeded array, translated $t: text, no input', () => {
		const wrapper = mountDropdown(fixtureProps('select_multiple_dropdown_csv'));

		expect(wrapper.findAll('button span.rounded-full').map((chip) => chip.text())).toEqual(['Alpha', 'Active']);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('fixture bo_std.select_multiple_dropdown: previewThreshold 2 shows the count', () => {
		const wrapper = mountDropdown(fixtureProps('select_multiple_dropdown'));

		expect(wrapper.get('button').text()).toContain('2 Items');
	});

	test('missing options: previewThreshold 3, no icon, no deselect row', async () => {
		const wrapper = mountDropdown({ choices, value: ['alpha', 'beta'] });

		expect(wrapper.findComponent(BoMultiSelect).props('previewThreshold')).toBe(3);
		expect(wrapper.findAll('button span.rounded-full')).toHaveLength(2);
		expect(wrapper.find('[data-prepend]').exists()).toBe(false);

		await wrapper.get('button').trigger('click');
		await settle();
		expect(options().map((o) => o.textContent)).not.toContain('Deselect All');
	});

	test('option:select-multiple-dropdown.choices: the emitted array follows the choices order, custom values last', () => {
		const wrapper = mountDropdown({ choices, allowOther: true });

		wrapper.findComponent(BoMultiSelect).vm.$emit('update:modelValue', ['custom', 'gamma', 'alpha']);
		expect(wrapper.emitted('input')).toEqual([[['alpha', 'gamma', 'custom']]]);
	});

	test('option:select-multiple-dropdown.allowOther: passed to the multiselect (typed text can be added)', () => {
		const wrapper = mountDropdown({ choices, allowOther: true });
		expect(wrapper.findComponent(BoMultiSelect).props('allowOther')).toBe(true);
	});

	test('option:select-multiple-dropdown.allowNone: "Deselect All" emits an empty array like Directus', async () => {
		const wrapper = mountDropdown({ choices, allowNone: true, value: ['alpha'] });

		await wrapper.get('button').trigger('click');
		await settle();
		const deselect = options()[0]!;
		expect(deselect.textContent).toContain('Deselect All');

		// Directus sortBy(null) of the v-select null emit gives [].
		wrapper.findComponent(BoMultiSelect).vm.$emit('update:modelValue', null);
		expect(wrapper.emitted('input')).toEqual([[[]]]);
	});

	test('option:select-multiple-dropdown.placeholder and option:select-multiple-dropdown.icon', () => {
		const wrapper = mountDropdown({ choices, placeholder: 'Pick some', icon: 'list' });

		expect(wrapper.get('button').text()).toContain('Pick some');
		expect(wrapper.get('[data-prepend]').text()).toBe('list');
	});

	test('option:select-multiple-dropdown.previewThreshold: count instead of chips from the threshold', () => {
		const wrapper = mountDropdown({ choices, value: ['alpha', 'beta', 'gamma'], previewThreshold: 5 });
		expect(wrapper.findAll('button span.rounded-full')).toHaveLength(3);

		const all = mountDropdown({ choices, value: ['alpha', 'beta', 'gamma'], previewThreshold: 2 });
		expect(all.get('button').text()).toContain('All Items');
	});

	test('disabled; label linking and invalid from the form field', () => {
		expect(mountDropdown({ choices, disabled: true }).get('button').attributes('disabled')).toBe('');

		const wrapper = mountDropdown(
			{ choices },
			{
				[FORM_FIELD_A11Y]: computed(() => ({
					inputId: 'f1',
					labelId: 'f1-label',
					describedBy: 'f1-note',
					invalid: true,
				})),
			},
		);
		const trigger = wrapper.get('button');
		expect(trigger.attributes('id')).toBe('f1');
		expect(trigger.attributes('aria-labelledby')).toBe('f1-label f1');
		expect(trigger.attributes('aria-describedby')).toBe('f1-note');
		expect(wrapper.get('button').attributes('aria-invalid')).toBe('true');
	});

	test('keyboard: ArrowDown opens the list from the focused trigger', async () => {
		const wrapper = mountDropdown({ choices });
		const trigger = wrapper.get('button');

		await trigger.trigger('keydown', { key: 'ArrowDown' });
		await settle();
		expect(options()).toHaveLength(3);
	});

	test('nonEditable: the list opens to show the values, which cannot be changed (Directus v-select)', async () => {
		const wrapper = mountDropdown({ choices, value: ['alpha'], disabled: true, nonEditable: true, allowNone: true });

		await wrapper.get('button').trigger('click');
		await settle();
		expect(options()).toHaveLength(3);
		expect(options()[0]!.getAttribute('aria-selected')).toBe('true');
		expect(options().every((option) => option.hasAttribute('data-disabled'))).toBe(true);
		expect(document.body.textContent).not.toContain('Deselect All');
		options()[1]!.click();
		await settle();
		expect(wrapper.emitted('input')).toBeUndefined();
	});
});

// Like Directus v-select (and the flow trigger scopes of 017): a string choice is its own text and value; a divider
// entry is dropped.
test('string choices get their text; divider entries are dropped', () => {
	const wrapper = mountDropdown({ value: null, choices: ['items.create', { divider: true }, 'server.start'] });

	expect(wrapper.findComponent(BoMultiSelect).props('items')).toEqual([
		{ text: 'items.create', value: 'items.create' },
		{ text: 'server.start', value: 'server.start' },
	]);
});
