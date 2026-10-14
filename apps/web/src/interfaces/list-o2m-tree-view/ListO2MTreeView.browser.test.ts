// Keyboard of list-o2m-tree-view (chromium, D-60): the row menu's Indent makes a row a child of its previous sibling
// and Outdent moves it back after its parent, with the value of the equivalent drag; focus stays on the moved row.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { replaceQueue } from '../../api/sdk.ts';
// The registry first: the drawers' form imports it, which imports this interface back (cycle).
import '../index.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import '../../styles/index.css';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { fieldsOf, loadSnapshot } from '../../test-utils/fixtures.ts';
import ListO2MTreeView from './ListO2MTreeView.vue';

enableAutoUnmount(afterEach);

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(loadSnapshot());
	await useUserStore().hydrate();
	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);
});

afterEach(() => assertOnlyKnownRequests(calls(fetch)));

/** Opens the row menu of `row` with Enter and runs `item` with the arrow keys and Enter. */
async function choose(row: string, item: string) {
	document.querySelector<HTMLElement>(`[aria-label="Options for ${row}"]`)!.focus();
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull());

	for (let i = 0; i < 10 && !document.activeElement?.textContent?.includes(item); i++) {
		await userEvent.keyboard('{ArrowDown}');
	}

	expect(document.activeElement?.textContent).toContain(item);
	await userEvent.keyboard('{Enter}');
}

test('Indent then Outdent with the keyboard change the parent of a row', async () => {
	const options = fieldsOf('bo_tree').find((f) => f.field === 'children')!.meta!.options!;

	const wrapper = mount(ListO2MTreeView, {
		props: {
			...options,
			collection: 'bo_tree',
			field: 'children',
			primaryKey: 1,
			value: [2, 4],
			onInput: (value: unknown) => wrapper.setProps({ value } as never),
		} as never,
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	await vi.waitFor(() => expect(document.querySelector('[aria-label="Options for Child B"]')).not.toBeNull());

	await choose('Child B', 'Indent');

	await vi.waitFor(() =>
		expect(wrapper.emitted('input')?.at(-1)?.[0]).toEqual({
			create: [],
			update: [
				{
					id: 2,
					name: 'Child A',
					sort: 1,
					children: { create: [], update: [{ id: 4, name: 'Child B', sort: 2, parent: 2 }], delete: [] },
				},
			],
			delete: [],
		}),
	);

	// Child B is now under Child A (open), and keeps the focus.
	await vi.waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Options for Child B'));
	expect(document.activeElement!.closest('ul')!.closest('li')!.querySelector('.template')!.textContent).toContain(
		'Child A',
	);

	await choose('Child B', 'Outdent');

	// Back at the root. As after dragging the row back (Directus `added` with `exists`, then `removed`): the nested
	// change is gone, the reverse field and the parent's `children` are left as undefined keys (dropped in JSON).
	await vi.waitFor(() =>
		expect(wrapper.emitted('input')?.at(-1)?.[0]).toEqual({
			create: [],
			update: [
				{ id: 2, name: 'Child A', sort: 1, children: undefined },
				{ id: 4, name: 'Child B', sort: 2, parent: undefined },
			],
			delete: [],
		}),
	);
	await vi.waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Options for Child B'));
	expect(document.activeElement!.closest('ul')!.closest('li')).toBeNull();
});
