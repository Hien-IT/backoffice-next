import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { i18n } from '../lang/index.ts';
import '../styles/index.css';
import BoTable, { type BoTableColumn } from './BoTable.vue';

// Manual sort with a real mouse drag of the row handle (v-table: vuedraggable, handle `.drag-handle`, force-fallback).
enableAutoUnmount(afterEach);

type Row = { id: number; name: string };

const Harness = defineComponent(() => {
	const rows = ref<Row[]>([
		{ id: 1, name: 'Alpha' },
		{ id: 2, name: 'Beta' },
		{ id: 3, name: 'Gamma' },
	]);

	return () =>
		h(BoTable, {
			columns: [{ key: 'name', label: 'Name' }],
			rows: rows.value,
			showManualSort: true,
			manualSortKey: 'sort',
			sort: { by: 'sort', desc: false },
			'onUpdate:rows': (next: Record<string, any>[]) => (rows.value = next as Row[]),
		});
});

const names = () => [...document.querySelectorAll('tbody tr')].map((tr) => tr.querySelectorAll('td')[1]?.textContent);

test('dragging a row handle below another row reorders the rows', async () => {
	mount(Harness, { global: { plugins: [i18n] }, attachTo: document.body });

	const handles = document.querySelectorAll<HTMLElement>('.drag-handle');
	const rows = document.querySelectorAll<HTMLElement>('tbody tr');

	// Sortable's fallback drag: pointerdown on the handle, pointer moves on the document in steps, mouseup drops.
	const start = handles[0]!.getBoundingClientRect();
	const end = rows[2]!.getBoundingClientRect();
	const x = start.left + start.width / 2;
	const pointer = (type: string, target: EventTarget, y: number) =>
		target.dispatchEvent(
			new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, pointerId: 1 }),
		);

	pointer('pointerdown', handles[0]!, start.top + start.height / 2);

	for (let step = 1; step <= 10; step++) {
		const y = start.top + ((end.bottom - 4 - start.top) * step) / 10;
		pointer('pointermove', document, y);
		await new Promise((resolve) => requestAnimationFrame(resolve));
	}

	document.dispatchEvent(
		new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: end.bottom - 4 }),
	);

	await vi.waitFor(() => expect(names()).toEqual(['Beta', 'Gamma', 'Alpha']));
});

/* 014 (T034): optional props of the Q-2 recipe. */

const COLUMNS: BoTableColumn[] = [
	{ key: 'name', label: 'Name' },
	{ key: 'city', label: 'City', description: 'Author -> City' },
	{ key: 'age', label: 'Age', align: 'right' },
];

const ROWS = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}`, city: 'Hanoi', age: i }));

function mountTable(props: Record<string, unknown> = {}, slots: Record<string, any> = {}) {
	return mount(BoTable, {
		props: { columns: COLUMNS, rows: ROWS.slice(0, 3), ...props },
		slots,
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
}

test('header menu: the header button opens the header-context-menu slot; aria-sort and description stay', async () => {
	const wrapper = mountTable(
		{ sort: { by: 'name', desc: true } },
		{ 'header-context-menu': '<p data-test="menu">menu of {{ params.column.key }} at {{ params.index }}</p>' },
	);

	const ths = wrapper.findAll('thead th[scope="col"]');
	expect(ths.map((th) => th.attributes('aria-sort'))).toEqual(['descending', 'none', 'none']);
	expect(ths[1]!.attributes('title')).toBe('Author -> City');
	expect(ths[1]!.get('.sr-only').text()).toBe('(Author -> City)');

	await userEvent.click(ths[1]!.get('button').element);
	await vi.waitFor(() => expect(document.querySelector('[data-test="menu"]')?.textContent).toBe('menu of city at 1'));
	// The menu replaces the sort toggle (table-header.vue): no update:sort on click.
	expect(wrapper.emitted('update:sort')).toBeUndefined();
	await userEvent.keyboard('{Escape}');
});

test('allowHeaderReorder: dropping a header on another moves the column there', async () => {
	const wrapper = mountTable({ allowHeaderReorder: true });
	const handles = document.querySelectorAll<HTMLElement>('[data-reorder-handle]');
	const ths = document.querySelectorAll<HTMLElement>('thead th[scope="col"]');
	const dataTransfer = new DataTransfer();
	const drag = (type: string, target: Element) =>
		target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));

	expect(handles[0]!.getAttribute('draggable')).toBe('true');
	drag('dragstart', handles[0]!);
	drag('dragover', ths[2]!);
	await wrapper.vm.$nextTick();
	expect(ths[2]!.classList).toContain('border-brand-500');
	drag('drop', ths[2]!);
	drag('dragend', handles[0]!);

	expect(wrapper.emitted('update:columns')![0]![0]).toEqual([COLUMNS[1], COLUMNS[2], COLUMNS[0]]);
	expect(mountTable().find('[data-reorder-handle]').attributes('draggable')).toBeUndefined();
});

test('rowHeight sets the row height in px; fixedHeader scrolls the body under a visible header', async () => {
	const wrapper = mount(
		{
			components: { BoTable },
			data: () => ({ columns: COLUMNS, rows: ROWS }),
			template:
				'<div style="height: 300px; display: flex; flex-direction: column"><BoTable :columns="columns" :rows="rows" fixed-header :row-height="58" /></div>',
		},
		{ global: { plugins: [i18n] }, attachTo: document.body },
	);

	const row = wrapper.get('tbody tr').element as HTMLElement;
	expect(row.getBoundingClientRect().height).toBe(58);

	const scroller = wrapper.get('[data-fixed-header]').element as HTMLElement;
	expect(scroller.clientHeight).toBeLessThan(300);
	scroller.scrollTop = 500;
	await new Promise((resolve) => requestAnimationFrame(resolve));
	const th = wrapper.get('thead th').element.getBoundingClientRect();
	expect(scroller.scrollTop).toBeGreaterThan(0);
	expect(Math.abs(th.top - scroller.getBoundingClientRect().top)).toBeLessThanOrEqual(1);
});

test('manual sort emits { item, to } with the keys of the moved row and of its new place (v-table manual-sort)', async () => {
	const wrapper = mountTable({ showManualSort: true, manualSortKey: 'sort', sort: { by: 'sort', desc: false } });

	const handles = document.querySelectorAll<HTMLElement>('.drag-handle');
	const rows = document.querySelectorAll<HTMLElement>('tbody tr');
	const start = handles[0]!.getBoundingClientRect();
	const end = rows[2]!.getBoundingClientRect();
	const x = start.left + start.width / 2;
	const pointer = (type: string, target: EventTarget, y: number) =>
		target.dispatchEvent(
			new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, pointerId: 1 }),
		);

	pointer('pointerdown', handles[0]!, start.top + start.height / 2);

	for (let step = 1; step <= 10; step++) {
		pointer('pointermove', document, start.top + ((end.bottom - 4 - start.top) * step) / 10);
		await new Promise((resolve) => requestAnimationFrame(resolve));
	}

	document.dispatchEvent(
		new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: end.bottom - 4 }),
	);

	await vi.waitFor(() => expect(wrapper.emitted('manual-sort')).toEqual([[{ item: 1, to: 3 }]]));
});
