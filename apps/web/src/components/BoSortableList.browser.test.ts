import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { i18n } from '../lang/index.ts';
import '../styles/index.css';
import BoSortableList from './BoSortableList.vue';

// Keyboard reorder (D-60, WCAG 2.1.1): open the row menu with Enter, pick Move down / Move up with the arrows.
enableAutoUnmount(afterEach);

type Row = { id: number; name: string };

const Harness = defineComponent(() => {
	const value = ref<Row[]>([
		{ id: 1, name: 'Alpha' },
		{ id: 2, name: 'Beta' },
		{ id: 3, name: 'Gamma' },
	]);

	return () =>
		h(
			BoSortableList<Row>,
			{
				modelValue: value.value,
				itemKey: 'id',
				itemLabel: (row: Row) => row.name,
				'onUpdate:modelValue': (next: Row[]) => (value.value = next),
			},
			{ item: ({ element }: { element: Row }) => h('span', { class: 'name' }, element.name) },
		);
});

const names = () => [...document.querySelectorAll('.name')].map((n) => n.textContent);

test('Move down and Move up with the keyboard reorder the rows, keep focus on the moved row and announce it', async () => {
	mount(Harness, { global: { plugins: [i18n] }, attachTo: document.body });

	const trigger = document.querySelector<HTMLElement>('[aria-label="Options for Alpha"]')!;
	trigger.focus();

	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull());
	// First item (Move up) is disabled on the first row: ArrowDown lands on Move down.
	await userEvent.keyboard('{ArrowDown}');
	await vi.waitFor(() => expect(document.activeElement?.textContent).toContain('Move down'));
	await userEvent.keyboard('{Enter}');

	await vi.waitFor(() => expect(names()).toEqual(['Beta', 'Alpha', 'Gamma']));
	await vi.waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Options for Alpha'));
	expect(document.querySelector('[aria-live="polite"]')!.textContent).toBe('Alpha moved to position 2 of 3');

	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull());
	await vi.waitFor(() => expect(document.activeElement?.textContent).toContain('Move up'));
	await userEvent.keyboard('{Enter}');

	await vi.waitFor(() => expect(names()).toEqual(['Alpha', 'Beta', 'Gamma']));
	await vi.waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Options for Alpha'));
	expect(document.querySelector('[aria-live="polite"]')!.textContent).toBe('Alpha moved to position 1 of 3');
});
