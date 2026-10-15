// Ported from directus/app/src/components/v-pagination.test.ts
// Backoffice: page buttons are found by their number text (no `.page` class); recipe Q-2 cases added.
import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { i18n } from '../lang/index.ts';
import BoPagination from './BoPagination.vue';

const global = { plugins: [i18n] };

function setup(props: Record<string, unknown>) {
	const wrapper = mount(BoPagination, { props: { label: 'Articles', modelValue: 1, length: 1, ...props }, global });
	wrapper.setProps({ 'onUpdate:modelValue': (page: number) => wrapper.setProps({ modelValue: page }) });
	return wrapper;
}

const pages = (wrapper: ReturnType<typeof setup>) =>
	wrapper
		.findAll('button')
		.filter((b) => !b.attributes('aria-label'))
		.map((b) => b.text());
const gaps = (wrapper: ReturnType<typeof setup>) => wrapper.findAll('nav > span').length;

describe('BoPagination', () => {
	test('length prop', async () => {
		const wrapper = setup({ length: 5, showFirstLast: false });
		expect(pages(wrapper)).toEqual(['1', '2', '3', '4', '5']);

		await wrapper.setProps({ length: 6, totalVisible: 10 });
		expect(pages(wrapper)).toHaveLength(6);
	});

	test('totalVisible prop', () => {
		expect(pages(setup({ length: 5, totalVisible: 3, showFirstLast: false }))).toEqual(['1', '2', '3']);
	});

	test('showFirstLast prop', () => {
		const wrapper = setup({ length: 7, totalVisible: 3, modelValue: 4 });
		expect(pages(wrapper)).toEqual(['1', '3', '4', '5', '7']);
		expect(gaps(wrapper)).toBe(2);
	});

	test('7 visible pages with first, last and gaps like the tabular layout', () => {
		expect(pages(setup({ length: 20, modelValue: 1 }))).toEqual(['1', '2', '3', '4', '5', '6', '7', '20']);
		expect(pages(setup({ length: 20, modelValue: 10 }))).toEqual(['1', '7', '8', '9', '10', '11', '12', '13', '20']);
		expect(pages(setup({ length: 20, modelValue: 20 }))).toEqual(['1', '14', '15', '16', '17', '18', '19', '20']);
		expect(gaps(setup({ length: 20, modelValue: 10 }))).toBe(2);
		expect(gaps(setup({ length: 7, modelValue: 4 }))).toBe(0);
	});

	test('nav label, aria-current on the current page only', () => {
		const wrapper = setup({ length: 5, modelValue: 3 });

		expect(wrapper.find('nav').attributes('aria-label')).toBe('Articles');
		const current = wrapper.findAll('[aria-current="page"]');
		expect(current.map((b) => b.text())).toEqual(['3']);
		expect(current[0]!.classes()).toContain('bg-brand-500');
	});

	test('previous / next buttons are labelled, move one page and are disabled at the ends', async () => {
		const wrapper = setup({ length: 3, modelValue: 1 });
		const prev = () => wrapper.find('button[aria-label="Previous"]');
		const next = () => wrapper.find('button[aria-label="Next"]');

		expect(prev().attributes('disabled')).toBeDefined();
		await next().trigger('click');
		await next().trigger('click');
		expect(wrapper.emitted('update:modelValue')).toEqual([[2], [3]]);
		expect(next().attributes('disabled')).toBeDefined();

		await prev().trigger('click');
		expect(wrapper.props('modelValue')).toBe(2);
	});

	test('a page button sets v-model', async () => {
		const wrapper = setup({ length: 5 });
		await wrapper
			.findAll('button')
			.find((b) => b.text() === '4')!
			.trigger('click');
		expect(wrapper.emitted('update:modelValue')).toEqual([[4]]);
	});

	test('disabled disables every button', () => {
		const wrapper = setup({ length: 5, modelValue: 3, disabled: true });
		expect(wrapper.findAll('button').every((b) => b.attributes('disabled') !== undefined)).toBe(true);
	});

	test('hidden with one page or none', () => {
		expect(setup({ length: 1 }).find('nav').exists()).toBe(false);
		expect(setup({ length: 0 }).find('nav').exists()).toBe(false);
	});
});
