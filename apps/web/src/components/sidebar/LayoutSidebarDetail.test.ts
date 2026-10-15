import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import { useSidebarStore } from '../../layout/stores/sidebar.ts';
import BoSelect from '../BoSelect.vue';
import LayoutSidebarDetail from './LayoutSidebarDetail.vue';

vi.mock('../../layouts/index.ts', () => {
	const layouts = [
		{ id: 'cards', name: '$t:layouts.cards.cards', icon: 'grid_4' },
		{ id: 'tabular', name: '$t:layouts.tabular.tabular', icon: 'table_rows' },
	];

	return { getLayouts: () => layouts, getLayout: (id: string) => layouts.find((l) => l.id === id) };
});

enableAutoUnmount(afterEach);

beforeEach(() => {
	setActivePinia(createPinia());
	useSidebarStore().activeAccordionItem = 'layout';
});

function setup(modelValue: string | null) {
	return mount(LayoutSidebarDetail, {
		props: { modelValue },
		slots: { default: '<p data-options>options</p>' },
		global: { plugins: [i18n] },
	});
}

test('lists the registered layouts with name and icon, and the layout options slot', () => {
	const wrapper = setup('cards');
	const select = wrapper.findComponent(BoSelect);

	expect(wrapper.text()).toContain('Layout Options');
	expect(select.props('label')).toBe('Layout');
	expect(select.props('items')).toEqual([
		{ text: 'Cards', value: 'cards', icon: 'grid_4' },
		{ text: 'Table', value: 'tabular', icon: 'table_rows' },
	]);
	expect(select.props('modelValue')).toBe('cards');
	expect(wrapper.find('[data-options]').exists()).toBe(true);
});

test('null or an unknown layout shows tabular; choosing emits the id', async () => {
	expect(setup(null).findComponent(BoSelect).props('modelValue')).toBe('tabular');

	const wrapper = setup('unknown');
	expect(wrapper.findComponent(BoSelect).props('modelValue')).toBe('tabular');

	wrapper.findComponent(BoSelect).vm.$emit('update:modelValue', 'cards');
	expect(wrapper.emitted('update:modelValue')).toEqual([['cards']]);
});
