import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import BoTooltip from './BoTooltip.vue';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('BoTooltip', () => {
	test('shows the text when the trigger gets keyboard focus, without an app provider', async () => {
		const wrapper = mount(BoTooltip, {
			props: { text: 'Content', side: 'right' },
			slots: { default: '<button type="button" aria-label="Content">x</button>' },
			attachTo: document.body,
		});
		const trigger = wrapper.get('button').element;

		expect(document.body.querySelector('[role="tooltip"]')).toBeNull();

		trigger.dispatchEvent(new FocusEvent('focus'));
		await flushPromises();

		expect(document.body.querySelector('[role="tooltip"]')?.textContent).toContain('Content');
		wrapper.unmount();
	});
});
