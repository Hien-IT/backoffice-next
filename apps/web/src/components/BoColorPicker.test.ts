// Ported from directus/app/src/interfaces/select-color/select-color.test.ts
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '../lang/index.ts';
import BoColorPicker from './BoColorPicker.vue';

enableAutoUnmount(afterEach);

const global = { plugins: [i18n] };

function mountPicker(props: Record<string, unknown> = {}) {
	// v-model: the parent feeds every emitted value back, as a form does.
	const wrapper = mount(BoColorPicker, {
		props: {
			modelValue: null,
			'onUpdate:modelValue': (value: string | null) => wrapper.setProps({ modelValue: value }),
			...props,
		},
		global,
		attachTo: document.body,
	});

	return wrapper;
}

async function openPanel(wrapper: ReturnType<typeof mountPicker>) {
	await wrapper.get('button.swatch').trigger('click');
	await flushPromises();
}

// Typing fires `input` per keystroke and `change` on blur; setValue would fire both before the parent updates.
async function type(input: { element: Element; trigger: (event: string) => Promise<void> }, text: string) {
	(input.element as HTMLInputElement).value = text;
	await input.trigger('input');
	await flushPromises();
}

const emitted = (wrapper: ReturnType<typeof mountPicker>) =>
	(wrapper.emitted('update:modelValue') ?? []).map(([value]) => value);

describe('Interface', () => {
	it('should mount', () => {
		const wrapper = mountPicker();

		expect(wrapper.exists()).toBe(true);
	});

	it('should render icon when null', () => {
		const wrapper = mountPicker();

		expect(wrapper.get('.item-actions button').text()).toBe('palette');
	});

	it('should render remove button when value is set', () => {
		const wrapper = mountPicker({ modelValue: '#6644FF' });

		expect(wrapper.get('.item-actions button').attributes('aria-label')).toBe('Clear Value');
	});

	it('should render action buttons disabled when disabled is true', () => {
		const wrapper = mountPicker({ modelValue: '#6644FF', disabled: true });

		expect(wrapper.get('.item-actions button').attributes('disabled')).toBe('');
		expect(wrapper.get('input').attributes('disabled')).toBe('');
	});

	it('should hide action buttons when nonEditable is true', () => {
		const wrapper = mountPicker({ modelValue: '#6644FF', nonEditable: true, disabled: true });

		expect(wrapper.find('.item-actions').exists()).toBe(false);
	});
});

// Backoffice: behaviour of select-color.vue checked on BoColorPicker.
describe('BoColorPicker', () => {
	it('emits the typed text, then the hex color on change', async () => {
		const wrapper = mountPicker();
		const input = wrapper.get('input');

		await type(input, 'rgb(255, 0, 0)');
		await input.trigger('change');

		expect(emitted(wrapper)).toEqual(['rgb(255, 0, 0)', '#FF0000']);
	});

	it('emits null for an invalid color', async () => {
		const wrapper = mountPicker();
		const input = wrapper.get('input');

		await type(input, 'not a color');
		await input.trigger('change');

		expect(emitted(wrapper).at(-1)).toBeNull();
	});

	it('keeps a CSS variable as typed', async () => {
		const wrapper = mountPicker();
		const input = wrapper.get('input');

		await type(input, 'var(--color-brand-500)');
		await input.trigger('change');

		expect(emitted(wrapper)).toEqual(['var(--color-brand-500)']);
		expect(wrapper.get('button.swatch').attributes('style')).toContain('var(--color-brand-500)');
	});

	it('clears the value', async () => {
		const wrapper = mountPicker({ modelValue: '#6644FF' });

		await wrapper.get('.item-actions button').trigger('click');

		expect(emitted(wrapper)).toEqual([null]);
	});

	it('draws a ring on a swatch with low contrast against the field', () => {
		// happy-dom has no theme variables: the background is unreadable, which counts as low contrast (Directus).
		expect(mountPicker({ modelValue: '#FFFFFF' }).get('button.swatch').classes()).toContain('ring-1');
		expect(mountPicker().get('button.swatch').classes()).toContain('bg-gray-100');
	});

	it('edits RGB and HSL channels', async () => {
		const wrapper = mountPicker({ modelValue: '#000000' });
		await openPanel(wrapper);

		const red = document.body.querySelector<HTMLInputElement>('input[type="number"]')!;
		red.value = '255';
		red.dispatchEvent(new Event('input'));

		expect(emitted(wrapper).at(-1)).toBe('#FF0000');
		expect([...document.body.querySelectorAll('[role="slider"]')]).toHaveLength(3);
	});

	it('with opacity emits #RRGGBBAA and has an alpha channel', async () => {
		const wrapper = mountPicker({ modelValue: '#FF0000', opacity: true });
		await openPanel(wrapper);

		const inputs = document.body.querySelectorAll<HTMLInputElement>('input[type="number"]');
		expect(inputs).toHaveLength(4);

		inputs[3]!.value = '50';
		inputs[3]!.dispatchEvent(new Event('input'));

		expect(emitted(wrapper).at(-1)).toBe('#FF000080');
	});

	it('sets the color from the hex input and ignores an invalid hex', async () => {
		const wrapper = mountPicker({ modelValue: '#000000' });
		await openPanel(wrapper);

		const hex = document.body.querySelector<HTMLInputElement>(`input[id$="-hex"]`)!;
		expect(hex.value).toBe('#000000');

		hex.value = '#zzz';
		hex.dispatchEvent(new Event('change'));
		hex.value = '#3399ff';
		hex.dispatchEvent(new Event('change'));

		expect(emitted(wrapper)).toEqual(['#3399FF']);
	});

	it('shows the Directus default presets and selects one', async () => {
		const wrapper = mountPicker({ modelValue: '#6644FF' });
		await openPanel(wrapper);

		const presets = [...document.body.querySelectorAll<HTMLButtonElement>('button.preset')];
		expect(presets.map((preset) => preset.getAttribute('aria-label'))).toEqual([
			'Purple',
			'Blue',
			'Green',
			'Yellow',
			'Orange',
			'Red',
			'Black',
			'Gray',
			'White',
		]);
		expect(presets[0]!.getAttribute('aria-pressed')).toBe('true');
		expect(presets[1]!.getAttribute('aria-pressed')).toBe('false');

		presets[1]!.click();

		expect(emitted(wrapper)).toEqual(['#3399FF']);
	});

	it('uses custom presets', async () => {
		const wrapper = mountPicker({ presets: [{ name: 'Brand', color: '#123456' }] });
		await openPanel(wrapper);

		const presets = document.body.querySelectorAll('button.preset');
		expect(presets).toHaveLength(1);
		expect(presets[0]!.getAttribute('aria-label')).toBe('Brand');
	});
});

describe('BoColorPicker form linking', () => {
	it('puts the form ids on the text input', () => {
		const wrapper = mountPicker({ id: 'f-input', ariaLabelledby: 'f-label', ariaDescribedby: 'f-error', invalid: true });
		const input = wrapper.get('input#f-input');

		expect(input.attributes('aria-labelledby')).toBe('f-label');
		expect(input.attributes('aria-describedby')).toBe('f-error');
		expect(input.attributes('aria-invalid')).toBe('true');
	});
});
