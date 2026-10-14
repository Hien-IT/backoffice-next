import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import BoAccordion from './BoAccordion.vue';

const items = [
	{ value: 'a', label: 'Alpha' },
	{ value: 'b', label: 'Beta' },
	{ value: 'c', label: 'Gamma' },
];

function setup(props: Record<string, unknown> = {}) {
	const wrapper = mount(BoAccordion, {
		props: { items, modelValue: [] as string[], ...props },
		slots: { content: '<template #content="{ item }"><p data-content>{{ item.value }}</p></template>' },
	});

	wrapper.setProps({ 'onUpdate:modelValue': (value: string[]) => wrapper.setProps({ modelValue: value }) });
	return wrapper;
}

const label = (button: { text(): string }) => button.text().replace('expand_more', '');
const open = (wrapper: ReturnType<typeof setup>) => wrapper.findAll('[data-content]').map((el) => el.text());

describe('BoAccordion', () => {
	test('headers are h3 buttons with aria-expanded; the open item shows its content', async () => {
		const wrapper = setup({ modelValue: ['b'] });
		const buttons = wrapper.findAll('h3 > button');

		expect(buttons.map(label)).toEqual(['Alpha', 'Beta', 'Gamma']);
		expect(buttons.map((button) => button.attributes('aria-expanded'))).toEqual(['false', 'true', 'false']);
		expect(open(wrapper)).toEqual(['b']);
	});

	test('single mode: opening one closes the other, a second click closes it', async () => {
		const wrapper = setup({ modelValue: ['a'] });
		const buttons = wrapper.findAll('h3 > button');

		await buttons[1]!.trigger('click');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['b']]);
		expect(open(wrapper)).toEqual(['b']);

		await buttons[1]!.trigger('click');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[]]);
	});

	test('single mode ignores Shift (no toggle-all)', async () => {
		const wrapper = setup();

		await wrapper.findAll('h3 > button')[0]!.trigger('click', { shiftKey: true });
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['a']]);
	});

	test('multiple mode: items open independently; Shift+click opens all, then closes all', async () => {
		const wrapper = setup({ multiple: true, modelValue: ['a'] });
		const buttons = wrapper.findAll('h3 > button');

		await buttons[1]!.trigger('click');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['a', 'b']]);

		await buttons[0]!.trigger('click', { shiftKey: true });
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['a', 'b', 'c']]);
		expect(open(wrapper)).toEqual(['a', 'b', 'c']);

		await buttons[2]!.trigger('click', { shiftKey: true });
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[]]);
		expect(open(wrapper)).toEqual([]);
	});

	test('the chevron turns with the open state and has no transition under reduced motion', () => {
		const wrapper = setup();
		const chevron = wrapper.get('h3 > button [aria-hidden="true"]');

		expect(chevron.classes()).toContain('group-data-[state=open]:rotate-180');
		expect(chevron.classes()).toContain('motion-reduce:transition-none');
	});

	test('the trigger slot gets the item and its state', () => {
		const wrapper = mount(BoAccordion, {
			props: { items, modelValue: ['c'] },
			slots: { trigger: '<template #trigger="{ item, open }">{{ item.label }}={{ open }}</template>' },
		});

		expect(wrapper.findAll('h3 > button').map(label)).toEqual(['Alpha=false', 'Beta=false', 'Gamma=true']);
	});
});
