// Backoffice (spec 028, D-206): the text control of a filter value accepts `$FIELD(b)` whatever the pattern of the type
// (DR only lets its dynamic variables and `{{ }}` through the integer and uuid patterns).
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import { i18n } from '../../../lang/index.ts';
import InputComponent from './InputComponent.vue';

enableAutoUnmount(afterEach);

function setup(type: string, value: string | null = null) {
	const wrapper = mount(InputComponent, {
		props: { is: 'interface-input', type, value, focus: false },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	return { wrapper, input: wrapper.get('input') };
}

test.each([
	['integer', '$FIELD(paid_amount)'],
	['integer', '$FIELD( paid_amount )'],
	['uuid', '$FIELD(owner)'],
	['decimal', '$FIELD(total)'],
	['integer', '$NOW(-1 day)'],
	['integer', '42'],
])('a %s field takes %s', async (type, typed) => {
	const { wrapper, input } = setup(type);
	await input.setValue(typed);

	expect(input.attributes('aria-invalid')).toBeUndefined();
	expect(wrapper.emitted('input')?.at(-1)).toEqual([typed]);
});

test.each([
	['integer', '$field(paid_amount)'],
	['integer', '$FIELD(paid_amount'],
	['integer', 'abc'],
	['uuid', 'not-a-uuid'],
])('a %s field refuses %s as before (nothing emitted)', async (type, typed) => {
	const { wrapper, input } = setup(type);
	await input.setValue(typed);

	expect(wrapper.emitted('input')).toBeUndefined();
});

test('a $FIELD value is shown as it is in the input', () => {
	const { input } = setup('integer', '$FIELD(paid_amount)');
	expect((input.element as HTMLInputElement).value).toBe('$FIELD(paid_amount)');
	expect(input.attributes('aria-invalid')).toBeUndefined();
});
