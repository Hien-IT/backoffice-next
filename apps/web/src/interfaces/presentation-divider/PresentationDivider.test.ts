// DR has no test for presentation-divider: fixture fields bo_groups.divider / divider_default (FR-056).
import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { computed } from 'vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { fieldsOf } from '../../test-utils/fixtures.ts';
import PresentationDivider from './PresentationDivider.vue';

const fields = fieldsOf('bo_groups');
const options = (field: string) => fields.find((f) => f.field === field)!.meta!.options ?? {};

const mountDivider = (props: Record<string, unknown>, provide = {}) =>
	mount(PresentationDivider, { props, global: { plugins: [i18n], provide } });

describe('presentation-divider', () => {
	test('fixture field: title, icon, color and inline title; no input emitted', () => {
		const wrapper = mountDivider({ ...options('divider'), value: null, collection: 'bo_groups' });

		expect(wrapper.get('h3').text()).toBe('Section');
		expect(wrapper.get('.material-symbols-rounded').text()).toBe('title');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('fixture default field: a bare line without the top margin', () => {
		const wrapper = mountDivider({ ...options('divider_default') });

		expect(wrapper.find('h3').exists()).toBe(false);
		expect(wrapper.classes()).not.toContain('mt-9');
		expect(wrapper.find('[role="none"], [data-orientation="horizontal"]').exists()).toBe(true);
	});

	test('option:presentation-divider.title', () => {
		const wrapper = mountDivider({ title: 'Details' });

		expect(wrapper.get('h3').text()).toBe('Details');
		expect(wrapper.classes()).toContain('mt-9');
	});

	test('option:presentation-divider.icon', () => {
		const wrapper = mountDivider({ icon: 'star' });

		expect(wrapper.get('.material-symbols-rounded').text()).toBe('star');
		expect(wrapper.classes()).toContain('mt-9');
	});

	test('option:presentation-divider.color is applied by style', () => {
		const wrapper = mountDivider({ title: 'Details', color: '#6644FF' }); // raw-color-allowed: DR data default (Q-C)

		expect(wrapper.get('h3').element.parentElement!.getAttribute('style')).toContain('color');
	});

	test('option:presentation-divider.inlineTitle defaults to false (title above the line)', async () => {
		const wrapper = mountDivider({ title: 'Details' });

		expect(wrapper.classes()).not.toContain('flex');

		await wrapper.setProps({ inlineTitle: true });
		expect(wrapper.classes()).toContain('flex');
	});

	test('form field ids are put on the divider', () => {
		const a11y = computed(() => ({ inputId: 'f-1', labelId: 'f-1-label', describedBy: 'f-1-note', invalid: false }));
		const wrapper = mountDivider({ title: 'Details' }, { [FORM_FIELD_A11Y as symbol]: a11y });

		expect(wrapper.attributes('id')).toBe('f-1');
		expect(wrapper.attributes('aria-describedby')).toBe('f-1-note');
	});
});
