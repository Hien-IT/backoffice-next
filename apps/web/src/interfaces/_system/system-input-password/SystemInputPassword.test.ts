// Feature 015 (T071, FR-081): system-input-password, as Directus input-password.vue.
import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { i18n } from '../../../lang/index.ts';
import config from './index.ts';
import SystemInputPassword from './SystemInputPassword.vue';

function mountPassword(props: Record<string, unknown> = {}) {
	return mount(SystemInputPassword, { props, global: { plugins: [i18n] }, attachTo: document.body });
}

describe('system-input-password', () => {
	test('is registered with the Directus config', () => {
		expect(config).toMatchObject({
			id: 'system-input-password',
			icon: 'visibility',
			system: true,
			group: 'standard',
			types: ['string', 'text'],
		});
		expect((config.options as { field: string }[]).map((option) => option.field)).toEqual(['placeholder']);
	});

	test('a password input with new-password autocomplete and the password placeholder by default', () => {
		const input = mountPassword().get('input');

		expect(input.attributes('type')).toBe('password');
		expect(input.attributes('autocomplete')).toBe('new-password');
		expect(input.attributes('placeholder')).toBe('Password');
	});

	test('option:system-input-password.placeholder, and the autocomplete prop', () => {
		const input = mountPassword({ autocomplete: 'current-password', placeholder: 'Secret' }).get('input');

		expect(input.attributes('autocomplete')).toBe('current-password');
		expect(input.attributes('placeholder')).toBe('Secret');
	});

	test('the eye button shows and hides the value, named by its action', async () => {
		const wrapper = mountPassword({ value: 'abc' });
		const button = wrapper.get('button');

		expect(button.attributes('aria-label')).toBe('Show password');
		await button.trigger('click');
		expect(wrapper.get('input').attributes('type')).toBe('text');
		expect(button.attributes('aria-label')).toBe('Hide password');
		await button.trigger('click');
		expect(wrapper.get('input').attributes('type')).toBe('password');
		wrapper.unmount();
	});

	test('typing emits input; autofocus focuses the field; disabled disables it', async () => {
		const wrapper = mountPassword({ autofocus: true });

		expect(document.activeElement).toBe(wrapper.get('input').element);
		await wrapper.get('input').setValue('s3cret');
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['s3cret']);
		wrapper.unmount();

		expect(mountPassword({ disabled: true }).get('input').attributes('disabled')).toBeDefined();
	});
});
