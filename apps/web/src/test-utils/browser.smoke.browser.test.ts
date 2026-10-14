import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import BoButton from '../components/BoButton.vue';

// The browser project runs in real chromium (T003): layout and focus exist, unlike happy-dom.
test('mounts a component in chromium', async () => {
	const wrapper = mount(BoButton, { slots: { default: 'Save' }, attachTo: document.body });
	const button = wrapper.get('button').element;

	button.focus();
	expect(document.activeElement).toBe(button);
	expect(button.getBoundingClientRect().height).toBeGreaterThan(0);
	wrapper.unmount();
});
