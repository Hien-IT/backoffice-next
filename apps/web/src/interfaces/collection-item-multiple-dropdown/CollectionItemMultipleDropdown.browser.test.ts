// Keyboard of collection-item-multiple-dropdown (chromium): the row menu moves a row down (D-60) and deselects it.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { replaceQueue } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import '../../styles/index.css';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { fieldsOf, itemOf, loadSnapshot } from '../../test-utils/fixtures.ts';
import CollectionItemMultipleDropdown from './CollectionItemMultipleDropdown.vue';

enableAutoUnmount(afterEach);

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(loadSnapshot());
	await Promise.all([useFieldsStore().hydrate(), useRelationsStore().hydrate(), useCollectionsStore().hydrate()]);
});

afterEach(() => assertOnlyKnownRequests(calls(fetch)));

async function openMenuAndPick(wrapper: ReturnType<typeof mount>, row: number, text: string) {
	(wrapper.findAll<HTMLButtonElement>('.row-menu')[row]!.element as HTMLButtonElement).focus();
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull());

	for (let i = 0; i < 5; i++) {
		if (document.activeElement?.textContent?.includes(text)) break;
		await userEvent.keyboard('{ArrowDown}');
	}

	expect(document.activeElement?.textContent).toContain(text);
	await userEvent.keyboard('{Enter}');
	await flushPromises();
}

test('row menu: Move down reorders, Deselect removes', async () => {
	const options = fieldsOf('bo_rel').find((f) => f.field === 'collection_items')!.meta!.options!;

	const wrapper = mount(CollectionItemMultipleDropdown, {
		props: { ...options, value: itemOf('bo_rel', 1)['collection_items'] } as never,
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
	await vi.waitFor(() => expect(wrapper.findAll('li[data-row-key]')).toHaveLength(2));

	await openMenuAndPick(wrapper, 0, 'Move down');
	expect(wrapper.emitted('input')![0]).toEqual([
		[
			{ key: 1, collection: 'bo_m2a_a' },
			{ key: 2, collection: 'bo_m2a_a' },
		],
	]);

	await openMenuAndPick(wrapper, 0, 'Deselect');
	expect(wrapper.emitted('input')![1]).toEqual([[{ key: 2, collection: 'bo_m2a_a' }]]);
});
