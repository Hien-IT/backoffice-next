// Keyboard of list-m2a (chromium): "Create New" opens its collection menu with Enter and a collection opens the item
// drawer; the row menu's Move down (D-60) sorts like a drag; Enter on a row opens the junction drawer.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { replaceQueue } from '../../api/sdk.ts';
// The registry first: the drawers' form imports it, which imports this interface back (cycle).
import '../index.ts';
import DrawerItem from '../../components/drawers/DrawerItem.vue';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import '../../styles/index.css';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { fieldsOf, loadSnapshot } from '../../test-utils/fixtures.ts';
import ListM2A from './ListM2A.vue';

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

function mountM2A() {
	const options = fieldsOf('bo_rel').find((f) => f.field === 'm2a')!.meta!.options!;

	const wrapper = mount(ListM2A, {
		props: {
			...options,
			collection: 'bo_rel',
			field: 'm2a',
			primaryKey: 1,
			value: [1, 2],
			onInput: (value: unknown) => wrapper.setProps({ value } as never),
		} as never,
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	return wrapper;
}

test('Move down in the row menu writes the sort of every row and keeps focus on the moved row', async () => {
	const wrapper = mountM2A();
	await vi.waitFor(() => expect(document.querySelector('[aria-label^="Options for bo_m2a_a"]')).not.toBeNull());

	const trigger = document.querySelector<HTMLElement>('[aria-label^="Options for bo_m2a_a"]')!;
	trigger.focus();
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull());

	for (let i = 0; i < 5 && !document.activeElement?.textContent?.includes('Move down'); i++) {
		await userEvent.keyboard('{ArrowDown}');
	}

	await userEvent.keyboard('{Enter}');

	await vi.waitFor(() =>
		expect(wrapper.emitted('input')?.at(-1)?.[0]).toEqual({
			create: [],
			update: [
				{ sort: 1, id: 2, collection: 'bo_m2a_b', item: { id: 'bo-13' } },
				{ sort: 2, id: 1, collection: 'bo_m2a_a', item: { id: 1 } },
			],
			delete: [],
		}),
	);

	await vi.waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Options for bo_m2a_a/));
});

test('Create New opens its collection menu from the keyboard; Enter on a row opens the junction drawer', async () => {
	const wrapper = mountM2A();
	await vi.waitFor(() => expect(wrapper.find('button.create').exists()).toBe(true));

	wrapper.get<HTMLButtonElement>('button.create').element.focus();
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('menuitem'));
	expect(document.activeElement?.textContent).toContain('Bo M2A A');
	await userEvent.keyboard('{Enter}');

	await vi.waitFor(() => expect(wrapper.findComponent(DrawerItem).props('active')).toBe(true));
	expect(wrapper.findComponent(DrawerItem).props('edits')).toEqual({ collection: 'bo_m2a_a', item: {} });
	await wrapper.findComponent(DrawerItem).setValue(false, 'active');

	wrapper.get<HTMLButtonElement>('button.row').element.focus();
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(wrapper.findComponent(DrawerItem).props('active')).toBe(true));
	expect(wrapper.findComponent(DrawerItem).props('primaryKey')).toBe(1);
});
