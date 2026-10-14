// Ported from directus/app/src/components/v-text-overflow.test.ts
// Backoffice: no snapshot of the Directus markup; the title is set only when the text is cut (no highlight prop).
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import { nextTick } from 'vue';
import BoTextOverflow from './BoTextOverflow.vue';

test('Mount component', () => {
	const wrapper = mount(BoTextOverflow, { props: { text: 'My text' } });

	expect(wrapper.text()).toBe('My text');
	expect(wrapper.classes()).toContain('truncate');
	expect(wrapper.attributes('title')).toBeUndefined();
});

test('shows the full text as title when it overflows', async () => {
	Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 200 });
	Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 100 });

	try {
		const wrapper = mount(BoTextOverflow, { props: { text: { a: 1 } } });
		await nextTick();

		expect(wrapper.attributes('title')).toBe('{"a":1}');
	} finally {
		delete (HTMLElement.prototype as any).scrollWidth;
		delete (HTMLElement.prototype as any).offsetWidth;
	}
});
