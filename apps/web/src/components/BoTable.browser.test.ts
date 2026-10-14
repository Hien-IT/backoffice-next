import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { i18n } from '../lang/index.ts';
import '../styles/index.css';
import BoTable from './BoTable.vue';

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
		target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, pointerId: 1 }));

	pointer('pointerdown', handles[0]!, start.top + start.height / 2);

	for (let step = 1; step <= 10; step++) {
		const y = start.top + ((end.bottom - 4 - start.top) * step) / 10;
		pointer('pointermove', document, y);
		await new Promise((resolve) => requestAnimationFrame(resolve));
	}

	document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: end.bottom - 4 }));

	await vi.waitFor(() => expect(names()).toEqual(['Beta', 'Gamma', 'Alpha']));
});

