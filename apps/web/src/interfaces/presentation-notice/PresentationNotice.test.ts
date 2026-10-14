// Directus has no test for presentation-notice: fixture fields bo_groups.notice / notice_default (FR-059, FR-065).
import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { computed } from 'vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { fieldsOf } from '../../test-utils/fixtures.ts';
import PresentationNotice from './PresentationNotice.vue';

const fields = fieldsOf('bo_groups');
const options = (field: string) => fields.find((f) => f.field === field)!.meta!.options ?? {};

const mountNotice = (props: Record<string, unknown>, provide = {}) =>
	mount(PresentationNotice, { props, global: { plugins: [i18n], provide } });

describe('presentation-notice', () => {
	test('fixture field: warning color and icon, markdown text; no input emitted', () => {
		const wrapper = mountNotice({ ...options('notice'), value: null, collection: 'bo_groups' });

		expect(wrapper.attributes('data-type')).toBe('warning');
		expect(wrapper.attributes('role')).toBe('note');
		expect(wrapper.classes()).toContain('bg-warning-50');
		expect(wrapper.get('.material-symbols-rounded').text()).toBe('warning');
		expect(wrapper.get('strong').text()).toBe('this');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('fixture default field: normal color and info icon', () => {
		const wrapper = mountNotice({ ...options('notice_default') });

		expect(wrapper.attributes('data-type')).toBe('normal');
		expect(wrapper.classes()).toContain('bg-gray-50');
		expect(wrapper.get('.material-symbols-rounded').text()).toBe('info');
		expect(wrapper.text()).toContain('Plain notice');
	});

	test('option:presentation-notice.color maps every Directus type', () => {
		const boxes = {
			info: 'bg-blue-light-50',
			success: 'bg-success-50',
			warning: 'bg-warning-50',
			danger: 'bg-error-50',
		};

		for (const [color, box] of Object.entries(boxes)) {
			expect(mountNotice({ color }).classes()).toContain(box);
		}
	});

	test('option:presentation-notice.icon', () => {
		expect(mountNotice({ icon: 'bolt' }).get('.material-symbols-rounded').text()).toBe('bolt');
	});

	test('option:presentation-notice.text: markdown, sanitized; no text shows the placeholder', () => {
		const wrapper = mountNotice({ text: '[link](https://example.com) <img src=x onerror=alert(1)>' });

		expect(wrapper.get('a').attributes('href')).toBe('https://example.com');
		expect(wrapper.get('img').attributes('onerror')).toBeUndefined();
		expect(mountNotice({}).get('.flex-1').text()).toBe('No text configured...');
	});

	test('form field ids are put on the notice', () => {
		const a11y = computed(() => ({ inputId: 'f-1', labelId: 'f-1-label', describedBy: 'f-1-note', invalid: false }));
		const wrapper = mountNotice({ text: 'Hi' }, { [FORM_FIELD_A11Y as symbol]: a11y });

		expect(wrapper.attributes('id')).toBe('f-1');
		expect(wrapper.attributes('aria-describedby')).toBe('f-1-note');
	});
});
