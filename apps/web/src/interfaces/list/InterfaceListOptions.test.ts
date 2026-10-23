// Feature 016 (T053, D-56 lifted): the options component of the list interface, as DR interfaces/list/options.vue:
// template, add label, sort (from the defined fields, deselect), and the fields repeater whose rows are field metas.
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test } from 'vitest';
import BoInput from '../../components/BoInput.vue';
import BoSelect from '../../components/BoSelect.vue';
import { i18n } from '../../lang/index.ts';
import { mockApi } from '../../test-utils/fetch.ts';
import InterfaceList from './InterfaceList.vue';
import InterfaceListOptions from './InterfaceListOptions.vue';

beforeEach(() => {
	setActivePinia(createPinia());
	mockApi({});
});

const VALUE = {
	template: '{{ title }}',
	fields: [
		{
			field: 'title',
			name: 'Title',
			type: 'string',
			meta: { field: 'title', type: 'string', interface: 'input', width: 'full' },
		},
		{ field: 'done', name: 'done', type: 'boolean', meta: { field: 'done', type: 'boolean', interface: 'boolean' } },
	],
};

const mountOptions = (value: Record<string, unknown> | null = VALUE) =>
	mount(InterfaceListOptions, { props: { value, collection: 'articles' }, global: { plugins: [i18n] } });

test('option:list.template and option:list.addLabel emit the merged options', () => {
	const wrapper = mountOptions();

	wrapper.findComponent(BoInput).vm.$emit('update:modelValue', '{{ title }} ({{ done }})');
	expect(wrapper.emitted('input')![0]).toEqual([{ ...VALUE, template: '{{ title }} ({{ done }})' }]);
});

test('option:list.sort lists the defined fields and can be cleared', () => {
	const wrapper = mountOptions({ ...VALUE, sort: 'title' });
	const select = wrapper.findComponent(BoSelect);

	expect(select.props('items')).toEqual([
		{ text: 'title', value: 'title' },
		{ text: 'done', value: 'done' },
	]);
	select.vm.$emit('update:modelValue', 'done');
	select.vm.$emit('deselect');
	expect(wrapper.emitted('input')).toEqual([[{ ...VALUE, sort: 'done' }], [{ ...VALUE, sort: null }]]);
});

test('option:list.fields: the repeater rows are the field metas; edits become fields with name and type', () => {
	const wrapper = mountOptions();
	const repeater = wrapper.findComponent(InterfaceList);

	expect(repeater.props('value')).toEqual(VALUE.fields.map((f) => f.meta));
	expect((repeater.props('fields') as { field: string }[]).map((f) => f.field)).toEqual([
		'field',
		'width',
		'type',
		'required',
		'note',
		'group-interface',
		'interface',
		'options',
		'group-display',
		'display',
		'display_options',
	]);

	repeater.vm.$emit('input', [{ field: 'body', type: 'text', interface: 'input-multiline' }]);
	expect(wrapper.emitted('input')![0]).toEqual([
		{
			...VALUE,
			fields: [
				{
					field: 'body',
					name: 'body',
					type: 'text',
					meta: { field: 'body', type: 'text', interface: 'input-multiline' },
				},
			],
		},
	]);
});
