// Directus has no test for collection-item-dropdown.vue: the bo_rel `collection_item` field of the fixture snapshot
// (FR-049, contracts/api-calls.md #36 `<endpoint>?filter[<pk>][_eq]=<key>`), its options, value shape, states, the
// three fixture users and the missing / unreadable collection edge case.
import type { FieldRaw } from '@directus/types';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed } from 'vue';
import { replaceQueue } from '../../api/sdk.ts';
import DrawerCollection from '../../components/drawers/DrawerCollection.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { type FixtureUser, fieldsOf, itemOf, loadSnapshot, type Snapshot } from '../../test-utils/fixtures.ts';
import CollectionItemDropdown from './CollectionItemDropdown.vue';

enableAutoUnmount(afterEach);

let fetch: ReturnType<typeof mockFixtureApi>;
let hydrateCalls = 0;

async function setup(user: FixtureUser = 'admin', snapshot: Snapshot = loadSnapshot()) {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(snapshot, { user });
	await useUserStore().hydrate();
	await Promise.all([useFieldsStore().hydrate(), useRelationsStore().hydrate(), useCollectionsStore().hydrate()]);
	hydrateCalls = fetch.mock.calls.length;
}

beforeEach(() => setup());

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
});

const ownCalls = () => calls(fetch).slice(hydrateCalls);

const options = (fieldsOf('bo_rel').find((f) => f.field === 'collection_item') as FieldRaw).meta!.options!;
const seeded = itemOf('bo_rel', 1)['collection_item'];

async function mountDropdown(props: Record<string, unknown> = {}, provide: Record<string | symbol, unknown> = {}) {
	const wrapper = mount(CollectionItemDropdown, {
		props: { ...options, value: seeded, ...props } as never,
		global: { plugins: [i18n], provide },
	});

	await flushPromises();
	return wrapper;
}

const main = (wrapper: Awaited<ReturnType<typeof mountDropdown>>) => wrapper.get<HTMLButtonElement>('button.main');

describe('collection-item-dropdown', () => {
	it('mounts with the fixture field and value without emitting; one list request with the _eq filter', async () => {
		const wrapper = await mountDropdown();

		expect(seeded).toEqual({ key: 1, collection: 'bo_rel_target' });
		expect(wrapper.emitted('input')).toBeUndefined();
		expect(main(wrapper).text()).toBe('Target one');
		expect(ownCalls()).toEqual(['GET /items/bo_rel_target?fields=name,id&filter={"id":{"_eq":1}}']);
	});

	it('missing options: collection display template, then {{ primary key }}', async () => {
		const wrapper = await mountDropdown({ template: undefined, filter: undefined });

		expect(main(wrapper).text()).toBe('Target one');
		expect(wrapper.findComponent(DrawerCollection).props('filter')).toBeNull();

		const snapshot = loadSnapshot();
		snapshot.collections.find((c) => c['collection'] === 'bo_rel_target')!['meta'].display_template = null;
		await setup('admin', snapshot);
		const fallback = await mountDropdown({ template: undefined, value: { key: 5, collection: 'bo_rel_target' } });

		expect(main(fallback).text()).toBe('5');
		expect(ownCalls()).toEqual(['GET /items/bo_rel_target?fields=id&filter={"id":{"_eq":5}}']);
	});

	it('no value: placeholder and chevron, no request', async () => {
		const wrapper = await mountDropdown({ value: null });

		expect(main(wrapper).text()).toBe('Select an item...');
		expect(wrapper.find('.expand').exists()).toBe(true);
		expect(wrapper.find('button.remove').exists()).toBe(false);
		expect(ownCalls()).toEqual([]);
	});

	it('option:collection-item-dropdown.selectedCollection', async () => {
		const wrapper = await mountDropdown({ selectedCollection: 'bo_m2a_a', value: { key: 2, collection: 'bo_m2a_a' } });

		expect(main(wrapper).text()).toBe('A two');
		expect(wrapper.findComponent(DrawerCollection).props('collection')).toBe('bo_m2a_a');
	});

	it('option:collection-item-dropdown.template', async () => {
		const wrapper = await mountDropdown({ template: '{{ id }} - {{ name }}' });

		expect(main(wrapper).text()).toBe('1 - Target one');
		expect(ownCalls()).toEqual(['GET /items/bo_rel_target?fields=id,name&filter={"id":{"_eq":1}}']);
	});

	it('option:collection-item-dropdown.filter goes to the selection drawer as is', async () => {
		const wrapper = await mountDropdown();

		expect(wrapper.findComponent(DrawerCollection).props('filter')).toEqual({
			_and: [{ status: { _neq: 'archived' } }],
		});
	});

	it('click opens the drawer with the current key; a selection emits {key, collection}', async () => {
		const wrapper = await mountDropdown();
		const drawer = () => wrapper.findComponent(DrawerCollection);

		expect(drawer().props('selection')).toEqual([1]);
		await main(wrapper).trigger('click');
		expect(drawer().props('active')).toBe(true);

		drawer().vm.$emit('input', [3]);
		await flushPromises();

		expect(drawer().props('active')).toBe(false);
		expect(wrapper.emitted('input')).toEqual([[{ key: 3, collection: 'bo_rel_target' }]]);
	});

	it('an empty selection and deselect emit null', async () => {
		const wrapper = await mountDropdown();

		wrapper.findComponent(DrawerCollection).vm.$emit('input', []);
		await wrapper.get('button.remove').trigger('click');

		expect(wrapper.get('button.remove').attributes('aria-label')).toBe('Deselect');
		expect(wrapper.emitted('input')).toEqual([[null], [null]]);
	});

	it('disabled: no click, deselect disabled', async () => {
		const wrapper = await mountDropdown({ disabled: true });

		expect(main(wrapper).element.disabled).toBe(true);
		expect(wrapper.get('button.remove').attributes('disabled')).toBeDefined();
		await main(wrapper).trigger('click');
		expect(wrapper.findComponent(DrawerCollection).props('active')).toBe(false);
	});

	it('nonEditable hides the actions', async () => {
		const wrapper = await mountDropdown({ disabled: true, nonEditable: true });

		expect(main(wrapper).text()).toBe('Target one');
		expect(wrapper.find('.item-actions').exists()).toBe(false);
	});

	it('label linking and invalid state from the form field', async () => {
		const a11y = computed(() => ({ inputId: 'in-2', labelId: 'lb-2', describedBy: undefined, invalid: true }));
		const wrapper = await mountDropdown({}, { [FORM_FIELD_A11Y as symbol]: a11y });

		expect(main(wrapper).attributes()).toMatchObject({
			id: 'in-2',
			'aria-labelledby': 'lb-2 in-2',
			'aria-invalid': 'true',
			type: 'button',
		});
		expect(wrapper.get('.item-row').classes()).toContain('border-error-600');
	});
});

describe('edge cases and users', () => {
	it('selectedCollection that does not exist: notice in the field, no request', async () => {
		const wrapper = await mountDropdown({ selectedCollection: 'bo_gone', value: { key: 1, collection: 'bo_gone' } });

		expect(wrapper.text()).toContain(i18n.global.t('relationship_not_setup'));
		expect(ownCalls()).toEqual([]);
	});

	it('a failed load shows the error in the field and does not throw', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await setup('bo-editor');

		// bo-editor cannot read `status` of bo_rel_target: the API answers 403.
		const wrapper = await mountDropdown({ template: '{{ name }} {{ status }}' });

		expect(wrapper.get('[role="alert"]').text()).toContain(i18n.global.t('errors.FORBIDDEN'));
		expect(main(wrapper).text()).toBe('Select an item...');
		expect(wrapper.get('.item-row').classes()).toContain('border-error-600');
		expect(warn).toHaveBeenCalled();
	});

	it.each<FixtureUser>(['admin', 'bo-editor', 'bo-viewer'])('%s reads the seeded value', async (user) => {
		await setup(user);
		const wrapper = await mountDropdown({ disabled: user === 'bo-viewer', nonEditable: user === 'bo-viewer' });

		expect(main(wrapper).text()).toBe('Target one');
		expect(wrapper.find('[role="alert"]').exists()).toBe(false);
	});
});
