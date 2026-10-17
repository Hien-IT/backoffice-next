// Directus has no test for v-fancy-select: all items until one is chosen, then only it with a deselect button.
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import { i18n } from '../lang/index.ts';
import BoFancySelect from './BoFancySelect.vue';

const items = [
	{ value: 'input', text: 'Input', icon: 'title', iconRight: 'star' },
	{ divider: true as const },
	{ value: 'tags', text: 'Tags', icon: 'local_offer', description: 'Keywords' },
];

test('lists every option, then only the chosen one with a deselect button', async () => {
	const wrapper = mount(BoFancySelect, { props: { items, modelValue: null }, global: { plugins: [i18n] } });

	expect(wrapper.findAll('button[aria-pressed]').map((b) => b.text())).toEqual([
		'titleInputstar',
		'local_offerTagsKeywords',
	]);
	expect(wrapper.find('hr').exists()).toBe(true);
	await wrapper.findAll('button[aria-pressed]')[1]!.trigger('click');
	expect(wrapper.emitted('update:modelValue')).toEqual([['tags']]);

	await wrapper.setProps({ modelValue: 'tags' });
	expect(wrapper.findAll('button[aria-pressed]')).toHaveLength(1);
	expect(wrapper.find('button[aria-pressed]').attributes('aria-pressed')).toBe('true');
	await wrapper.find(`button[aria-label="${i18n.global.t('deselect')}"]`).trigger('click');
	expect(wrapper.emitted('update:modelValue')![1]).toEqual([null]);

	await wrapper.setProps({ disabled: true });
	expect(wrapper.find(`button[aria-label="${i18n.global.t('deselect')}"]`).exists()).toBe(false);
});

// Feature 018 (recipe Q-37): the grid of the panel drawer keeps every item (no divider), subdues the others once one is
// chosen, and pressing the chosen card clears it.
test('grid layout: all items stay, the chosen one pressed, the others subdued', async () => {
	const wrapper = mount(BoFancySelect, {
		props: { items, modelValue: 'tags', layout: 'grid' },
		global: { plugins: [i18n] },
	});

	const cards = wrapper.findAll('button[aria-pressed]');
	expect(cards.map((b) => b.text())).toEqual(['titleInput', 'local_offerTagsKeywords']);
	expect(wrapper.find('hr').exists()).toBe(false);
	expect(cards.map((b) => b.attributes('aria-pressed'))).toEqual(['false', 'true']);
	expect(cards[0]!.classes()).toContain('opacity-60');

	await cards[1]!.trigger('click');
	await cards[0]!.trigger('click');
	expect(wrapper.emitted('update:modelValue')).toEqual([[null], ['input']]);
});
