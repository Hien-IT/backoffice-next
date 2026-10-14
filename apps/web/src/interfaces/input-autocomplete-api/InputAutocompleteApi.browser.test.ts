// Keyboard path of input-autocomplete-api (contracts/tests.md §5.6): type, ArrowDown, Enter picks a suggestion.
import { userEvent } from '@vitest/browser/context';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, expect, test, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import { mockApi } from '../../test-utils/fetch.ts';
import InputAutocompleteApi from './InputAutocompleteApi.vue';

afterEach(() => {
	vi.unstubAllGlobals();
	document.body.innerHTML = '';
});

test('typing shows the suggestions and Enter picks the highlighted one', async () => {
	setActivePinia(createPinia());
	mockApi({ 'GET /items/targets': [{ name: 'Target one' }, { name: 'Target two' }] });

	const wrapper = mount(InputAutocompleteApi, {
		props: {
			value: null,
			url: '/items/targets?search={{value}}',
			resultsPath: 'data',
			textPath: 'name',
			valuePath: 'name',
			trigger: 'debounce',
			rate: 0,
		},
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	await userEvent.click(wrapper.get('input').element);
	await userEvent.keyboard('Tar');
	await vi.waitFor(() => expect(document.querySelectorAll('[role="option"]')).toHaveLength(2));

	// Reka highlights the first suggestion on open; ArrowDown moves to the second.
	await userEvent.keyboard('{ArrowDown}');
	await userEvent.keyboard('{Enter}');

	expect(wrapper.emitted('input')?.at(-1)).toEqual(['Target two']);
	wrapper.unmount();
});
