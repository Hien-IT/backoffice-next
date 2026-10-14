// Ported from directus/app/src/displays/icon/icon.test.ts
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import DisplayIcon from './DisplayIcon.vue';

// Backoffice: real BoIcon instead of a stub; color and FILL are inline styles of the icon.
const icon = (wrapper: ReturnType<typeof mount>) => wrapper.find('span');

test('Mount component', () => {
	expect(DisplayIcon).toBeTruthy();

	const wrapper = mount(DisplayIcon, {
		props: {
			value: 'star',
		},
	});

	expect(icon(wrapper).classes()).toContain('material-symbols-rounded');
	expect(icon(wrapper).attributes('style')).toBe('font-size: var(--text-lg);');
});

test('renders icon with value prop', () => {
	const wrapper = mount(DisplayIcon, { props: { value: 'check' } });

	expect(icon(wrapper).exists()).toBe(true);
	expect(icon(wrapper).text()).toBe('check');
});

test('renders icon with null value', () => {
	const wrapper = mount(DisplayIcon, { props: { value: null } });

	// Backoffice: v-icon renders nothing without a name; BoIcon is not rendered.
	expect(icon(wrapper).exists()).toBe(false);
});

test('option:icon.color applies color style when valid hex color is provided', () => {
	const wrapper = mount(DisplayIcon, { props: { value: 'star', color: '#FF0000' } });

	expect(icon(wrapper).attributes('style')).toContain('color: #FF0000');
});

test('does not apply color style when color is not a valid hex', () => {
	const wrapper = mount(DisplayIcon, { props: { value: 'star', color: 'red' } });

	expect(icon(wrapper).attributes('style')).not.toContain('color');
});

test('option:icon.filled passes filled to the icon', () => {
	const wrapper = mount(DisplayIcon, { props: { value: 'star', filled: true } });

	expect(icon(wrapper).attributes('style')).toContain(`font-variation-settings: 'FILL' 1`);
	expect(
		mount(DisplayIcon, { props: { value: 'star' } })
			.find('span')
			.attributes('style'),
	).not.toContain('FILL');
});

test('passes small prop to v-icon', () => {
	const wrapper = mount(DisplayIcon, { props: { value: 'star' } });

	expect(icon(wrapper).attributes('style')).toContain('font-size: var(--text-lg)');
});

test('handles lowercase hex color', () => {
	const wrapper = mount(DisplayIcon, { props: { value: 'star', color: '#ff0000' } });

	expect(icon(wrapper).attributes('style')).toContain('color: #ff0000');
});

test('handles 3-digit hex color', () => {
	const wrapper = mount(DisplayIcon, { props: { value: 'star', color: '#F00' } });

	expect(icon(wrapper).attributes('style')).toContain('color: #F00');
});

// The brand SVG itself is covered by BoIcon's tests.
test('Backoffice: a brand name of the social set renders as a brand icon (BoIcon)', () => {
	const wrapper = mount(DisplayIcon, { props: { value: 'docker' } });

	expect(icon(wrapper).classes()).not.toContain('material-symbols-rounded');
});

test('Backoffice: fixture field bo_std.select_icon', () => {
	const field = fieldsOf('bo_std').find((f) => f.field === 'select_icon')!;
	const wrapper = mount(DisplayIcon, {
		props: { ...field.meta!.display_options, value: itemOf('bo_std', 1)['select_icon'] },
	});

	expect(icon(wrapper).text()).toBe('star');
	expect(icon(wrapper).attributes('style')).toContain('color: #6644FF');
	expect(icon(wrapper).attributes('style')).toContain(`'FILL' 1`);
});
