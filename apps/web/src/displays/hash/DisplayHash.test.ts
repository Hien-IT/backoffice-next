// Ported from directus/app/src/displays/hash/hash.test.ts
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import { i18n } from '../../lang/index.ts';
import { itemOf } from '../../test-utils/fixtures.ts';
import DisplayHash from './DisplayHash.vue';

// Backoffice: real ValueNull instead of a stub ("--").
const global = { plugins: [i18n] };

test('Mount component', () => {
	expect(DisplayHash).toBeTruthy();

	const wrapper = mount(DisplayHash, {
		props: {
			value: 'hashed-password',
		},
		global,
	});

	expect(wrapper.html()).toBe('<div>**********</div>');
});

test('renders masked value when value is provided', () => {
	const wrapper = mount(DisplayHash, { props: { value: 'some-hashed-value' }, global });

	expect(wrapper.text()).toBe('**********');
	expect(wrapper.text()).not.toContain('--');
});

test('renders ValueNull component when value is null', () => {
	const wrapper = mount(DisplayHash, { props: { value: null }, global });

	expect(wrapper.text()).toContain('--');
	expect(wrapper.find('div').exists()).toBe(false);
});

test('renders ValueNull when value prop is not provided (defaults to null)', () => {
	const wrapper = mount(DisplayHash, { global });

	expect(wrapper.text()).toContain('--');
});

test('renders masked value for empty string', () => {
	const wrapper = mount(DisplayHash, { props: { value: '' }, global });

	expect(wrapper.text()).toBe('**********');
});

test('Backoffice: fixture field bo_std.input_hash', () => {
	const wrapper = mount(DisplayHash, { props: { value: itemOf('bo_std', 1)['input_hash'] }, global });

	expect(wrapper.text()).toBe('**********');
});
