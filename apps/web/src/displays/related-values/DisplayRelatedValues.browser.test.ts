// US2 scenario 4 in a real browser (happy-dom closes the Reka popover on open): the m2m "N items" menu of the fixture
// opens with Enter, lists the filled template per row with a link to the item (FR-078), and gives focus back on Escape.
import { readItem } from '@directus/sdk';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue, sdk } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import '../../styles/index.css';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { fieldsOf, loadSnapshot } from '../../test-utils/fixtures.ts';
import { adjustFieldsForDisplays } from '../../utils/adjust-fields-for-displays.ts';
import DisplayRelatedValues from './DisplayRelatedValues.vue';

enableAutoUnmount(afterEach);

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(loadSnapshot());
	await Promise.all([useFieldsStore().hydrate(), useRelationsStore().hydrate(), useCollectionsStore().hydrate()]);
});

test('m2m "3 Items" opens with Enter, lists each row with its link and closes with Escape', async () => {
	const field = fieldsOf('bo_rel').find((f) => f.field === 'm2m_list')!;
	const fields = adjustFieldsForDisplays(['m2m_list'], 'bo_rel');
	const item = (await sdk.request(readItem('bo_rel' as never, 1, { fields } as never))) as Record<string, any>;
	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });

	const wrapper = mount(DisplayRelatedValues, {
		props: { collection: 'bo_rel', field: 'm2m_list', value: item['m2m_list'], ...field.meta!.display_options },
		global: { plugins: [i18n, router] },
		attachTo: document.body,
	});
	const trigger = wrapper.get('button').element;

	trigger.focus();
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'));

	const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
	const rows = [...dialog.querySelectorAll('li')];

	expect(rows.map((li) => li.textContent?.replace('launch', '').trim())).toEqual([
		'Target one',
		'Target one',
		'Target five',
	]);
	expect(rows.map((li) => li.querySelector('a')!.getAttribute('href'))).toEqual([
		'/content/bo_rel_target/1',
		'/content/bo_rel_target/1',
		'/content/bo_rel_target/5',
	]);
	expect(rows[0]!.querySelector('a')!.getAttribute('aria-label')).toBe('Open');

	// Focus moves into the popover, so Tab reaches the first link.
	await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
	await userEvent.keyboard('{Tab}');
	expect(document.activeElement).toBe(rows[0]!.querySelector('a'));

	await userEvent.keyboard('{Escape}');
	await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'));
	expect(document.activeElement).toBe(trigger);

	assertOnlyKnownRequests(calls(fetch));
});
