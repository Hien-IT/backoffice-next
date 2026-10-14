// Ported from directus/app/src/components/v-checkbox-tree/v-checkbox-tree.test.ts
// Backoffice: the Directus test only snapshots an empty mount; the value-combining cases below are ours.
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { i18n } from '../lang/index.ts';
import BoCheckboxTree from './BoCheckboxTree.vue';

const global = { plugins: [i18n] };

const choices = [
	{
		text: 'Fruit',
		value: 'a',
		children: [
			{ text: 'Apple', value: 'a1' },
			{
				text: 'Citrus',
				value: 'a2',
				children: [
					{ text: 'Lemon', value: 'a2x' },
					{ text: 'Orange', value: 'a2y' },
				],
			},
		],
	},
	{ text: 'Bread', value: 'b' },
];

afterEach(() => {
	vi.useRealTimers();
	document.body.innerHTML = '';
});

function mountTree(props: Record<string, unknown> = {}) {
	const wrapper: VueWrapper = mount(BoCheckboxTree, {
		props: {
			choices,
			modelValue: [],
			'onUpdate:modelValue': (modelValue: (string | number)[]) => wrapper.setProps({ modelValue }),
			...props,
		},
		global,
		attachTo: document.body,
	});
	return wrapper;
}

function row(wrapper: VueWrapper, text: string) {
	return wrapper.findAll('[role="treeitem"]').find((r) => r.text().endsWith(text))!;
}

function texts(wrapper: VueWrapper) {
	return wrapper.findAll('[role="treeitem"]').map((r) => r.text().replace(/^(chevron_right)?(check|remove)?/, ''));
}

async function expandAll(wrapper: VueWrapper) {
	for (const text of ['Fruit', 'Citrus']) {
		await row(wrapper, text).get('[aria-hidden="true"]').trigger('click');
		await flushPromises();
	}
}

async function click(wrapper: VueWrapper, text: string) {
	await row(wrapper, text).trigger('click');
	await flushPromises();
}

function last(wrapper: VueWrapper) {
	return wrapper.emitted('update:modelValue')?.at(-1)?.[0];
}

test('Mount component', () => {
	expect(BoCheckboxTree).toBeTruthy();

	const wrapper = mount(BoCheckboxTree, { global });

	expect(wrapper.text()).toContain('No options available');
});

describe('BoCheckboxTree', () => {
	test('tree semantics: labelled tree, levels, expand on the chevron only', async () => {
		const wrapper = mountTree({ label: 'Food' });
		const tree = wrapper.get('[role="tree"]');

		expect(tree.attributes('aria-labelledby')).toBe(wrapper.get('span').attributes('id'));
		expect(texts(wrapper)).toEqual(['Fruit', 'Bread']);
		expect(row(wrapper, 'Fruit').attributes('aria-expanded')).toBe('false');

		await expandAll(wrapper);
		expect(texts(wrapper)).toEqual(['Fruit', 'Apple', 'Citrus', 'Lemon', 'Orange', 'Bread']);
		expect(row(wrapper, 'Lemon').attributes('aria-level')).toBe('3');
		expect(row(wrapper, 'Fruit').attributes('aria-expanded')).toBe('true');

		// A row click checks; it does not collapse the group.
		await click(wrapper, 'Fruit');
		expect(row(wrapper, 'Fruit').attributes('aria-expanded')).toBe('true');
		wrapper.unmount();
	});

	test('valueCombining all', async () => {
		const wrapper = mountTree();
		await expandAll(wrapper);

		await click(wrapper, 'Fruit');
		expect(last(wrapper)).toEqual(['a1', 'a2', 'a2x', 'a2y', 'a']);
		await click(wrapper, 'Fruit');
		expect(last(wrapper)).toEqual([]);

		await click(wrapper, 'Lemon');
		expect(last(wrapper)).toEqual(['a2x']);
		expect(row(wrapper, 'Citrus').attributes('aria-checked')).toBe('mixed');
		expect(row(wrapper, 'Fruit').attributes('aria-checked')).toBe('mixed');

		await click(wrapper, 'Orange');
		expect(last(wrapper)).toEqual(['a2x', 'a2y', 'a2']);
		expect(row(wrapper, 'Citrus').attributes('aria-checked')).toBe('true');
		wrapper.unmount();
	});

	test('valueCombining leaf', async () => {
		const wrapper = mountTree({ valueCombining: 'leaf' });
		await expandAll(wrapper);

		await click(wrapper, 'Fruit');
		expect(last(wrapper)).toEqual(['a1', 'a2x', 'a2y']);
		expect(row(wrapper, 'Fruit').attributes('aria-checked')).toBe('true');
		expect(row(wrapper, 'Citrus').attributes('aria-checked')).toBe('true');

		await click(wrapper, 'Fruit');
		expect(last(wrapper)).toEqual([]);
		wrapper.unmount();
	});

	test('valueCombining branch', async () => {
		const wrapper = mountTree({ valueCombining: 'branch' });
		await expandAll(wrapper);

		await click(wrapper, 'Fruit');
		expect(last(wrapper)).toEqual(['a']);
		expect(row(wrapper, 'Apple').attributes('aria-checked')).toBe('true');
		expect(row(wrapper, 'Citrus').attributes('aria-checked')).toBe('true');

		await click(wrapper, 'Apple');
		expect(last(wrapper)).toEqual(['a2']);
		wrapper.unmount();
	});

	test('valueCombining exclusive', async () => {
		const wrapper = mountTree({ valueCombining: 'exclusive', modelValue: ['a'] });
		await expandAll(wrapper);

		await click(wrapper, 'Apple');
		expect(last(wrapper)).toEqual(['a1']);
		expect(row(wrapper, 'Fruit').attributes('aria-checked')).toBe('mixed');
		await click(wrapper, 'Fruit');
		expect(last(wrapper)).toEqual(['a']);
		wrapper.unmount();
	});

	test('valueCombining indeterminate', async () => {
		const wrapper = mountTree({ valueCombining: 'indeterminate' });
		await expandAll(wrapper);

		await click(wrapper, 'Lemon');
		expect(last(wrapper)).toEqual(['a2x', 'a2', 'a']);
		expect(row(wrapper, 'Fruit').attributes('aria-checked')).toBe('mixed');
		wrapper.unmount();
	});

	test('search (more than 10 choices) filters and opens the matching branches; no results', async () => {
		vi.useFakeTimers();
		const many = [...choices, ...Array.from({ length: 10 }, (_, i) => ({ text: `Item ${i}`, value: `i${i}` }))];
		const wrapper = mountTree({ choices: many });
		const input = wrapper.get('input[type="search"]');

		expect(wrapper.get(`label[for="${input.attributes('id')}"]`).text()).toBe('Search');
		await input.setValue('lémon');
		vi.advanceTimersByTime(250);
		await flushPromises();
		expect(texts(wrapper)).toEqual(['Fruit', 'Citrus', 'Lemon']);

		await input.setValue('zzz');
		vi.advanceTimersByTime(250);
		await flushPromises();
		expect(texts(wrapper)).toEqual([]);
		expect(wrapper.text()).toContain('No Results');
		wrapper.unmount();
	});

	test('show selected only keeps the selected rows and opens their groups', async () => {
		const wrapper = mountTree({ modelValue: ['a2x'] });
		const toggle = wrapper.get('[role="switch"]');

		await toggle.trigger('click');
		await flushPromises();
		expect(texts(wrapper)).toEqual(['Fruit', 'Citrus', 'Lemon']);

		await toggle.trigger('click');
		await flushPromises();
		expect(texts(wrapper)).toEqual(['Fruit', 'Bread']);

		await wrapper.setProps({ modelValue: [] });
		expect(toggle.attributes('disabled')).toBeDefined();
		wrapper.unmount();
	});

	test('disabled choices and invalid state', async () => {
		const wrapper = mountTree({
			choices: [{ text: 'Locked', value: 'l', disabled: true }, ...choices],
			id: 't',
			error: 'Required',
			hint: 'Pick',
		});
		const tree = wrapper.get('[role="tree"]');

		expect(tree.attributes('aria-describedby')).toBe('t-hint t-error');
		expect(tree.attributes('aria-invalid')).toBe('true');
		expect(row(wrapper, 'Locked').attributes('aria-disabled')).toBe('true');
		await click(wrapper, 'Locked');
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
		wrapper.unmount();
	});
});
