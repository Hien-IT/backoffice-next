// Directus has no test for select-multiple-checkbox-tree: spec FR-034 options, fixture bo_std fields, edit shapes.
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { computed } from 'vue';
import BoCheckboxTree from '../../components/BoCheckboxTree.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import { translate } from '../../utils/translate-object-values.ts';
import config from './index.ts';
import SelectMultipleCheckboxTree from './SelectMultipleCheckboxTree.vue';

afterEach(() => {
	document.body.innerHTML = '';
});

const choices = [{ text: 'Root', value: 'root', children: [{ text: 'Leaf', value: 'leaf' }] }];

function fixtureProps(field: string) {
	const raw = fieldsOf('bo_std').find((f) => f.field === field)!;
	return { ...translate(raw.meta!.options ?? {}), value: itemOf('bo_std', 1)[field] };
}

function mountTree(props: Record<string, unknown>, provide: Record<symbol, unknown> = {}) {
	return mount(SelectMultipleCheckboxTree, {
		props: props as never,
		global: { plugins: [i18n], provide },
		attachTo: document.body,
	});
}

function row(wrapper: ReturnType<typeof mountTree>, text: string) {
	return wrapper.findAll('[role="treeitem"]').find((r) => r.text().endsWith(text))!;
}

describe('select-multiple-checkbox-tree', () => {
	test('is registered with the Directus config', () => {
		expect(config).toMatchObject({ id: 'select-multiple-checkbox-tree', types: ['json', 'csv'] });
		expect(config.component).toBe(SelectMultipleCheckboxTree);
	});

	test('fixture bo_std.select_tree: branch combining shows the seeded values, no input on mount', () => {
		const wrapper = mountTree(fixtureProps('select_tree'));

		expect(row(wrapper, 'Fruit').attributes('aria-checked')).toBe('true');
		expect(wrapper.findComponent(BoCheckboxTree).props('valueCombining')).toBe('branch');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('fixture bo_std.select_tree_csv: checking emits an array (csv fields too)', async () => {
		const wrapper = mountTree({ ...fixtureProps('select_tree_csv'), value: [] });

		await row(wrapper, 'Root').trigger('click');
		await flushPromises();
		expect(wrapper.emitted('input')).toEqual([[['leaf']]]);
	});

	test('missing options: value [], choices [] ("No options available"), valueCombining all', async () => {
		expect(mountTree({}).text()).toContain('No options available');

		const wrapper = mountTree({ choices });
		expect(wrapper.findComponent(BoCheckboxTree).props('valueCombining')).toBe('all');
		await row(wrapper, 'Root').trigger('click');
		await flushPromises();
		expect(wrapper.emitted('input')?.[0]?.[0]).toEqual(expect.arrayContaining(['root', 'leaf']));
	});

	test('option:select-multiple-checkbox-tree.choices: nested choices render as a tree', () => {
		const wrapper = mountTree({ choices });
		expect(wrapper.find('[role="tree"]').exists()).toBe(true);
		expect(row(wrapper, 'Root').attributes('aria-expanded')).toBe('false');
	});

	test('option:select-multiple-checkbox-tree.valueCombining: leaf keeps only leaves', async () => {
		const wrapper = mountTree({ choices, valueCombining: 'leaf' });

		await row(wrapper, 'Root').trigger('click');
		await flushPromises();
		expect(wrapper.emitted('input')).toEqual([[['leaf']]]);
	});

	test('search from more than 10 roots; "show selected" toggle disabled without a value', () => {
		const many = Array.from({ length: 11 }, (_, i) => ({ text: `C${i}`, value: `c${i}` }));

		expect(mountTree({ choices }).find('input[type="search"]').exists()).toBe(false);
		expect(mountTree({ choices: many }).find('input[type="search"]').exists()).toBe(true);
		expect(mountTree({ choices }).get('[role="switch"]').attributes('disabled')).toBe('');
		expect(mountTree({ choices, value: ['leaf'] }).get('[role="switch"]').attributes('disabled')).toBeUndefined();
	});

	test('disabled; label linking and invalid from the form field', () => {
		expect(row(mountTree({ choices, disabled: true }), 'Root').attributes('aria-disabled')).toBe('true');

		const wrapper = mountTree(
			{ choices },
			{
				[FORM_FIELD_A11Y]: computed(() => ({ inputId: 'f1', labelId: 'f1-label', describedBy: 'f1-note', invalid: true })),
			},
		);
		const group = wrapper.get('[role="group"]');
		expect(group.attributes('aria-labelledby')).toBe('f1-label');
		expect(group.attributes('aria-describedby')).toBe('f1-note');
		expect(wrapper.get('[role="tree"]').attributes('aria-invalid')).toBe('true');
	});
});
