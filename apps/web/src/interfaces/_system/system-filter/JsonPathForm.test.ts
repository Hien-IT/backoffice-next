// Backoffice (spec 023, D-187): the path and type step of the filter popover.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import BoSelect from '../../../components/BoSelect.vue';
import { i18n } from '../../../lang/index.ts';
import JsonPathForm from './JsonPathForm.vue';

enableAutoUnmount(afterEach);

function setup(props: Record<string, unknown> = {}) {
	return mount(JsonPathForm, {
		props: { title: 'Tags', ...props },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
}

describe('JsonPathForm', () => {
	test('apply emits a valid path and the chosen type; an invalid one shows the linked error and emits nothing', async () => {
		const wrapper = setup();
		const input = wrapper.get('input[placeholder]');

		await input.setValue('items[');
		await wrapper.get('form').trigger('submit');
		expect(wrapper.emitted('apply')).toBeUndefined();

		const error = wrapper.get('[role="alert"]');
		expect(error.text()).toContain('Invalid JSON path');
		expect(input.attributes('aria-describedby')).toContain(error.attributes('id'));
		expect(input.attributes('aria-invalid')).toBe('true');

		await input.setValue(' items[*].sku ');
		wrapper.getComponent(BoSelect).vm.$emit('update:modelValue', 'boolean');
		await flushPromises();
		await wrapper.get('form').trigger('submit');
		expect(wrapper.emitted('apply')).toEqual([[{ path: 'items[*].sku', type: 'boolean' }]]);
	});

	test('prefilled when editing; the back button only when adding', async () => {
		const editing = setup({ path: 'Amount', type: 'number' });
		expect((editing.get('input[placeholder]').element as HTMLInputElement).value).toBe('Amount');
		expect(editing.find('.json-path-back').exists()).toBe(false);
		expect(editing.getComponent(BoSelect).props('modelValue')).toBe('number');
		expect(editing.get('[role="combobox"]').text()).toContain('Number');

		const adding = setup({ back: true });
		await adding.get('.json-path-back').trigger('click');
		expect(adding.emitted('back')).toHaveLength(1);
		expect(adding.text()).toContain('JSON path (Tags)');
	});
});
