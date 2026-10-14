// Ported from directus/app/src/interfaces/input-hash/input-hash.test.ts
// Backoffice: no stubs (InputField is the real v-input port); the second half adds the fixture, FR-066 and option
// tests of contracts/tests.md §5.
import type { FieldRaw } from '@directus/types';
import { mount } from '@vue/test-utils';
import { describe, expect, it, test } from 'vitest';
import { computed } from 'vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import config from './index.ts';
import InputHash from './InputHash.vue';

const global = {
	plugins: [i18n],
};

describe('Interface', () => {
	it('should mount', () => {
		const wrapper = mount(InputHash, {
			props: {
				value: null,
			},
			global,
		});

		expect(wrapper.exists()).toBe(true);
	});

	it('should be of type password when prop masked is true', () => {
		const wrapper = mount(InputHash, {
			props: {
				value: null,
				masked: true,
			},
			global,
		});

		expect(wrapper.find('input').attributes('type')).toBe('password');
		expect(wrapper.find('input').attributes('autocomplete')).toBe('new-password');
	});

	it('should set autocomplete to off even when prop masked is true', () => {
		const wrapper = mount(InputHash, {
			props: {
				value: null,
				masked: true,
				autocomplete: 'off',
			},
			global,
		});

		expect(wrapper.find('input').attributes('type')).toBe('password');
		expect(wrapper.find('input').attributes('autocomplete')).toBe('off');
	});
});

/* ------------------------------------------------------------------ fixture and option tests (contracts/tests.md §5) */

const field = fieldsOf('bo_std').find((f) => f.field === 'input_hash') as FieldRaw;
const stored = itemOf('bo_std', 1)['input_hash'] as string;

function mountHash(props: Record<string, unknown> = {}) {
	return mount(InputHash, {
		props: { ...(field.meta?.options ?? {}), value: stored, type: field.type, ...props } as any,
		global,
	});
}

describe('input-hash', () => {
	test('is registered with the Directus config', () => {
		expect(config).toMatchObject({ id: 'input-hash', types: ['hash'], component: InputHash });
	});

	test('never puts the stored hash in the input (FR-066)', () => {
		const wrapper = mountHash();
		const input = wrapper.find('input');
		expect(stored).toMatch(/^\$argon2/);
		expect(input.element.value).toBe('');
		expect(wrapper.html()).not.toContain(stored);
		expect(input.attributes('placeholder')).toBe('Value Securely Stored');
		expect(wrapper.find('[data-lock]').text()).toBe('lock');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('option:input-hash.placeholder shows when no hash is stored', () => {
		const wrapper = mountHash({ value: null });
		expect(wrapper.find('input').attributes('placeholder')).toBe('Secret');
		expect(wrapper.find('[data-lock]').text()).toBe('lock_open');
	});

	test('option:input-hash.masked', () => {
		expect(mountHash().find('input').attributes('type')).toBe('password');
		expect(mountHash({ masked: undefined }).find('input').attributes('type')).toBe('text');
		expect(mountHash({ masked: undefined }).find('input').attributes('autocomplete')).toBe('off');
	});

	test('emits the typed plain text and opens the lock', async () => {
		const wrapper = mountHash();
		await wrapper.find('input').setValue('new secret');
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['new secret']);
		expect(wrapper.find('[data-lock]').text()).toBe('lock_open');
		expect(wrapper.find('[data-lock]').classes()).toContain('text-warning-600');
	});

	test('disabled', () => {
		const wrapper = mountHash({ disabled: true });
		expect(wrapper.find('input').attributes('disabled')).toBeDefined();
		expect(wrapper.find('[data-lock]').classes()).toContain('text-gray-500');
	});

	test('nonEditable keeps the hashed colors', () => {
		const wrapper = mountHash({ disabled: true, nonEditable: true });
		expect(wrapper.find('[data-lock]').classes()).toContain('text-brand-500');
	});

	test('the input is linked to the form label and messages (FR-094)', () => {
		const a11y = computed(() => ({ inputId: 'f-input', labelId: 'f-label', describedBy: 'f-error', invalid: true }));
		const wrapper = mount(InputHash, {
			props: { value: stored },
			global: { ...global, provide: { [FORM_FIELD_A11Y as symbol]: a11y } },
		});
		const input = wrapper.find('input');
		expect(input.attributes('id')).toBe('f-input');
		expect(input.attributes('aria-describedby')).toBe('f-error');
		expect(input.attributes('aria-invalid')).toBe('true');
	});
});
