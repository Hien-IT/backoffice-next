// Variable panels of spec 018 (FR-051, FR-052, FR-055, FR-056): variable renders the chosen interface bound to the
// insights variable; relational-variable shows the selected items, picks through the collection drawer and keeps
// at most `limit` keys (DR panel-variable.vue, panel-relational-variable.vue, use-display-items.ts).
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { replaceQueue } from '../api/sdk.ts';
import DrawerCollection from '../components/drawers/DrawerCollection.vue';
import { resetNotices, useNotices } from '../composables/use-notices.ts';
import InterfaceInput from '../interfaces/input/InterfaceInput.vue';
import { i18n } from '../lang/index.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useInsightsStore } from '../stores/insights.ts';
import '../styles/index.css';
import { json, mockApi } from '../test-utils/fetch.ts';
import PanelRelationalVariable from './relational-variable/PanelRelationalVariable.vue';
import PanelVariable from './variable/PanelVariable.vue';

enableAutoUnmount(afterEach);

const ITEMS = [
	{ id: 1, name: 'One' },
	{ id: 2, name: 'Two' },
	{ id: 3, name: 'Three' },
];

let requests: URL[];

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	resetNotices();
	useCollectionsStore().collections = [{ collection: 'bo_rel', meta: { singleton: false } }] as never;
	useFieldsStore().fields = [{ collection: 'bo_rel', field: 'id', schema: { is_primary_key: true } }] as never;

	requests = [];
	mockApi({
		'GET /items/bo_rel': ({ url }: { url: URL }) => {
			requests.push(url);
			const ids: unknown[] = JSON.parse(url.searchParams.get('filter')!).id._in;
			return json({ data: ITEMS.filter((item) => ids.includes(item.id)) });
		},
	});
});

function mountVariable(width: number) {
	return mount(PanelVariable, {
		props: {
			type: 'string',
			field: 'status',
			inter: 'input',
			dashboard: 'd1',
			width,
			options: { placeholder: 'Status' },
		},
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
}

test('variable renders the chosen interface; typing sets the variable', async () => {
	const setVariable = vi.spyOn(useInsightsStore(), 'setVariable');
	const wrapper = mountVariable(24);

	const input = wrapper.get<HTMLInputElement>('input[placeholder="Status"]');
	expect(wrapper.findComponent(InterfaceInput).vm.$attrs['width']).toBe('full');
	expect(document.querySelector(`label[for="${input.element.id}"]`)).not.toBeNull();

	await userEvent.type(input.element, 'a');
	await vi.waitFor(() => expect(setVariable).toHaveBeenLastCalledWith('status', 'a'));
});

test('variable is half width under 20 columns', () => {
	const wrapper = mountVariable(19);
	expect(wrapper.findComponent(InterfaceInput).vm.$attrs['width']).toBe('half');
});

function mountRelational(props: { multiple: boolean; limit?: number }) {
	return mount(PanelRelationalVariable, {
		props: { field: 'ids', collection: 'bo_rel', displayTemplate: '{{ name }}', dashboard: 'd1', ...props },
		// The drawer's layout is covered by DrawerCollection tests; here only its props and `input` matter.
		global: { plugins: [i18n], stubs: { DrawerCollection: true } },
		attachTo: document.body,
	});
}

test('relational-variable shows the selected items; removing one updates the variable', async () => {
	const store = useInsightsStore();
	store.setVariable('ids', [1, 2]);
	const setVariable = vi.spyOn(store, 'setVariable');
	const wrapper = mountRelational({ multiple: true, limit: 5 });

	await vi.waitFor(() => expect(wrapper.findAll('li')).toHaveLength(2));
	expect(wrapper.text()).toContain('One');
	expect(wrapper.text()).toContain('Two');
	const url = requests[0]!;
	expect(url.searchParams.get('fields')).toBe('name,id');
	expect(JSON.parse(url.searchParams.get('filter')!)).toEqual({ id: { _in: [1, 2] } });

	await wrapper.findAll('li')[0]!.get('button').trigger('click');
	expect(setVariable).toHaveBeenLastCalledWith('ids', [2]);
	await vi.waitFor(() => expect(wrapper.findAll('li')).toHaveLength(1));
});

test('relational-variable keeps the first `limit` keys, new picks first, and shows an error', async () => {
	const store = useInsightsStore();
	store.setVariable('ids', [1]);
	const wrapper = mountRelational({ multiple: true, limit: 2 });
	await flushPromises();

	wrapper.findComponent(DrawerCollection).vm.$emit('input', [2, 3]);

	expect(store.getVariable('ids')).toEqual([2, 3]);
	expect(useNotices().dialogs.value).toHaveLength(1);
});

test('relational-variable in single mode stores a scalar', async () => {
	const store = useInsightsStore();
	const wrapper = mountRelational({ multiple: false });

	await wrapper.get('button').trigger('click');
	expect(wrapper.findComponent(DrawerCollection).props('active')).toBe(true);
	wrapper.findComponent(DrawerCollection).vm.$emit('input', [3]);

	expect(store.getVariable('ids')).toBe(3);
	await vi.waitFor(() => expect(wrapper.text()).toContain('Three'));
	expect(JSON.parse(requests.at(-1)!.searchParams.get('filter')!)).toEqual({ id: { _in: [3] } });
});
