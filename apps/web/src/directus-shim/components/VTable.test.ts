// Spec 020 (T114, data-model §7 row 53): VTable maps headers/items/itemKey onto BoTable and selects row objects unless
// `selectionUseKeys`, as v-table.
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import { i18n } from '../../lang/index.ts';
import VTable from './VTable.vue';

enableAutoUnmount(afterEach);

const headers = [
	{ text: 'Name', value: 'name', width: 200, custom: 'kept' },
	{ text: 'Status', value: 'status' },
];
const items = [
	{ code: 'a', name: 'Alpha', status: 'draft' },
	{ code: 'b', name: 'Beta', status: 'published' },
];

function setup(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
	return mount(VTable, {
		props: { headers, items, itemKey: 'code', showSelect: 'multiple', ...props },
		slots,
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
}

const boxes = (wrapper: ReturnType<typeof setup>) => wrapper.findAll('tbody [role="checkbox"]');

test('headers are the columns, items the rows, 48 px rows by default', () => {
	const wrapper = setup();

	const titles = wrapper.findAll('thead th').map((th) => th.text());
	expect(titles.some((text) => text.startsWith('Name'))).toBe(true);
	expect(titles.some((text) => text.startsWith('Status'))).toBe(true);
	expect(wrapper.findAll('tbody tr').map((tr) => tr.text())).toEqual(['Alphadraft', 'Betapublished']);
	expect((wrapper.get('tbody tr').element as HTMLElement).style.height).toBe('48px');
});

test('selection is row objects by default, keys with selectionUseKeys; item-selected per changed row', async () => {
	const wrapper = setup({ modelValue: [items[1]] });

	expect(boxes(wrapper)[1]!.attributes('aria-checked')).toBe('true');

	await boxes(wrapper)[0]!.trigger('click');
	expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([[items[1], items[0]]]);
	expect(wrapper.emitted('item-selected')!.at(-1)).toEqual([{ item: items[0], value: true }]);

	await wrapper.setProps({ selectionUseKeys: true, modelValue: ['a'] });
	expect(boxes(wrapper)[0]!.attributes('aria-checked')).toBe('true');

	await boxes(wrapper)[0]!.trigger('click');
	expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([[]]);
	expect(wrapper.emitted('item-selected')!.at(-1)).toEqual([{ item: items[0], value: false }]);
});

test('slots get the Directus slot props: header for header slots, item for cells', () => {
	const wrapper = setup(
		{},
		{
			'header.name': '<template #header.name="{ header }">H:{{ header.text }}:{{ header.align }}</template>',
			'item.status': '<template #item.status="{ item }">S:{{ item.code }}</template>',
			footer: '<p class="foot">Footer</p>',
		},
	);

	expect(wrapper.text()).toContain('H:Name:left');
	expect(wrapper.findAll('tbody tr').map((tr) => tr.text())).toEqual(['AlphaS:a', 'BetaS:b']);
	expect(wrapper.find('table .foot').exists()).toBe(false);
	expect(wrapper.get('.foot').text()).toBe('Footer');
});

test('rows emit click:row when clickable, not when clickable is false or disabled', async () => {
	const wrapper = setup({ showSelect: 'none' });

	await wrapper.get('tbody tr').trigger('click');
	expect(wrapper.emitted('click:row')![0]![0]).toMatchObject({ item: items[0] });
	expect(wrapper.get('tbody tr').attributes('tabindex')).toBe('0');

	await wrapper.setProps({ clickable: false });
	await wrapper.get('tbody tr').trigger('click');
	expect(wrapper.emitted('click:row')).toHaveLength(1);
	expect(wrapper.get('tbody tr').attributes('tabindex')).toBeUndefined();
});

test('sort passes through as update:sort', async () => {
	const wrapper = setup({ showSelect: 'none' });

	await wrapper
		.findAll('thead button')
		.find((b) => b.text().includes('Name'))!
		.trigger('click');
	expect(wrapper.emitted('update:sort')).toEqual([[{ by: 'name', desc: false }]]);
});
