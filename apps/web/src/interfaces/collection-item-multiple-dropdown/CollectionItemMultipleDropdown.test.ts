// Ported from directus/app/src/interfaces/collection-item-multiple-dropdown/collection-item-multiple-dropdown.test.ts
// Backoffice: mounted on the bo_rel `collection_items` field of the fixture snapshot with the real stores and
// mockFixtureApi instead of mocked stores and `api.get`; the Directus cases are kept (mount, action buttons, disabled,
// nonEditable), plus FR-049 options, order, value shape (empty is null), reorder through BoSortableList (D-60),
// contracts/api-calls.md #37 and the missing / unreadable collection edge case.
import type { FieldRaw } from '@directus/types';
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed } from 'vue';
import { replaceQueue } from '../../api/sdk.ts';
import BoSortableList from '../../components/BoSortableList.vue';
import DrawerCollection from '../../components/drawers/DrawerCollection.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { type FixtureUser, fieldsOf, itemOf, loadSnapshot } from '../../test-utils/fixtures.ts';
import CollectionItemMultipleDropdown from './CollectionItemMultipleDropdown.vue';

enableAutoUnmount(afterEach);

let fetch: ReturnType<typeof mockFixtureApi>;
let hydrateCalls = 0;

async function setup(user: FixtureUser = 'admin') {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(loadSnapshot(), { user });
	await useUserStore().hydrate();
	await Promise.all([useFieldsStore().hydrate(), useRelationsStore().hydrate(), useCollectionsStore().hydrate()]);
	hydrateCalls = fetch.mock.calls.length;
}

beforeEach(() => setup());

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
});

const ownCalls = () => calls(fetch).slice(hydrateCalls);

const options = (fieldsOf('bo_rel').find((f) => f.field === 'collection_items') as FieldRaw).meta!.options!;
const seeded = itemOf('bo_rel', 1)['collection_items'];

async function mountMultiple(props: Record<string, unknown> = {}, provide: Record<string | symbol, unknown> = {}) {
	const wrapper = mount(CollectionItemMultipleDropdown, {
		props: { ...options, value: seeded, ...props } as never,
		global: { plugins: [i18n], provide },
	});

	await flushPromises();
	return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountMultiple>>;

// BoSortableList is generic: its wrapper is typed loosely.
const sortable = (wrapper: Wrapper) => wrapper.getComponent(BoSortableList as never) as VueWrapper<any>;

const rows = (wrapper: Wrapper) => wrapper.findAll('li[data-row-key]').map((li) => li.get('.preview').text());

describe('Interface', () => {
	it('should mount', async () => {
		const wrapper = await mountMultiple({ value: undefined });

		expect(wrapper.exists()).toBe(true);
		expect(wrapper.text()).toContain('No items');
		expect(ownCalls()).toEqual([]);
	});

	it('should render action buttons', async () => {
		const wrapper = await mountMultiple();

		expect(wrapper.find('.actions').exists()).toBe(true);
		expect(wrapper.find('li .drag-handle').exists()).toBe(true);
		expect(wrapper.find('li .row-menu').exists()).toBe(true);
	});

	it('should render action buttons disabled when disabled is true', async () => {
		const wrapper = await mountMultiple({ disabled: true });

		expect(wrapper.get('.actions button').attributes('disabled')).toBeDefined();
		// Backoffice: a disabled BoSortableList hides the handle; the deselect row action is disabled.
		expect(wrapper.find('li .drag-handle').exists()).toBe(false);
		expect(sortable(wrapper).props('rowActions')!(seeded[0], 0)).toMatchObject([{ text: 'Deselect', disabled: true }]);
	});

	it('should hide action buttons when nonEditable is true', async () => {
		const wrapper = await mountMultiple({ nonEditable: true, disabled: true });

		expect(wrapper.find('.actions').exists()).toBe(false);
		expect(wrapper.find('li .drag-handle').exists()).toBe(false);
		expect(wrapper.find('li .row-menu').exists()).toBe(false);
	});
});

describe('fixture field', () => {
	it('mounts with the seeded value without emitting; rows keep the value order; one _in request', async () => {
		const wrapper = await mountMultiple();

		expect(seeded).toEqual([
			{ key: 2, collection: 'bo_m2a_a' },
			{ key: 1, collection: 'bo_m2a_a' },
		]);
		expect(wrapper.emitted('input')).toBeUndefined();
		expect(rows(wrapper)).toEqual(['A two', 'A one']);
		expect(ownCalls()).toEqual(['GET /items/bo_m2a_a?fields=name,id&filter={"id":{"_in":[2,1]}}']);
	});

	it('option:collection-item-multiple-dropdown.selectedCollection', async () => {
		const wrapper = await mountMultiple({
			selectedCollection: 'bo_rel_target',
			value: [{ key: 5, collection: 'bo_rel_target' }],
		});

		expect(rows(wrapper)).toEqual(['Target five']);
		expect(wrapper.findComponent(DrawerCollection).props()).toMatchObject({
			collection: 'bo_rel_target',
			multiple: true,
		});
	});

	it('option:collection-item-multiple-dropdown.template (missing: collection display template)', async () => {
		const wrapper = await mountMultiple({ template: '#{{ id }} {{ name }}' });
		expect(rows(wrapper)).toEqual(['#2 A two', '#1 A one']);

		const fallback = await mountMultiple({ template: undefined });
		expect(rows(fallback)).toEqual(['A two', 'A one']);
	});

	it('option:collection-item-multiple-dropdown.filter goes to the selection drawer', async () => {
		const filter = { _and: [{ name: { _contains: 'one' } }] };
		const wrapper = await mountMultiple({ filter });

		expect(wrapper.findComponent(DrawerCollection).props('filter')).toEqual(filter);
	});

	it('selecting emits {key, collection} items in the drawer order; an empty selection emits null', async () => {
		const wrapper = await mountMultiple();
		const drawer = () => wrapper.findComponent(DrawerCollection);

		expect(drawer().props('selection')).toEqual([2, 1]);
		await wrapper.get('.actions button').trigger('click');
		expect(drawer().props('active')).toBe(true);

		drawer().vm.$emit('input', [1, 2]);
		drawer().vm.$emit('input', []);

		expect(wrapper.emitted('input')).toEqual([
			[
				[
					{ key: 1, collection: 'bo_m2a_a' },
					{ key: 2, collection: 'bo_m2a_a' },
				],
			],
			[null],
		]);
	});

	it('deselect removes one row; removing the last one emits null', async () => {
		const wrapper = await mountMultiple();
		const actions = sortable(wrapper).props('rowActions')!;

		actions({ id: 2, name: 'A two' }, 0)[0]!.onSelect!();
		expect(wrapper.emitted('input')).toEqual([[[{ key: 1, collection: 'bo_m2a_a' }]]]);

		await wrapper.setProps({ value: [{ key: 1, collection: 'bo_m2a_a' }] });
		await flushPromises();
		actions({ id: 1, name: 'A one' }, 0)[0]!.onSelect!();
		expect(wrapper.emitted('input')![1]).toEqual([null]);
	});

	it('reorder (drag or row menu) emits the new order without refetching', async () => {
		const wrapper = await mountMultiple();
		const list = sortable(wrapper);

		list.vm.$emit('update:modelValue', [...list.props('modelValue')].reverse());
		await flushPromises();

		expect(rows(wrapper)).toEqual(['A one', 'A two']);
		expect(wrapper.emitted('input')).toEqual([
			[
				[
					{ key: 1, collection: 'bo_m2a_a' },
					{ key: 2, collection: 'bo_m2a_a' },
				],
			],
		]);

		await wrapper.setProps({ value: wrapper.emitted('input')![0]![0] as never });
		await flushPromises();
		expect(ownCalls()).toHaveLength(1);
	});

	it('label linking from the form field (group)', async () => {
		const a11y = computed(() => ({ inputId: 'in-3', labelId: 'lb-3', describedBy: 'hint-3', invalid: true }));
		const wrapper = await mountMultiple({}, { [FORM_FIELD_A11Y as symbol]: a11y });

		expect(wrapper.get('[role="group"]').attributes()).toMatchObject({
			'aria-labelledby': 'lb-3',
			'aria-describedby': 'hint-3',
			'aria-invalid': 'true',
		});
	});
});

describe('edge cases and users', () => {
	it('selectedCollection that does not exist: notice in the field, no request', async () => {
		const wrapper = await mountMultiple({ selectedCollection: 'bo_gone' });

		expect(wrapper.text()).toContain(i18n.global.t('relationship_not_setup'));
		expect(ownCalls()).toEqual([]);
	});

	it('a failed load shows the error in the field and does not throw', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await setup('bo-editor');

		// bo-editor cannot read `status` of bo_rel_target: the API answers 403.
		const wrapper = await mountMultiple({
			selectedCollection: 'bo_rel_target',
			template: '{{ name }} {{ status }}',
			value: [{ key: 1, collection: 'bo_rel_target' }],
		});

		expect(wrapper.get('[role="alert"]').text()).toContain(i18n.global.t('errors.FORBIDDEN'));
		expect(warn).toHaveBeenCalled();
	});

	it.each<FixtureUser>(['admin', 'bo-editor', 'bo-viewer'])('%s reads the seeded value', async (user) => {
		await setup(user);
		const wrapper = await mountMultiple({ disabled: user === 'bo-viewer', nonEditable: user === 'bo-viewer' });

		expect(rows(wrapper)).toEqual(['A two', 'A one']);
	});
});
