// Ported from directus/app/src/interfaces/input/input.test.ts
// Backoffice: v-input is InputField.vue (mounted for real, its props read with findComponent); the second half adds
// the fixture and option tests of contracts/tests.md §5.
import type { FieldRaw } from '@directus/types';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { computed } from 'vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import InputInterface from './InterfaceInput.vue';
import InputField from './InputField.vue';
import config from './index.ts';

const mountOptions = { global: { plugins: [i18n] } };

describe('input interface', () => {
	let wrapper: any;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('interface mounts', () => {
		expect(() => {
			wrapper = mount(InputInterface, {
				...mountOptions,
				props: {
					value: 'test',
					type: 'string',
				},
			});
		}).not.toThrow();

		expect(wrapper.exists()).toBe(true);
	});

	describe('type handling', () => {
		test('sets inputType to "number" for integer type', () => {
			wrapper = mount(InputInterface, {
				...mountOptions,
				props: {
					value: 42,
					type: 'integer',
				},
			});

			const input = wrapper.findComponent(InputField);
			expect(input.props('type')).toBe('number');
		});

		test('sets inputType to "number" for float type', () => {
			wrapper = mount(InputInterface, {
				...mountOptions,
				props: {
					value: 3.14,
					type: 'float',
				},
			});

			const input = wrapper.findComponent(InputField);
			expect(input.props('type')).toBe('number');
		});

		test('sets inputType to "text" for string type', () => {
			wrapper = mount(InputInterface, {
				...mountOptions,
				props: {
					value: 'test',
					type: 'string',
				},
			});

			const input = wrapper.findComponent(InputField);
			expect(input.props('type')).toBe('text');
		});

		test('sets inputType to "password" when masked is true', () => {
			wrapper = mount(InputInterface, {
				...mountOptions,
				props: {
					value: 'secret',
					type: 'string',
					masked: true,
				},
			});

			const input = wrapper.findComponent(InputField);
			expect(input.props('type')).toBe('password');
		});
	});

	describe('integer and float props', () => {
		test('sets integer prop to true for integer type', () => {
			wrapper = mount(InputInterface, {
				...mountOptions,
				props: {
					value: 42,
					type: 'integer',
				},
			});

			const input = wrapper.findComponent(InputField);
			expect(input.props('integer')).toBe(true);
			expect(input.props('float')).toBe(false);
		});

		test('sets integer prop to true for bigInteger type', () => {
			wrapper = mount(InputInterface, {
				...mountOptions,
				props: {
					value: 42,
					type: 'bigInteger',
				},
			});

			const input = wrapper.findComponent(InputField);
			expect(input.props('integer')).toBe(true);
			expect(input.props('float')).toBe(false);
		});

		test('sets float prop to true for float type', () => {
			wrapper = mount(InputInterface, {
				...mountOptions,
				props: {
					value: 3.14,
					type: 'float',
				},
			});

			const input = wrapper.findComponent(InputField);
			expect(input.props('float')).toBe(true);
			expect(input.props('integer')).toBe(false);
		});

		test('sets float prop to true for decimal type', () => {
			wrapper = mount(InputInterface, {
				...mountOptions,
				props: {
					value: 19.99,
					type: 'decimal',
				},
			});

			const input = wrapper.findComponent(InputField);
			expect(input.props('float')).toBe(true);
			expect(input.props('integer')).toBe(false);
		});
	});

	describe('numeric options', () => {
		test('passes min and max props correctly', () => {
			wrapper = mount(InputInterface, {
				...mountOptions,
				props: {
					value: 5,
					type: 'integer',
					min: 0,
					max: 10,
				},
			});

			const input = wrapper.findComponent(InputField);
			expect(input.props('min')).toBe(0);
			expect(input.props('max')).toBe(10);
		});

		test('passes step prop correctly', () => {
			wrapper = mount(InputInterface, {
				...mountOptions,
				props: {
					value: 5,
					type: 'integer',
					step: 2,
				},
			});

			const input = wrapper.findComponent(InputField);
			expect(input.props('step')).toBe(2);
		});

		test('defaults step to 1', () => {
			wrapper = mount(InputInterface, {
				...mountOptions,
				props: {
					value: 5,
					type: 'integer',
				},
			});

			const input = wrapper.findComponent(InputField);
			expect(input.props('step')).toBe(1);
		});

		test('supports decimal step for float types', () => {
			wrapper = mount(InputInterface, {
				...mountOptions,
				props: {
					value: 5.5,
					type: 'float',
					step: 0.2,
				},
			});

			const input = wrapper.findComponent(InputField);
			expect(input.props('step')).toBe(0.2);
		});

		test('supports decimal min and max for float types', () => {
			wrapper = mount(InputInterface, {
				...mountOptions,
				props: {
					value: 5.5,
					type: 'float',
					min: 0.5,
					max: 10.5,
				},
			});

			const input = wrapper.findComponent(InputField);
			expect(input.props('min')).toBe(0.5);
			expect(input.props('max')).toBe(10.5);
		});
	});

	describe('events', () => {
		test('emits input event when value changes', async () => {
			wrapper = mount(InputInterface, {
				...mountOptions,
				props: {
					value: 'test',
					type: 'string',
				},
			});

			const input = wrapper.findComponent(InputField);
			await input.vm.$emit('update:modelValue', 'new value');

			expect(wrapper.emitted('input')).toBeTruthy();
			expect(wrapper.emitted('input')?.[0]).toEqual(['new value']);
		});
	});

	describe('text field options', () => {
		test('renders with placeholder', () => {
			wrapper = mount(InputInterface, {
				...mountOptions,
				props: {
					value: '',
					type: 'string',
					placeholder: 'Enter text...',
				},
			});

			const input = wrapper.findComponent(InputField);
			expect(input.props('placeholder')).toBe('Enter text...');
		});

		test('passes trim prop for text trimming', () => {
			wrapper = mount(InputInterface, {
				...mountOptions,
				props: {
					value: 'test',
					type: 'string',
					trim: true,
				},
			});

			const input = wrapper.findComponent(InputField);
			expect(input.props('trim')).toBe(true);
		});
	});

	describe('state management', () => {
		test('handles disabled state', () => {
			wrapper = mount(InputInterface, {
				...mountOptions,
				props: {
					value: 'test',
					type: 'string',
					disabled: true,
				},
			});

			const input = wrapper.findComponent(InputField);
			expect(input.props('disabled')).toBe(true);
		});
	});
});

/* ------------------------------------------------------------------ fixture and option tests (contracts/tests.md §5) */

const fields = fieldsOf('bo_std');
const item = itemOf('bo_std', 1);

function fieldProps(name: string) {
	const field = fields.find((f) => f.field === name) as FieldRaw;
	return {
		...(field.meta?.options ?? {}),
		value: item[name],
		type: field.type,
		length: field.schema?.max_length ?? null,
		collection: 'bo_std',
		field: name,
	};
}

function mountInput(props: Record<string, unknown>, invalid = false) {
	return mount(InputInterface, {
		props: props as any,
		global: {
			plugins: [i18n],
			provide: {
				[FORM_FIELD_A11Y as symbol]: computed(() => ({
					inputId: 'field-input',
					labelId: 'field-label',
					describedBy: invalid ? 'field-error' : undefined,
					invalid,
				})),
			},
		},
	});
}

async function type(wrapper: ReturnType<typeof mountInput>, text: string) {
	const input = wrapper.find('input');
	await input.setValue(text);
	return input;
}

describe('input with the bo_std fixture', () => {
	test('is registered', () => {
		expect(config).toMatchObject({ id: 'input', component: InputInterface });
	});

	test.each([
		'input_string',
		'input_masked',
		'input_slug',
		'input_default',
		'input_integer',
		'input_float',
		'input_biginteger',
		'input_decimal',
		'input_uuid',
		'input_text',
	])('%s shows the seeded value and emits nothing on mount', (name) => {
		const wrapper = mountInput(fieldProps(name));
		const value = item[name];
		expect(wrapper.find('input').element.value).toBe(value === null ? '' : String(value));
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('missing options use the Directus defaults', () => {
		const wrapper = mountInput({ value: null, type: 'string' });
		const input = wrapper.find('input');
		expect(input.attributes('type')).toBe('text');
		expect(input.attributes('autocomplete')).toBe('off');
		expect(input.attributes('step')).toBe('1');
		expect(input.attributes('placeholder')).toBeUndefined();
		expect(wrapper.find('[data-input-frame]').classes()).toContain('font-outfit');
		expect(wrapper.find('[data-icon-left]').exists()).toBe(false);
		expect(wrapper.find('[data-remaining]').exists()).toBe(false);
	});

	test('links the input to the form label and error (FR-094)', () => {
		const wrapper = mountInput({ value: 'a', type: 'string' }, true);
		const input = wrapper.find('input');
		expect(input.attributes('id')).toBe('field-input');
		expect(input.attributes('aria-describedby')).toBe('field-error');
		expect(input.attributes('aria-invalid')).toBe('true');
		expect(wrapper.find('[data-input-frame]').classes()).toContain('border-error-600');
	});
});

describe('input options', () => {
	test('option:input.placeholder', () => {
		expect(mountInput(fieldProps('input_string')).find('input').attributes('placeholder')).toBe('Type here');
	});

	test('option:input.iconLeft', () => {
		expect(mountInput(fieldProps('input_string')).find('[data-icon-left]').text()).toBe('title');
	});

	test('option:input.iconRight', () => {
		const icon = mountInput(fieldProps('input_decimal')).find('[data-icon-right]');
		expect(icon.text()).toBe('payments');
	});

	test('option:input.font', () => {
		expect(mountInput(fieldProps('input_string')).find('[data-input-frame]').classes()).toContain(
			'font-[family-name:ui-serif,Georgia,serif]',
		);
		expect(mountInput(fieldProps('input_uuid')).find('[data-input-frame]').classes()).toContain(
			'font-[family-name:ui-monospace,SFMono-Regular,Menlo,monospace]',
		);
	});

	test('option:input.softLength shows the remaining characters with the Directus thresholds', async () => {
		// softLength 50, value "alpha"
		const wrapper = mountInput(fieldProps('input_string'));
		const remaining = wrapper.find('[data-remaining]');
		expect(remaining.text()).toBe('45');
		expect(remaining.classes()).toContain('text-gray-500');

		await wrapper.setProps({ value: 'x'.repeat(48) });
		expect(remaining.text()).toBe('2');
		expect(remaining.classes()).toContain('text-error-600');

		await wrapper.setProps({ value: 'x'.repeat(46) });
		expect(remaining.classes()).toContain('text-warning-700');

		// no softLength: the counter appears from 80 % of the column length on
		const plain = mountInput({ value: 'x'.repeat(10), type: 'string', length: 100 });
		expect(plain.find('[data-remaining]').exists()).toBe(false);
		await plain.setProps({ value: 'x'.repeat(85) });
		expect(plain.find('[data-remaining]').text()).toBe('15');
		expect(plain.find('input').attributes('maxlength')).toBe('100');
	});

	test('option:input.trim trims on blur', async () => {
		const wrapper = mountInput(fieldProps('input_string'));
		await wrapper.setProps({ value: '  alpha  ' });
		await wrapper.find('input').trigger('blur');
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['alpha']);

		const untrimmed = mountInput({ value: '  a  ', type: 'string' });
		await untrimmed.find('input').trigger('blur');
		expect(untrimmed.emitted('input')).toBeUndefined();
	});

	test('option:input.clear keeps an emptied value as "" instead of null', async () => {
		const clear = mountInput(fieldProps('input_string'));
		await type(clear, '');
		expect(clear.emitted('input')?.at(-1)).toEqual(['']);

		const nullable = mountInput(fieldProps('input_default'));
		await type(nullable, '');
		expect(nullable.emitted('input')?.at(-1)).toEqual([null]);
	});

	test('option:input.masked renders a password input', () => {
		const input = mountInput(fieldProps('input_masked')).find('input');
		expect(input.attributes('type')).toBe('password');
		expect(input.attributes('autocomplete')).toBe('new-password');
		expect(input.element.value).toBe('masked value');
	});

	test('option:input.slug slugifies the typed text', async () => {
		const wrapper = mountInput(fieldProps('input_slug'));
		await type(wrapper, 'Hello Wörld');
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['hello-woerld']);
		await type(wrapper, 'my ');
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['my-']);

		const keydown = new KeyboardEvent('keydown', { key: '!', cancelable: true });
		wrapper.find('input').element.dispatchEvent(keydown);
		expect(keydown.defaultPrevented).toBe(true);
	});

	test('option:input.min option:input.max option:input.step', async () => {
		const wrapper = mountInput(fieldProps('input_integer'));
		const input = wrapper.find('input');
		expect(input.attributes('type')).toBe('number');
		expect(input.attributes('min')).toBe('0');
		expect(input.attributes('max')).toBe('100');
		expect(input.attributes('step')).toBe('5');
		expect(wrapper.find('[data-inline-warning]').exists()).toBe(false);

		await wrapper.setProps({ value: 150 });
		expect(wrapper.find('[data-inline-warning]').exists()).toBe(true);
		expect(wrapper.find('[data-inline-warning] [role="img"]').attributes('aria-label')).toBe(
			'Value exceeds maximum of 100',
		);
		await wrapper.setProps({ value: -1 });
		expect(wrapper.find('[data-inline-warning] [role="img"]').attributes('aria-label')).toBe(
			'Value is below minimum of 0',
		);
	});
});

describe('input value shapes (FR-080)', () => {
	test('integer emits numbers, floored', async () => {
		const wrapper = mountInput(fieldProps('input_integer'));
		await type(wrapper, '42');
		expect(wrapper.emitted('input')?.at(-1)).toEqual([42]);
		await type(wrapper, '');
		expect(wrapper.emitted('input')?.at(-1)).toEqual([null]);
	});

	test('integer keydown blocks letters, allows digits and shortcuts', () => {
		const input = mountInput(fieldProps('input_integer')).find('input').element;
		const letter = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
		const digit = new KeyboardEvent('keydown', { key: '5', cancelable: true });
		const paste = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, cancelable: true });
		input.dispatchEvent(letter);
		input.dispatchEvent(digit);
		input.dispatchEvent(paste);
		expect(letter.defaultPrevented).toBe(true);
		expect(digit.defaultPrevented).toBe(false);
		expect(paste.defaultPrevented).toBe(false);
	});

	test('float emits numbers', async () => {
		const wrapper = mountInput(fieldProps('input_float'));
		await type(wrapper, '-3.5');
		expect(wrapper.emitted('input')?.at(-1)).toEqual([-3.5]);
	});

	test('bigInteger stays a string and drops non-digits', async () => {
		const wrapper = mountInput(fieldProps('input_biginteger'));
		const input = wrapper.find('input');
		expect(input.attributes('type')).toBe('text');
		await type(wrapper, '9007199254740993');
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['9007199254740993']);
		await type(wrapper, '12a3');
		expect(input.element.value).toBe('123');
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['123']);
	});

	test('decimal stays a string and turns "," into "."', async () => {
		const wrapper = mountInput(fieldProps('input_decimal'));
		await type(wrapper, '12,5');
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['12.5']);
		await type(wrapper, '1.2.3');
		expect(wrapper.find('input').element.value).toBe('1.23');
	});

	test('step arrows emit the next step and stop at max', async () => {
		const wrapper = mountInput({ ...fieldProps('input_integer'), value: 50 });
		await wrapper.find('[data-step-up]').trigger('click');
		expect(wrapper.emitted('input')?.at(-1)).toEqual([55]);
		await wrapper.setProps({ value: 100 });
		expect(wrapper.find('[data-step-up]').attributes('disabled')).toBeDefined();
		await wrapper.find('[data-step-down]').trigger('click');
		expect(wrapper.emitted('input')?.at(-1)).toEqual([95]);
	});
});

describe('input states', () => {
	test('disabled greys the frame and disables the input', () => {
		const wrapper = mountInput({ ...fieldProps('input_string'), disabled: true });
		expect(wrapper.find('input').attributes('disabled')).toBeDefined();
		expect(wrapper.find('[data-input-frame]').classes()).toContain('bg-gray-50');
	});

	test('nonEditable keeps the normal look and hides the step arrows', () => {
		const wrapper = mountInput({ ...fieldProps('input_integer'), disabled: true, nonEditable: true });
		expect(wrapper.find('[data-input-frame]').classes()).not.toContain('bg-gray-50');
		expect(wrapper.find('[data-step-up]').exists()).toBe(false);
	});

	test('autofocus focuses the input', () => {
		const wrapper = mount(InputInterface, {
			props: { value: null, type: 'string', autofocus: true },
			global: { plugins: [i18n] },
			attachTo: document.body,
		});
		expect(document.activeElement).toBe(wrapper.find('input').element);
		wrapper.unmount();
	});
});
