// Keyboard of select-dropdown-m2o (chromium): Enter on the field opens the selection drawer, Tab reaches the item
// link, edit and deselect buttons, Enter on edit opens the item drawer.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import DrawerCollection from '../../components/drawers/DrawerCollection.vue';
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
import SelectDropdownM2O from './SelectDropdownM2O.vue';

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

test('Enter opens the selection drawer; Tab reaches link, edit and deselect', async () => {
	const options = fieldsOf('bo_rel').find((f) => f.field === 'm2o')!.meta!.options!;
	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });

	const wrapper = mount(SelectDropdownM2O, {
		props: { ...options, collection: 'bo_rel', field: 'm2o', value: 1 },
		global: { plugins: [i18n, router] },
		attachTo: document.body,
	});
	await vi.waitFor(() => expect(wrapper.find('button.main').exists()).toBe(true));

	const main = wrapper.get<HTMLButtonElement>('button.main').element;
	main.focus();
	await userEvent.keyboard('{Enter}');
	expect(wrapper.findComponent(DrawerCollection).props('active')).toBe(true);
	await wrapper.findComponent(DrawerCollection).setValue(false, 'active');

	main.focus();
	await userEvent.tab();
	expect(document.activeElement?.getAttribute('aria-label')).toBe('Navigate to Item');
	await userEvent.tab();
	expect(document.activeElement?.getAttribute('aria-label')).toBe('Edit Item');
	await userEvent.keyboard('{Enter}');
	expect(wrapper.findComponent(DrawerItem).props('active')).toBe(true);
});
