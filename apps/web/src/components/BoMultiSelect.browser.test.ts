import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { i18n } from '../lang/index.ts';
import '../styles/index.css';
import BoMultiSelect from './BoMultiSelect.vue';

// With the app CSS: the Material Symbols rule is unlayered, so a `hidden` utility on the check icon showed it anyway.
enableAutoUnmount(afterEach);

test('only checked options show the check icon', async () => {
	const wrapper = mount(BoMultiSelect, {
		props: {
			modelValue: ['b'],
			items: [
				{ text: 'A', value: 'a' },
				{ text: 'B', value: 'b' },
			],
		},
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	await wrapper.get('button').trigger('click');
	await vi.waitFor(() => expect(document.querySelectorAll('[role="option"]')).toHaveLength(2));

	const checkOpacity = [...document.querySelectorAll('[role="option"] [data-icon="check"]')].map(
		(icon) => getComputedStyle(icon).opacity,
	);
	expect(checkOpacity).toEqual(['0', '1']);
});
