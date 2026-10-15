// Ported from directus/app/src/layouts/calendar/options.test.ts
// Backoffice: the app i18n (en-US) instead of a spied `t`; BoInput/BoSelect stubbed like v-collection-field-template
// and v-select; plus the update events of the BoSelect values (string values, "Deselect" item).
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import { i18n } from '../../lang/index.ts';
import Options from './CalendarOptions.vue';

const global = { stubs: ['BoInput', 'BoSelect'], plugins: [i18n] };

const dateFields = [
	{
		collection: 'test',
		field: 'test',
		name: 'Test',
		type: 'date' as const,
		schema: null,
		meta: null,
	},
];

test('should have days array in firstDayOptions variable', async () => {
	const wrapper = mount(Options, {
		props: {
			collection: 'test',
			dateFields,
		},
		shallow: true,
		global,
	});

	const expected = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

	expect(wrapper.vm.firstDayOptions.map((option: { text: string; value: number }) => option.text)).toEqual(expected);
});

test('selects emit the field, undefined for "Deselect" and the first day as a number', () => {
	const wrapper = mount(Options, {
		props: { collection: 'test', dateFields, startDateField: 'test' },
		shallow: true,
		global,
	});

	const [start, end, firstDay] = wrapper.findAllComponents({ name: 'BoSelect' });

	expect(start!.props('items')).toEqual([
		{ text: 'Deselect', value: '__deselect__' },
		{ text: 'Test', value: 'test' },
	]);
	expect(end!.props('items')).toEqual([{ text: 'Test', value: 'test' }]);
	expect(firstDay!.props('modelValue')).toBe('0');

	start!.vm.$emit('update:modelValue', '__deselect__');
	end!.vm.$emit('update:modelValue', 'test');
	firstDay!.vm.$emit('update:modelValue', '1');
	wrapper.findComponent({ name: 'BoInput' }).vm.$emit('update:modelValue', '{{ title }}');

	expect(wrapper.emitted('update:startDateField')).toEqual([[undefined]]);
	expect(wrapper.emitted('update:endDateField')).toEqual([['test']]);
	expect(wrapper.emitted('update:firstDay')).toEqual([[1]]);
	expect(wrapper.emitted('update:template')).toEqual([['{{ title }}']]);
});
