import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import BoIcon from './BoIcon.vue';
import BoProgressCircular from './BoProgressCircular.vue';
import BoProgressLinear from './BoProgressLinear.vue';

describe('BoIcon', () => {
	test('is decorative by default with the md size token', () => {
		const span = mount(BoIcon, { props: { name: 'box' } }).get('span');

		expect(span.text()).toBe('box');
		expect(span.classes()).toContain('material-symbols-rounded');
		expect(span.attributes('aria-hidden')).toBe('true');
		expect(span.attributes('role')).toBeUndefined();
		expect(span.attributes('style')).toContain('var(--text-2xl)');
	});

	test('a label makes it an image with a name; size maps to tokens', () => {
		const span = mount(BoIcon, { props: { name: 'lock', label: 'Locked', size: 'lg' } }).get('span');

		expect(span.attributes('role')).toBe('img');
		expect(span.attributes('aria-label')).toBe('Locked');
		expect(span.attributes('aria-hidden')).toBeUndefined();
		expect(span.attributes('style')).toContain('var(--text-title-sm)');
		expect(mount(BoIcon, { props: { name: 'x', size: 'sm' } }).attributes('style')).toContain('var(--text-lg)');
	});
});

describe('BoProgressCircular', () => {
	test('indeterminate spins without a value', () => {
		const svg = mount(BoProgressCircular, { props: { indeterminate: true, ariaLabel: 'Loading' } }).get('svg');

		expect(svg.attributes('role')).toBe('progressbar');
		expect(svg.attributes('aria-label')).toBe('Loading');
		expect(svg.attributes('aria-valuenow')).toBeUndefined();
		expect(svg.classes()).toContain('animate-spin');
	});

	test('determinate exposes the value', () => {
		const svg = mount(BoProgressCircular, { props: { value: 40 } }).get('svg');

		expect(svg.attributes('aria-valuenow')).toBe('40');
		expect(svg.classes()).not.toContain('animate-spin');
	});
});

describe('BoProgressLinear', () => {
	test('determinate sets the bar width and value', () => {
		const wrapper = mount(BoProgressLinear, { props: { value: 30, ariaLabel: 'Progress' } });

		expect(wrapper.attributes('role')).toBe('progressbar');
		expect(wrapper.attributes('aria-label')).toBe('Progress');
		expect(wrapper.attributes('aria-valuenow')).toBe('30');
		expect(wrapper.get('[role="progressbar"] > div').attributes('style')).toContain('width: 30%');
	});

	test('indeterminate animates without a value', () => {
		const wrapper = mount(BoProgressLinear, { props: { indeterminate: true } });

		expect(wrapper.attributes('aria-valuenow')).toBeUndefined();
		expect(wrapper.get('[role="progressbar"] > div').classes()).toContain('bo-progress-linear-indeterminate');
	});
});
