import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import { h } from 'vue';
import { i18n } from '../lang/index.ts';
import BoSortableList from './BoSortableList.vue';

enableAutoUnmount(afterEach);

type Row = { id: number; name: string };

const rows: Row[] = [
	{ id: 1, name: 'Alpha' },
	{ id: 2, name: 'Beta' },
	{ id: 3, name: 'Gamma' },
];

function mountList(props: Record<string, unknown> = {}) {
	return mount(BoSortableList<Row>, {
		props: { modelValue: rows, itemKey: 'id', itemLabel: (row: Row) => row.name, ...props },
		slots: { item: ({ element }: { element: Row }) => h('span', { class: 'name' }, element.name) },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
}

async function openMenu(wrapper: ReturnType<typeof mountList>, index: number) {
	const trigger = wrapper.findAll('button.row-menu')[index]!.element as HTMLElement;
	trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
	await flushPromises();
	return [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
}

async function select(item: HTMLElement) {
	item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
	await flushPromises();
}

test('renders each row through the item slot with a handle and a labelled menu trigger', () => {
	const wrapper = mountList();

	expect(wrapper.findAll('.name').map((n) => n.text())).toEqual(['Alpha', 'Beta', 'Gamma']);
	expect(wrapper.findAll('.drag-handle')).toHaveLength(3);
	expect(wrapper.findAll('button.row-menu').map((b) => b.attributes('aria-label'))).toEqual([
		'Options for Alpha',
		'Options for Beta',
		'Options for Gamma',
	]);
});

test('Move up is disabled on the first row and Move down on the last', async () => {
	const wrapper = mountList();

	const first = await openMenu(wrapper, 0);
	expect(
		first.map((i) => [i.textContent?.trim().replace(/^arrow_(upward|downward)/, ''), i.hasAttribute('data-disabled')]),
	).toEqual([
		['Move up', true],
		['Move down', false],
	]);
});

test('Move down emits the reordered array like a drag and announces the new position', async () => {
	const wrapper = mountList();

	const [, down] = await openMenu(wrapper, 0);
	await select(down!);

	expect(wrapper.emitted('update:modelValue')).toEqual([[[rows[1], rows[0], rows[2]]]]);
	expect(wrapper.get('[aria-live="polite"]').text()).toBe('Alpha moved to position 2 of 3');
});

test('Move up on the last row moves it one place up', async () => {
	const wrapper = mountList();

	const [up] = await openMenu(wrapper, 2);
	await select(up!);

	expect(wrapper.emitted('update:modelValue')).toEqual([[[rows[0], rows[2], rows[1]]]]);
});

test('row actions come before the move items; disabled keeps them and drops handle and moves', async () => {
	const rowActions = (row: Row) => [{ text: `Remove ${row.name}`, icon: 'close' }];
	const wrapper = mountList({ rowActions, disabled: true });

	expect(wrapper.findAll('.drag-handle')).toHaveLength(0);
	const items = await openMenu(wrapper, 1);
	expect(items.map((i) => i.textContent?.replace('close', '').trim())).toEqual(['Remove Beta']);
});

test('disabled without row actions shows no menu', () => {
	const wrapper = mountList({ disabled: true });
	expect(wrapper.findAll('button.row-menu')).toHaveLength(0);
});

test('tree: Indent needs a previous sibling, Outdent a parent; both emit the row index', async () => {
	const root = mountList({ tree: true });
	const rootItems = await openMenu(root, 0);
	const states = rootItems.map((i) => i.hasAttribute('data-disabled'));
	expect(states).toEqual([true, false, true, true]);
	root.unmount();

	const nested = mountList({ tree: true, nested: true });
	const items = await openMenu(nested, 1);
	expect(items.map((i) => i.hasAttribute('data-disabled'))).toEqual([false, false, false, false]);
	await select(items[2]!);
	expect(nested.emitted('indent')).toEqual([[1]]);

	const again = await openMenu(nested, 1);
	await select(again[3]!);
	expect(nested.emitted('outdent')).toEqual([[1]]);
});

test('the default row label is its position; a function item-key works', async () => {
	const wrapper = mountList({ itemLabel: undefined, itemKey: (row: Row) => `k${row.id}` });

	expect(wrapper.findAll('li').map((li) => li.attributes('data-row-key'))).toEqual(['k1', 'k2', 'k3']);
	expect(wrapper.findAll('button.row-menu')[1]!.attributes('aria-label')).toBe('Options for 2');
});
