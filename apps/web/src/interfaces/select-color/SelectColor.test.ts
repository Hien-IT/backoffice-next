// Ported from directus/app/src/interfaces/select-color/select-color.test.ts
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, test } from 'vitest';
import { computed } from 'vue';
import BoColorPicker from '../../components/BoColorPicker.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import { translate } from '../../utils/translate-object-values.ts';
import config from './index.ts';
import SelectColor from './SelectColor.vue';

enableAutoUnmount(afterEach);

// Backoffice: mounted with our BoColorPicker (no stubs, no menu outlets: Reka portals to the body).
const global = { plugins: [i18n] };

function mountColor(props: Record<string, unknown>, provide: Record<symbol, unknown> = {}) {
	return mount(SelectColor, { props: props as never, global: { ...global, provide }, attachTo: document.body });
}

describe('Interface', () => {
	it('should mount', () => {
		const wrapper = mountColor({ value: null, width: 'half' });

		expect(wrapper.exists()).toBe(true);
	});

	it('should render icon when null', () => {
		const wrapper = mountColor({ value: null, width: 'half' });

		expect(wrapper.get('.item-actions button').text()).toBe('palette');
	});

	it('should render remove button when value is set', () => {
		const wrapper = mountColor({ value: '#6644FF', width: 'half' }); // raw-color-allowed: DR data default (Q-C)

		expect(wrapper.get('.item-actions button').attributes('aria-label')).toBe('Clear Value');
	});

	it('should mount', () => {
		const wrapper = mountColor({ value: '#6644FF', width: 'half' }); // raw-color-allowed: DR data default (Q-C)

		expect(wrapper.exists()).toBe(true);
	});

	it('should render action buttons disabled when disabled is true', () => {
		const wrapper = mountColor({ value: '#6644FF', width: 'half', disabled: true }); // raw-color-allowed: DR data default (Q-C)

		expect(wrapper.get('.item-actions button').attributes('disabled')).toBe('');
	});

	it('should hide action buttons when nonEditable is true', () => {
		const wrapper = mountColor({
			value: '#6644FF', // raw-color-allowed: DR data default (Q-C)
			width: 'half',
			nonEditable: true,
			// Note: if nonEditable is true, disabled prop will also be true
			disabled: true,
		});

		expect(wrapper.find('.item-actions').exists()).toBe(false);
	});
});

// Backoffice: spec FR-036 options, fixture fields, edit shapes, label linking.
describe('select-color', () => {
	function fixtureProps(field: string) {
		const raw = fieldsOf('bo_std').find((f) => f.field === field)!;
		return { ...translate(raw.meta!.options ?? {}), value: itemOf('bo_std', 1)[field], width: raw.meta!.width };
	}

	async function presets(wrapper: ReturnType<typeof mountColor>) {
		await wrapper.get('button.swatch').trigger('click');
		await flushPromises();
		return [...document.body.querySelectorAll<HTMLButtonElement>('button.preset')];
	}

	test('is registered with the Directus config', () => {
		expect(config).toMatchObject({ id: 'select-color', types: ['string'], recommendedDisplays: ['color'] });
		expect(config.component).toBe(SelectColor);
	});

	test('fixture bo_std.select_color_default: shows the seeded color, no input on mount', () => {
		const wrapper = mountColor(fixtureProps('select_color_default'));

		expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('#2ECDA7'); // raw-color-allowed: DR data default (Q-C)
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('option:select-color.presets: the 9 Directus presets by default, the option replaces them', async () => {
		const defaults = mountColor({ value: null, width: 'half' });
		expect(await presets(defaults)).toHaveLength(9);
		defaults.unmount();

		const custom = await presets(mountColor(fixtureProps('select_color')));
		expect(custom.map((preset) => preset.getAttribute('aria-label'))).toEqual(['Purple', 'Green']);
	});

	test('option:select-color.opacity: keeps #RRGGBBAA values and offers RGBA', () => {
		const wrapper = mountColor(fixtureProps('select_color'));

		expect(wrapper.findComponent(BoColorPicker).props('opacity')).toBe(true);
		expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('#6644FF80'); // raw-color-allowed: DR data default (Q-C)
	});

	test('typing a hex color emits it; clearing emits null', async () => {
		const wrapper = mountColor({ value: '#6644FF', width: 'half' }); // raw-color-allowed: DR data default (Q-C)

		await wrapper.get('.item-actions button').trigger('click');
		expect(wrapper.emitted('input')).toEqual([[null]]);

		const input = wrapper.get('input');
		(input.element as HTMLInputElement).value = '#112233'; // raw-color-allowed: DR data default (Q-C)
		await input.trigger('input');
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['#112233']); // raw-color-allowed: DR data default (Q-C)
	});

	test('label linking and invalid from the form field', () => {
		const wrapper = mountColor(
			{ value: null, width: 'half' },
			{
				[FORM_FIELD_A11Y]: computed(() => ({ inputId: 'f1', labelId: 'f1-label', describedBy: 'f1-note', invalid: true })),
			},
		);
		const input = wrapper.get('input');

		expect(input.attributes('id')).toBe('f1');
		expect(input.attributes('aria-invalid')).toBe('true');
		expect(input.attributes('aria-describedby')).toBe('f1-note');
		expect(wrapper.find('[role="group"]').exists()).toBe(false);
	});
});
