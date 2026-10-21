// Spec 020 (T111, data-model §7 rows 35, 50, 57): VTextarea (nullable, trim, attrs, expandOnFocus), VSlider (model
// default 0, thumb label, ticks, change, slots, labelling) and VRemove (button form, action) bridge to Bo*.
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { i18n } from '../../lang/index.ts';
import VRemove from './VRemove.vue';
import VSlider from './VSlider.vue';
import VTextarea from './VTextarea.vue';

enableAutoUnmount(afterEach);

const global = { plugins: [i18n] };

describe('VTextarea', () => {
	test('nullable empty value, trim on blur, attrs to the textarea, class to the root', async () => {
		const wrapper = mount(VTextarea, {
			props: { modelValue: ' a ', trim: true },
			attrs: { class: 'my-area', 'aria-label': 'Notes' },
			global,
		});
		const textarea = wrapper.get('textarea');

		expect(textarea.attributes('aria-label')).toBe('Notes');
		expect(wrapper.classes()).toContain('my-area');
		expect(textarea.classes()).not.toContain('my-area');

		await textarea.trigger('blur');
		await textarea.setValue('');
		expect(wrapper.emitted('update:modelValue')).toEqual([['a'], [null]]);

		const keepEmpty = mount(VTextarea, { props: { nullable: false }, global });
		await keepEmpty.get('textarea').setValue('');
		expect(keepEmpty.emitted('update:modelValue')).toEqual([['']]);
	});

	test('expandOnFocus: input height until content; prepend/append slots; autofocus', async () => {
		const wrapper = mount(VTextarea, {
			props: { expandOnFocus: true, autofocus: true },
			slots: { prepend: '<i data-prepend />', append: '<i data-append />' },
			attachTo: document.body,
			global,
		});
		const textarea = wrapper.get('textarea');

		expect(document.activeElement).toBe(textarea.element);
		expect(textarea.classes()).toEqual(expect.arrayContaining(['h-11', 'focus:h-40']));
		expect(wrapper.find('[data-prepend]').exists() && wrapper.find('[data-append]').exists()).toBe(true);

		await wrapper.setProps({ modelValue: 'text' });
		expect(textarea.classes()).toContain('h-40');
		expect(textarea.classes()).not.toContain('h-11');
	});
});

describe('VSlider', () => {
	test('model 0 by default; no bubble unless showThumbLabel; thumb-label slot; ticks', async () => {
		const wrapper = mount(VSlider, { props: { max: 4 }, global });
		expect(wrapper.get('[role="slider"]').attributes('aria-valuetext')).toBe('0');
		expect(wrapper.find('[data-value]').exists()).toBe(false);
		expect(wrapper.find('[data-ticks]').exists()).toBe(false);

		await wrapper.setProps({ showThumbLabel: true, showTicks: true, modelValue: 2 });
		expect(wrapper.get('[data-value]').text()).toBe('2');
		expect(wrapper.findAll('[data-ticks] span')).toHaveLength(5);

		const slotted = mount(VSlider, {
			props: { modelValue: 3, showThumbLabel: true },
			slots: { 'thumb-label type-text': '<template #default="{ value }">{{ value }}%</template>' },
			global,
		});
		expect(slotted.get('[data-value]').text()).toBe('3%');
	});

	test('keys emit update:modelValue and change; prepend/append get the value; aria-label names the thumb', async () => {
		const wrapper = mount(VSlider, {
			props: { modelValue: 5 },
			attrs: { 'aria-label': 'Volume', class: 'my-slider' },
			slots: {
				prepend: '<template #default="{ value }">from {{ value }}</template>',
				append: '<template #default="{ value }">to {{ value }}</template>',
			},
			global,
		});
		const thumb = wrapper.get('[role="slider"]');

		expect(wrapper.classes()).toContain('my-slider');
		expect(wrapper.get(`#${CSS.escape(thumb.attributes('aria-labelledby')!)}`).text()).toBe('Volume');
		expect(wrapper.text()).toContain('from 5');
		expect(wrapper.text()).toContain('to 5');

		await thumb.trigger('keydown', { key: 'ArrowRight' });
		expect(wrapper.emitted('update:modelValue')).toEqual([[6]]);
		expect(wrapper.emitted('change')).toEqual([[6]]);
	});
});

describe('VRemove', () => {
	test('icon button emits action; `button` is the round filled button; confirm asks first', async () => {
		const wrapper = mount(VRemove, { props: { deselect: true }, global });
		const button = wrapper.get('button');

		expect(button.attributes('aria-label')).toBe('Deselect');
		expect(button.classes()).toContain('rounded-lg');
		await button.trigger('click');
		expect(wrapper.emitted('action')).toHaveLength(1);

		const round = mount(VRemove, { props: { button: true }, global });
		expect(round.get('button').classes()).toEqual(expect.arrayContaining(['rounded-full', 'bg-brand-500']));

		const confirm = mount(VRemove, { props: { confirm: true }, global });
		await confirm.get('button').trigger('click');
		expect(confirm.emitted('action')).toBeUndefined();
	});
});
