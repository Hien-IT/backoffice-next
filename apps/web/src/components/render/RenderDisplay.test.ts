// DR has no test for render-display.vue (spec FR-070): null, unknown display, display props, render error.
import { mount } from '@vue/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { nextTick } from 'vue';
import { i18n } from '../../lang/index.ts';
import RenderDisplay from './RenderDisplay.vue';
import { FAKE_DISPLAYS } from './test-displays.ts';

vi.mock('../../displays/index.ts', () => ({ getDisplay: (id: string | null) => (id ? FAKE_DISPLAYS[id] : undefined) }));

const base = { type: 'string', collection: 'articles', field: 'title' };

function mountDisplay(props: Record<string, unknown>) {
	return mount(RenderDisplay, { props: { ...base, display: null, ...props }, global: { plugins: [i18n] } });
}

describe('RenderDisplay', () => {
	test('null and undefined show ValueNull', () => {
		for (const value of [null, undefined]) {
			const wrapper = mountDisplay({ display: 'fake', value });

			expect(wrapper.get('[aria-hidden="true"]').text()).toBe('--');
			expect(wrapper.get('.sr-only').text()).toBe('No value');
			expect(wrapper.find('.fake').exists()).toBe(false);
		}
	});

	test('a display that is not registered shows the value as text', () => {
		expect(mountDisplay({ display: 'badge', value: 'draft' }).text()).toBe('draft');
		expect(mountDisplay({ display: null, value: 3 }).text()).toBe('3');
	});

	test('passes display options and the field props to the display', () => {
		const wrapper = mountDisplay({
			display: 'fake',
			value: 'hello',
			options: { suffix: '!' },
			interface: 'input',
			interfaceOptions: { trim: true },
		});

		expect(wrapper.get('.fake').text()).toBe('"hello"!');
		expect(wrapper.getComponent({ name: 'FakeDisplay' }).props()).toMatchObject({
			value: 'hello',
			interface: 'input',
			interfaceOptions: { trim: true },
			type: 'string',
			collection: 'articles',
			field: 'title',
		});
	});

	test('a display that throws falls back to the value as text', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const wrapper = mountDisplay({ display: 'broken', value: 'kept' });
		await nextTick();

		expect(wrapper.text()).toBe('kept');
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('[display-broken-error]'));
		warn.mockRestore();
	});
});
