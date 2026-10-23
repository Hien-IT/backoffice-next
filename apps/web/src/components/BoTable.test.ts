// Ported from directus/app/src/components/v-table/table-header.test.ts
// Backoffice: BoTable is one component (header + rows); the DR sort cases plus selection, resize, spacing,
// loading and empty states of the simple Table recipe, manual sort (v-table `manualSortKey`), `click:row` and the
// `item-append` slot.
import { mount } from '@vue/test-utils';
import Draggable from 'vuedraggable';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { i18n } from '../lang/index.ts';
import BoTable, { type BoTableColumn } from './BoTable.vue';

const columns: BoTableColumn[] = [
	{ key: 'name', label: 'Name' },
	{ key: 'count', label: 'Count', width: 80, align: 'right', sortable: false },
];

const rows = [
	{ id: 1, name: 'One', count: 1 },
	{ id: 2, name: 'Two', count: 2 },
];

function mountTable(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
	return mount(BoTable, { props: { columns, rows, ...props }, slots, global: { plugins: [i18n] } });
}

afterEach(() => {
	vi.useRealTimers();
});

describe('BoTable', () => {
	test('renders the columns, rows, alignment and default width', () => {
		const wrapper = mountTable({ caption: 'Items' });

		expect(wrapper.get('caption').text()).toBe('Items');
		expect(wrapper.findAll('thead th[scope="col"]').map((th) => th.text().replace('arrow_upward', ''))).toEqual([
			'Name',
			'Count',
		]);
		expect(wrapper.findAll('tbody tr').map((tr) => tr.findAll('td').map((td) => td.text()))).toEqual([
			['One', '1', ''],
			['Two', '2', ''],
		]);
		expect(wrapper.findAll('col').map((col) => col.attributes('style'))).toEqual([
			'width: 130px;',
			'width: 80px;',
			undefined,
		]);
		expect(wrapper.findAll('tbody td')[1]!.classes()).toContain('text-end');
	});

	test('renders the item and header slots', () => {
		const wrapper = mountTable(
			{},
			{ 'item.name': '<b>{{ params.item.name }}!</b>', 'header.name': '<i>{{ params.column.label }}</i>' },
		);

		expect(wrapper.get('tbody b').text()).toBe('One!');
		expect(wrapper.get('thead i').text()).toBe('Name');
	});

	test('sorts as Directus: asc, desc, then none; mustSort toggles; unsortable columns have no button', async () => {
		const wrapper = mountTable();
		const button = () => wrapper.get('thead th button');

		expect(wrapper.findAll('thead th[scope="col"]')[0]!.attributes('aria-sort')).toBe('none');
		expect(wrapper.findAll('thead th[scope="col"]')[1]!.find('button').exists()).toBe(false);
		expect(wrapper.findAll('thead th[scope="col"]')[1]!.attributes('aria-sort')).toBeUndefined();

		await button().trigger('click');
		await wrapper.setProps({ sort: { by: 'name', desc: false } });
		expect(wrapper.findAll('thead th[scope="col"]')[0]!.attributes('aria-sort')).toBe('ascending');

		await button().trigger('click');
		await wrapper.setProps({ sort: { by: 'name', desc: true } });
		expect(wrapper.findAll('thead th[scope="col"]')[0]!.attributes('aria-sort')).toBe('descending');

		await button().trigger('click');

		expect(wrapper.emitted('update:sort')).toEqual([[{ by: 'name', desc: false }], [{ by: 'name', desc: true }], [null]]);

		const must = mountTable({ sort: { by: 'name', desc: true }, mustSort: true });
		await must.get('thead th button').trigger('click');
		expect(must.emitted('update:sort')).toEqual([[{ by: 'name', desc: false }]]);
	});

	test('selects multiple rows by key, with select all and indeterminate header', async () => {
		const wrapper = mountTable({ showSelect: 'multiple', modelValue: [] });
		const boxes = () => wrapper.findAll('button[role="checkbox"]');

		expect(boxes()).toHaveLength(3);
		expect(boxes()[0]!.attributes('aria-label')).toBe('Select All');
		expect(boxes()[1]!.attributes('aria-label')).toBe('Select Item');

		await boxes()[2]!.trigger('click');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[2]]);

		await wrapper.setProps({ modelValue: [2] });
		expect(boxes()[0]!.attributes('aria-checked')).toBe('mixed');
		expect(wrapper.findAll('tbody tr')[1]!.attributes('aria-selected')).toBe('true');
		expect(wrapper.findAll('tbody tr')[0]!.attributes('aria-selected')).toBe('false');

		await boxes()[0]!.trigger('click');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[1, 2]]);

		await wrapper.setProps({ modelValue: [1, 2] });
		await boxes()[0]!.trigger('click');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[]]);

		await boxes()[1]!.trigger('click');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[2]]);
	});

	test('keeps one selected row in single mode, no select column when disabled', async () => {
		const wrapper = mountTable({ showSelect: 'one', modelValue: [1] });

		expect(wrapper.findAll('thead button[role="checkbox"]')).toHaveLength(0);
		await wrapper.findAll('tbody button[role="checkbox"]')[1]!.trigger('click');
		expect(wrapper.emitted('update:modelValue')).toEqual([[[2]]]);

		const disabled = mountTable({ showSelect: 'multiple', disabled: true });
		expect(disabled.findAll('button[role="checkbox"]')).toHaveLength(0);
		expect(disabled.find('thead th button').exists()).toBe(false);
	});

	test('row height follows the spacing', () => {
		expect(mountTable({ spacing: 'compact' }).get('tbody tr').classes()).toContain('h-[29px]');
		expect(mountTable().get('tbody tr').classes()).toContain('h-[43px]');
		expect(mountTable({ spacing: 'comfortable' }).get('tbody tr').classes()).toContain('h-[58px]');
	});

	test('shows loading and empty states', () => {
		const loading = mountTable({ rows: [], loading: true });
		expect(loading.get('table').attributes('aria-busy')).toBe('true');
		expect(loading.find('[role="progressbar"]').exists()).toBe(true);
		expect(loading.get('tbody').text()).toBe('Loading...');

		expect(mountTable({ rows: [] }).get('tbody').text()).toBe('No items');
		expect(mountTable({ rows: [], noItemsText: 'Nothing' }).get('tbody').text()).toBe('Nothing');
		expect(mountTable({ rows: [] }, { empty: 'Custom empty' }).get('tbody').text()).toBe('Custom empty');
	});

	test('resizes a column by mouse drag and does not sort at the end of the drag', async () => {
		vi.useFakeTimers();
		const wrapper = mountTable({ showResize: true });
		const handle = wrapper.get('[data-resize-handle]');

		expect(handle.attributes('aria-hidden')).toBe('true');
		Object.defineProperty(handle.element.parentElement, 'offsetWidth', { value: 130 });

		handle.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		window.dispatchEvent(Object.assign(new PointerEvent('pointermove'), { pageX: 50 }));
		window.dispatchEvent(new PointerEvent('pointerup'));
		await wrapper.get('thead th button').trigger('click');

		expect(wrapper.emitted('update:columns')?.[0]).toEqual([[{ ...columns[0], width: 180 }, columns[1]]]);
		expect(wrapper.emitted('update:sort')).toBeUndefined();

		vi.runAllTimers();
		await wrapper.get('thead th button').trigger('click');
		expect(wrapper.emitted('update:sort')).toHaveLength(1);
	});

	test('manual sort: the header toggle sorts by manualSortKey, rows drag only while sorted by it', async () => {
		const wrapper = mountTable({ showManualSort: true, manualSortKey: 'sort' });
		const toggle = wrapper.get('button[aria-label="Toggle Manual Sorting"]');

		expect(toggle.attributes('aria-pressed')).toBe('false');
		expect(wrapper.findAll('.drag-handle')).toHaveLength(2);
		expect(wrapper.getComponent(Draggable).vm.$attrs['disabled']).toBe(true);

		await toggle.trigger('click');
		expect(wrapper.emitted('update:sort')?.[0]).toEqual([{ by: 'sort', desc: false }]);

		await wrapper.setProps({ sort: { by: 'sort', desc: false } });
		expect(toggle.attributes('aria-pressed')).toBe('true');
		expect(wrapper.getComponent(Draggable).vm.$attrs['disabled']).toBe(false);

		await toggle.trigger('click');
		expect(wrapper.emitted('update:sort')?.[1]).toEqual([null]);

		wrapper.getComponent(Draggable).vm.$emit('update:modelValue', [rows[1], rows[0]]);
		expect(wrapper.emitted('update:rows')?.[0]).toEqual([[rows[1], rows[0]]]);

		await wrapper.setProps({ disabled: true });
		expect(wrapper.getComponent(Draggable).vm.$attrs['disabled']).toBe(true);
	});

	test('no manual sort column without showManualSort', () => {
		const wrapper = mountTable({ manualSortKey: 'sort', sort: { by: 'sort', desc: false } });

		expect(wrapper.find('.drag-handle').exists()).toBe(false);
		expect(wrapper.getComponent(Draggable).vm.$attrs['disabled']).toBe(true);
	});

	test('click:row on click and Enter on a focused row, not from the append cell or when disabled', async () => {
		const onClick = vi.fn();
		const wrapper = mount(BoTable, {
			props: { columns, rows, 'onClick:row': onClick },
			slots: { 'item-append': '<button type="button" class="act">Act</button>', 'header-append': 'Actions' },
			global: { plugins: [i18n] },
		});
		const row = wrapper.findAll('tbody tr')[1]!;

		expect(row.attributes('tabindex')).toBe('0');
		expect(wrapper.findAll('thead th[scope="col"]').at(-1)!.text()).toBe('Actions');
		expect(wrapper.findAll('col').at(-1)!.attributes('style')).toBe('width: 160px;');

		await row.trigger('click');
		expect(onClick.mock.calls[0]![0].item).toEqual(rows[1]);

		await row.trigger('keydown', { key: 'Enter' });
		expect(onClick).toHaveBeenCalledTimes(2);

		await row.get('.act').trigger('click');
		await row.get('.act').trigger('keydown', { key: 'Enter' });
		expect(onClick).toHaveBeenCalledTimes(2);

		await wrapper.setProps({ disabled: true });
		await row.trigger('click');
		expect(onClick).toHaveBeenCalledTimes(2);
		expect(row.attributes('tabindex')).toBeUndefined();
	});

	test('rows are not focusable without a click:row listener', () => {
		expect(mountTable().get('tbody tr').attributes('tabindex')).toBeUndefined();
	});
});
