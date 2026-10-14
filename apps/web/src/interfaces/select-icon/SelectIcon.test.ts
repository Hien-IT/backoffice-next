// Ported from directus/app/src/interfaces/select-icon/select-icon.test.ts
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, test } from 'vitest';
import { computed } from 'vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import config from './index.ts';
import SelectIcon from './SelectIcon.vue';

enableAutoUnmount(afterEach);

// Backoffice: mounted with our BoIconPicker (no stubs, no menu outlets: Reka portals to the body).
const global = { plugins: [i18n] };

function mountIcon(props: Record<string, unknown>, provide: Record<symbol, unknown> = {}) {
	return mount(SelectIcon, { props: props as never, global: { ...global, provide }, attachTo: document.body });
}

describe('Interface', () => {
	it('should mount', () => {
		const wrapper = mountIcon({ value: null });

		expect(wrapper.exists()).toBe(true);
	});

	it('should render icon when null', () => {
		const wrapper = mountIcon({ value: null });

		expect(wrapper.get('.item-actions span').text()).toBe('expand_more');
	});

	it('should render remove button when value is set', () => {
		const wrapper = mountIcon({ value: 'launch' });

		expect(wrapper.get('.item-actions button').attributes('aria-label')).toBe('Clear Value');
	});

	it('should mount', () => {
		const wrapper = mountIcon({ value: 'launch' });

		expect(wrapper.exists()).toBe(true);
	});

	it('should render action buttons disabled when disabled is true', () => {
		const wrapper = mountIcon({ value: 'launch', disabled: true });

		expect(wrapper.get('.item-actions button').attributes('disabled')).toBe('');
		expect(wrapper.get('button[aria-haspopup="dialog"]').attributes('disabled')).toBe('');
	});

	it('should hide action buttons when nonEditable is true', () => {
		const wrapper = mountIcon({
			value: 'launch',
			nonEditable: true,
			// Note: if nonEditable is true, disabled prop will also be true
			disabled: true,
		});

		expect(wrapper.find('.item-actions button').exists()).toBe(false);
	});
});

// Backoffice: spec FR-035, fixture field, edit shapes, label linking.
describe('select-icon', () => {
	test('is registered with the Directus config (no options)', () => {
		expect(config).toMatchObject({ id: 'select-icon', types: ['string'], options: [] });
		expect(config.component).toBe(SelectIcon);
	});

	test('fixture bo_std.select_icon: shows the seeded icon, no input on mount', () => {
		const raw = fieldsOf('bo_std').find((f) => f.field === 'select_icon')!;
		const wrapper = mountIcon({ value: itemOf('bo_std', 1)['select_icon'], width: raw.meta!.width });

		expect(wrapper.get('button[aria-haspopup="dialog"]').text()).toContain('Star');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	// Picking an icon needs layout for the virtual scroller: SelectIcon.browser.test.ts.
	test('clearing emits null', async () => {
		const wrapper = mountIcon({ value: 'launch' });

		await wrapper.get('.item-actions button').trigger('click');
		expect(wrapper.emitted('input')).toEqual([[null]]);
	});

	test('label linking from the form field', () => {
		const wrapper = mountIcon(
			{ value: null },
			{
				[FORM_FIELD_A11Y]: computed(() => ({ inputId: 'f1', labelId: 'f1-label', describedBy: 'f1-note', invalid: false })),
			},
		);

		const trigger = wrapper.get('button#f1');
		expect(trigger.attributes('aria-haspopup')).toBe('dialog');
		expect(trigger.attributes('aria-labelledby')).toBe('f1-label f1-value');
		expect(trigger.attributes('aria-describedby')).toBe('f1-note');
	});
});
