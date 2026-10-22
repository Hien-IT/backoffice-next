import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { h } from 'vue';
import BoEditorFrame from './BoEditorFrame.vue';

const frame = (wrapper: ReturnType<typeof mount>) => wrapper.get('.bo-editor-frame');

describe('BoEditorFrame', () => {
	test('FIELD border with the brand focus ring by default; content in the default slot', () => {
		const wrapper = mount(BoEditorFrame, { slots: { default: () => h('div', { class: 'area' }, 'x') } });

		expect(frame(wrapper).classes()).toEqual(
			expect.arrayContaining(['border-gray-300', 'focus-within:border-brand-500', 'dark:bg-gray-900']),
		);
		expect(wrapper.find('.area').exists()).toBe(true);
		expect(wrapper.find('[role="toolbar"]').exists()).toBe(false);
		expect(wrapper.find('[data-remaining]').exists()).toBe(false);
	});

	test('invalid and disabled states', () => {
		const invalid = mount(BoEditorFrame, { props: { invalid: true } });
		expect(frame(invalid).classes()).toContain('border-error-600');
		expect(frame(invalid).attributes('data-invalid')).toBe('true');

		const disabled = mount(BoEditorFrame, { props: { disabled: true, invalid: true } });
		expect(frame(disabled).classes()).toEqual(expect.arrayContaining(['border-gray-100', 'bg-gray-50']));
		expect(frame(disabled).classes()).not.toContain('border-error-600');
		expect(frame(disabled).attributes('data-disabled')).toBe('true');
	});

	test('toolbar row: Reka toolbar with the label and the controlled editor', () => {
		const wrapper = mount(BoEditorFrame, {
			props: { toolbarLabel: 'Toolbar', controls: 'editor-1' },
			slots: { toolbar: () => h('button', 'B') },
		});
		const toolbar = wrapper.get('[role="toolbar"]');

		expect(toolbar.attributes('aria-label')).toBe('Toolbar');
		expect(toolbar.attributes('aria-controls')).toBe('editor-1');
		expect(toolbar.text()).toBe('B');
	});

	test('softLength counter: remaining count, warning below 10 %, danger below 5 %', async () => {
		const wrapper = mount(BoEditorFrame, { props: { softLength: 100, count: 20, counterId: 'counter-1' } });
		const counter = () => wrapper.get('[data-remaining]');

		expect(counter().text()).toBe('80');
		expect(counter().attributes('id')).toBe('counter-1');
		expect(counter().classes()).toContain('text-gray-500');

		await wrapper.setProps({ count: 92 });
		expect(counter().text()).toBe('8');
		expect(counter().classes()).toContain('text-warning-700');

		await wrapper.setProps({ count: 97 });
		expect(counter().classes()).toContain('text-error-600');

		await wrapper.setProps({ count: 120 });
		expect(counter().text()).toBe('-20');

		await wrapper.setProps({ count: 0, counterId: undefined });
		expect(counter().text()).toBe('100');
		expect(counter().attributes('id')).toBeTruthy();
	});
});
