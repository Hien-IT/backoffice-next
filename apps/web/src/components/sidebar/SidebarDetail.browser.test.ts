import { userEvent } from '@vitest/browser/context';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { expect, test } from 'vitest';
import { defineComponent, h } from 'vue';
import { i18n } from '../../lang/index.ts';
import { useSidebarStore } from '../../layout/stores/sidebar.ts';
import SidebarDetail from './SidebarDetail.vue';

// Native button activation needs real focus and key handling.
test('Enter and Space toggle the focused section header', async () => {
	setActivePinia(createPinia());
	const Panel = defineComponent({
		setup: () => () => [
			h(SidebarDetail, { id: 'a', title: 'Alpha', icon: 'info' }, () => 'A'),
			h(SidebarDetail, { id: 'b', title: 'Beta', icon: 'info' }, () => 'B'),
		],
	});
	const wrapper = mount(Panel, { global: { plugins: [i18n] }, attachTo: document.body });
	const store = useSidebarStore();
	const buttons = wrapper.findAll('h3 > button');

	await userEvent.tab();
	expect(document.activeElement).toBe(buttons[0]!.element);
	await userEvent.keyboard('{Enter}');
	expect(store.activeAccordionItem).toBe('a');
	expect(buttons[0]!.attributes('aria-expanded')).toBe('true');

	await userEvent.tab();
	expect(document.activeElement).toBe(buttons[1]!.element);
	await userEvent.keyboard(' ');
	expect(store.activeAccordionItem).toBe('b');
	expect(buttons.map((b) => b.attributes('aria-expanded'))).toEqual(['false', 'true']);

	await userEvent.keyboard(' ');
	expect(store.activeAccordionItem).toBeNull();
	wrapper.unmount();
});
