// Directus has no test for the slider interface: fixture, options (contracts/tests.md §5), string types, keyboard.
import type { FieldRaw } from '@directus/types';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { computed } from 'vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import config from './index.ts';
import InterfaceSlider from './InterfaceSlider.vue';

const fields = fieldsOf('bo_std');
const item = itemOf('bo_std', 1);

function fieldProps(name: string) {
	const field = fields.find((f) => f.field === name) as FieldRaw;
	return { ...(field.meta?.options ?? {}), value: item[name], type: field.type };
}

function mountSlider(props: Record<string, unknown>, invalid = false) {
	return mount(InterfaceSlider, {
		props: props as any,
		attachTo: document.body,
		global: {
			provide: {
				[FORM_FIELD_A11Y as symbol]: computed(() => ({
					inputId: 'f-input',
					labelId: 'f-label',
					describedBy: invalid ? 'f-error' : undefined,
					invalid,
				})),
			},
		},
	});
}

const thumb = (wrapper: ReturnType<typeof mountSlider>) => wrapper.find('[role="slider"]');

afterEach(() => {
	document.body.innerHTML = '';
});

describe('slider', () => {
	test('is registered with the Directus config', () => {
		expect(config).toMatchObject({ id: 'slider', types: ['integer', 'float'], component: InterfaceSlider });
	});

	test('shows the seeded values and emits nothing on mount', async () => {
		const wrapper = mountSlider(fieldProps('slider'));
		await flushPromises();
		expect(thumb(wrapper).attributes('aria-valuenow')).toBe('7');
		const float = mountSlider(fieldProps('slider_float'));
		await flushPromises();
		expect(thumb(float).attributes('aria-valuenow')).toBe('0.4');
		expect(wrapper.emitted('input')).toBeUndefined();
		expect(float.emitted('input')).toBeUndefined();
	});

	test('missing options use the Directus defaults (0..100, step 1, value on hover)', async () => {
		const wrapper = mountSlider({ value: null, type: 'integer' });
		await flushPromises();
		const el = thumb(wrapper);
		expect(el.attributes('aria-valuemin')).toBe('0');
		expect(el.attributes('aria-valuemax')).toBe('100');
		// null sits mid-way and shows no value
		expect(el.attributes('aria-valuenow')).toBe('50');
		expect(el.attributes('aria-valuetext')).toBeUndefined();
		expect(wrapper.find('[data-value]').exists()).toBe(false);
		expect(wrapper.find('[data-ticks]').exists()).toBe(false);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('option:slider.minValue option:slider.maxValue', async () => {
		const wrapper = mountSlider(fieldProps('slider'));
		await flushPromises();
		expect(thumb(wrapper).attributes('aria-valuemin')).toBe('0');
		expect(thumb(wrapper).attributes('aria-valuemax')).toBe('10');
		expect(wrapper.find('[data-max]').text()).toBe('10');
	});

	test('option:slider.stepInterval', async () => {
		const wrapper = mountSlider(fieldProps('slider_float'));
		await flushPromises();
		await thumb(wrapper).trigger('keydown', { key: 'ArrowRight' });
		expect(wrapper.emitted('input')?.at(-1)).toEqual([0.5]);
		expect(wrapper.find('[data-ticks]').findAll('span')).toHaveLength(11);
	});

	test('option:slider.alwaysShowValue', async () => {
		const always = mountSlider(fieldProps('slider'));
		expect(always.find('[data-value]').classes()).not.toContain('hidden');
		expect(always.find('[data-value]').text()).toBe('7');
		const hover = mountSlider(fieldProps('slider_float'));
		expect(hover.find('[data-value]').classes()).toContain('hidden');
	});

	test('keyboard: arrows, Home and End emit numbers', async () => {
		const wrapper = mountSlider(fieldProps('slider'));
		await flushPromises();
		await thumb(wrapper).trigger('keydown', { key: 'ArrowRight' });
		expect(wrapper.emitted('input')?.at(-1)).toEqual([8]);
		await thumb(wrapper).trigger('keydown', { key: 'End' });
		expect(wrapper.emitted('input')?.at(-1)).toEqual([10]);
		await thumb(wrapper).trigger('keydown', { key: 'Home' });
		expect(wrapper.emitted('input')?.at(-1)).toEqual([0]);
	});

	test('bigInteger and decimal string values are parsed', async () => {
		const big = mountSlider({ value: '42', type: 'bigInteger' });
		const dec = mountSlider({ value: '12.5', type: 'decimal' });
		await flushPromises();
		expect(thumb(big).attributes('aria-valuenow')).toBe('42');
		expect(thumb(dec).attributes('aria-valuenow')).toBe('12.5');
	});

	test('disabled', async () => {
		const wrapper = mountSlider({ ...fieldProps('slider'), disabled: true });
		await flushPromises();
		expect(thumb(wrapper).attributes('data-disabled')).toBeDefined();
		await thumb(wrapper).trigger('keydown', { key: 'ArrowRight' });
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('the thumb is linked to the form label and messages (FR-094)', async () => {
		const wrapper = mountSlider(fieldProps('slider'), true);
		await flushPromises();
		const el = thumb(wrapper);
		expect(el.attributes('id')).toBe('f-input');
		expect(el.attributes('aria-labelledby')).toBe('f-label');
		expect(el.attributes('aria-describedby')).toBe('f-error');
		expect(el.attributes('aria-invalid')).toBe('true');
		expect(el.classes()).toContain('border-error-600');
	});
});
