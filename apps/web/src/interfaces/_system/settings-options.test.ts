// Feature 016 (T052, D-57): the system interfaces of the field drawer and the list options, as DR:
// system-interface / system-display (choices by the type of another form value, reset when it changes),
// system-interface-options / system-display-options (the options form of the chosen one, batch mode for conditions,
// the context for function options), system-fields (D-96 menu moves, remove, add), system-inline-fields (flat rows
// with meta.x / schema.x), system-collections (tables only), system-manual-flow-select (manual flows of a collection).
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { nextTick, ref } from 'vue';
import BoNotice from '../../components/BoNotice.vue';
import BoSelect from '../../components/BoSelect.vue';
import BoSortableList from '../../components/BoSortableList.vue';
import BoForm from '../../components/form/BoForm.vue';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useFlowsStore } from '../../stores/flows.ts';
import { mockApi } from '../../test-utils/fetch.ts';
import SelectMultipleCheckbox from '../select-multiple-checkbox/SelectMultipleCheckbox.vue';
import { getInterface } from '../index.ts';
import SystemCollections from './system-collections/SystemCollections.vue';
import SystemDisplay from './system-display/SystemDisplay.vue';
import SystemDisplayOptions from './system-display-options/SystemDisplayOptions.vue';
import SystemFields from './system-fields/SystemFields.vue';
import SystemInlineFields from './system-inline-fields/SystemInlineFields.vue';
import SystemInterface from './system-interface/SystemInterface.vue';
import SystemInterfaceOptions from './system-interface-options/SystemInterfaceOptions.vue';
import SystemManualFlowSelect from './system-manual-flow-select/SystemManualFlowSelect.vue';

// The fetch stub of beforeEach stays after each test: system-input-translated-string loads after the test ends.
afterEach(() => {
	document.body.innerHTML = '';
});

let pinia: ReturnType<typeof createPinia>;

beforeEach(() => {
	pinia = createPinia();
	setActivePinia(pinia);
	// Some option forms load data (e.g. the translations display options): an SDK answering 404.
	mockApi({});
});

function mountWith(component: any, props: Record<string, unknown>, values = ref<Record<string, unknown>>({})) {
	return mount(component, {
		props,
		global: { plugins: [pinia, i18n], provide: { values } },
		attachTo: document.body,
	});
}

const ids = (wrapper: ReturnType<typeof mountWith>) =>
	(wrapper.findComponent(BoSelect).props('items') as { value: string }[]).map((item) => item.value);

describe('system-interface and system-display', () => {
	test('a notice until the type field has a value', () => {
		expect(mountWith(SystemInterface, { value: null, typeField: 'type' }).findComponent(BoNotice).exists()).toBe(true);
	});

	test('interfaces of the type, without relational and system ones; reset when the type changes', async () => {
		const values = ref<Record<string, unknown>>({ type: 'boolean' });
		const wrapper = mountWith(SystemInterface, { value: 'boolean', typeField: 'type' }, values);

		expect(ids(wrapper)).toContain('boolean');
		expect(ids(wrapper)).not.toContain('input');
		expect(ids(wrapper).some((id) => id.startsWith('system-') || id.startsWith('list-'))).toBe(false);

		values.value = { type: 'string' };
		await nextTick();
		expect(wrapper.emitted('input')).toEqual([[null]]);
		expect(ids(wrapper)).toContain('input');
	});

	test('displays of the type without local types, with a deselect row', () => {
		const wrapper = mountWith(SystemDisplay, { value: null, typeField: 'type' }, ref({ type: 'string' }));

		expect(ids(wrapper)).toContain('formatted-value');
		expect(ids(wrapper)).not.toContain('related-values');
		expect(wrapper.findComponent(BoSelect).props('showDeselect')).toBe(true);
		wrapper.findComponent(BoSelect).vm.$emit('deselect');
		expect(wrapper.emitted('input')).toEqual([[null]]);
	});
});

describe('system-interface-options and system-display-options', () => {
	test('a notice without an interface, the options form of the chosen one, batch mode for conditions', () => {
		expect(mountWith(SystemInterfaceOptions, { value: null, interfaceField: 'interface' }).text()).toContain(
			i18n.global.t('select_interface'),
		);

		const wrapper = mountWith(
			SystemInterfaceOptions,
			{ value: { placeholder: 'x' }, interfaceField: 'interface', isConditionOptions: true },
			ref({ interface: 'input' }),
		);
		const form = wrapper.findComponent(BoForm);
		expect((form.props('fields') as { field: string }[]).map((f) => f.field)).toContain('placeholder');
		expect(form.props('batchMode')).toBe(true);
	});

	test('function options get the default context; no options gives the notice', () => {
		const wrapper = mountWith(SystemDisplayOptions, {
			value: null,
			display: 'formatted-value',
			collection: 'articles',
		});
		expect((wrapper.findComponent(BoForm).props('fields') as unknown[]).length).toBeGreaterThan(0);

		expect(mountWith(SystemDisplayOptions, { value: null, display: 'raw' }).text()).toContain(
			i18n.global.t('no_options_available'),
		);
	});
});

describe('system-fields', () => {
	beforeEach(() => {
		useFieldsStore().fields = ['title', 'body', 'date'].map((field) => ({
			collection: 'articles',
			field,
			name: field,
			type: 'string',
			schema: {},
			meta: { id: 1, sort: null },
		})) as never;
	});

	test('the D-96 menu moves emit the reordered keys; remove; null when the last one goes', async () => {
		const wrapper = mountWith(SystemFields, { collectionName: 'articles', value: ['title', 'body'] });
		const list = wrapper.findComponent(BoSortableList as never) as any;

		list.vm.$emit('update:modelValue', [...(list.props('modelValue') as { key: string }[])].reverse());
		expect(wrapper.emitted('input')![0]).toEqual([['body', 'title']]);

		const remove = (list.props('rowActions') as (row: { key: string }) => { onSelect: () => void }[])({ key: 'title' });
		remove[0]!.onSelect();
		expect(wrapper.emitted('input')![1]).toEqual([['body']]);

		await wrapper.setProps({ value: ['body'] });
		(list.props('rowActions') as (row: { key: string }) => { onSelect: () => void }[])({ key: 'body' })[0]!.onSelect();
		expect(wrapper.emitted('input')!.slice(2)).toEqual([[null], [[]]]);
	});

	test('the notices without a collection and without fields', () => {
		expect(mountWith(SystemFields, { collectionName: '', value: null }).text()).toContain(
			i18n.global.t('interfaces.system-fields.select_a_collection'),
		);
		expect(mountWith(SystemFields, { collectionName: 'articles', value: null }).text()).toContain(
			i18n.global.t('interfaces.system-fields.no_fields'),
		);
	});
});

test('system-inline-fields: rows flatten meta and schema, edits expand them back', async () => {
	const wrapper = mountWith(SystemInlineFields, {
		value: [
			{ field: 'title', type: 'string', meta: { interface: 'input', width: 'half' }, schema: { default_value: 'x' } },
		],
	});
	await flushPromises();
	const list = wrapper.findComponent(getInterface('list')!.component as never) as any;

	expect(list.props('value')).toEqual([
		{
			field: 'title',
			type: 'string',
			name: 'Title',
			'meta.interface': 'input',
			'meta.width': 'half',
			'schema.default_value': 'x',
		},
	]);

	list.vm.$emit('input', [{ field: 'body', type: 'text', 'meta.interface': 'input-multiline' }]);
	expect(wrapper.emitted('input')).toEqual([
		[[{ field: 'body', type: 'text', meta: { interface: 'input-multiline' } }]],
	]);
});

test('system-collections: tables only, system ones on request (option:system-collections.includeSystem)', () => {
	const store = useCollectionsStore();
	store.collections = [
		{ collection: 'articles', schema: {}, meta: { singleton: false } },
		{ collection: 'a_folder', schema: null, meta: {} },
		{ collection: 'directus_users', schema: {}, meta: { singleton: false } },
	].map((c) => store.prepareCollectionForApp(c as never));

	const choices = (props: Record<string, unknown>) =>
		(
			mountWith(SystemCollections, { value: null, ...props })
				.findComponent(SelectMultipleCheckbox)
				.props('choices') as { value: string }[]
		).map((c) => c.value);

	expect(choices({})).toEqual(['articles']);
	expect(choices({ includeSystem: true })).toEqual(['articles', 'directus_users']);
});

test('system-manual-flow-select: manual flows of the collection not shown on the collection page', () => {
	useFlowsStore().flows = [
		{
			id: 'f1',
			name: 'Publish',
			icon: 'bolt',
			trigger: 'manual',
			status: 'active',
			options: { collections: ['articles'], location: 'item' },
		},
		{
			id: 'f2',
			name: 'Bulk',
			trigger: 'manual',
			status: 'inactive',
			description: 'all',
			options: { collections: ['articles'] },
		},
		{ id: 'f3', name: 'List only', trigger: 'manual', options: { collections: ['articles'], location: 'collection' } },
		{ id: 'f4', name: 'Hook', trigger: 'event', options: { collections: ['articles'] } },
	] as never;

	const wrapper = mountWith(SystemManualFlowSelect, { value: null, collectionName: 'articles' });

	expect(wrapper.findComponent(BoSelect).props('items')).toEqual([
		{ value: 'f1', text: 'Publish', icon: 'bolt' },
		{ value: 'f2', text: `Bulk: all (${i18n.global.t('inactive')})` },
	]);
});
