// Ported from directus/app/src/components/v-form/v-form.test.ts
// Backoffice: the registry is mocked with the
// fake interfaces of test-interfaces.ts; a real pinia instead of @pinia/testing; no outlet elements (Reka portals).
import type { Field } from '@directus/types';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, h, nextTick, provide } from 'vue';
import { i18n } from '../../lang/index.ts';
import VForm from './BoForm.vue';
import FormField from './FormField.vue';
import { FORM_COMPARISON } from './types.ts';

vi.mock('../../interfaces/index.ts', async () => (await import('./test-interfaces.ts')).registryMock);

const global = {
	plugins: [i18n],
};

beforeEach(() => {
	setActivePinia(createPinia());
});

function createField(overrides: Partial<Field> = {}): Field {
	return {
		field: 'test_field',
		name: 'Test Field',
		type: 'string',
		collection: 'test_collection',
		schema: {
			name: 'test_field',
			table: 'test_collection',
			data_type: 'varchar',
			default_value: null,
			max_length: 255,
			numeric_precision: null,
			numeric_scale: null,
			is_nullable: true,
			is_unique: false,
			is_indexed: false,
			is_primary_key: false,
			has_auto_increment: false,
			foreign_key_column: null,
			foreign_key_table: null,
			is_generated: false,
			generation_expression: null,
		},
		meta: {
			id: 1,
			collection: 'test_collection',
			field: 'test_field',
			special: null,
			interface: 'input',
			options: null,
			display: null,
			display_options: null,
			readonly: false,
			hidden: false,
			sort: 1,
			width: 'full',
			translations: null,
			note: null,
			conditions: null,
			required: false,
			group: null,
			validation: null,
			searchable: true,
			validation_message: null,
		},
		...overrides,
	};
}

describe('VForm', () => {
	describe('comparison mode with showDifferencesOnly', () => {
		it('updates visible fields when showDifferencesOnly toggles', async () => {
			const modifiedField = createField({ field: 'modified_field', name: 'Modified Field' });
			const unmodifiedField = createField({ field: 'unmodified_field', name: 'Unmodified Field' });
			const comparisonFields = new Set(['modified_field']);

			const comparison = {
				side: 'incoming' as const,
				fields: comparisonFields,
				selectedFields: [],
				onToggleField: null,
				showDifferencesOnly: false,
			};

			const wrapper = mount(VForm, {
				props: {
					fields: [modifiedField, unmodifiedField],
					primaryKey: '+',
					comparison,
				},
				global,
			});

			let renderedFields = wrapper.findAllComponents(FormField).map((c) => c.props('field').field);
			expect(renderedFields).toContain('modified_field');
			expect(renderedFields).toContain('unmodified_field');

			await wrapper.setProps({
				comparison: { ...comparison, showDifferencesOnly: true },
			});

			renderedFields = wrapper.findAllComponents(FormField).map((c) => c.props('field').field);
			expect(renderedFields).toContain('modified_field');
			expect(renderedFields).not.toContain('unmodified_field');

			await wrapper.setProps({
				comparison: { ...comparison, showDifferencesOnly: false },
			});

			renderedFields = wrapper.findAllComponents(FormField).map((c) => c.props('field').field);
			expect(renderedFields).toContain('modified_field');
			expect(renderedFields).toContain('unmodified_field');
		});

		it('updates visible fields inside a group when showDifferencesOnly toggles', async () => {
			const modifiedInGroup = createField({
				field: 'inner_modified',
				name: 'Inner Modified',
				meta: {
					...createField().meta!,
					field: 'inner_modified',
					group: 'my_group',
				},
			});

			const unmodifiedInGroup = createField({
				field: 'inner_unmodified',
				name: 'Inner Unmodified',
				meta: {
					...createField().meta!,
					field: 'inner_unmodified',
					group: 'my_group',
				},
			});

			const comparisonFields = new Set(['inner_modified']);

			const comparison = {
				side: 'incoming' as const,
				fields: comparisonFields,
				selectedFields: [],
				onToggleField: null,
				showDifferencesOnly: false,
			};

			const wrapper = mount(VForm, {
				props: {
					fields: [modifiedInGroup, unmodifiedInGroup],
					primaryKey: '+',
					group: 'my_group',
					comparison,
				},
				global,
			});

			let renderedFields = wrapper.findAllComponents(FormField).map((c) => c.props('field').field);
			expect(renderedFields).toContain('inner_modified');
			expect(renderedFields).toContain('inner_unmodified');

			await wrapper.setProps({
				comparison: { ...comparison, showDifferencesOnly: true },
			});

			renderedFields = wrapper.findAllComponents(FormField).map((c) => c.props('field').field);
			expect(renderedFields).toContain('inner_modified');
			expect(renderedFields).not.toContain('inner_unmodified');

			await wrapper.setProps({
				comparison: { ...comparison, showDifferencesOnly: false },
			});

			renderedFields = wrapper.findAllComponents(FormField).map((c) => c.props('field').field);
			expect(renderedFields).toContain('inner_modified');
			expect(renderedFields).toContain('inner_unmodified');
		});
		// Backoffice: the comparison checkbox of the label (Directus form-field-label.vue) and the comparison of a parent
		// form read by a group's nested form (FORM_COMPARISON).
		it('shows a checked checkbox on selected differing fields only when onToggleField is set', async () => {
			const onToggleField = vi.fn();

			const wrapper = mount(VForm, {
				props: {
					fields: [createField({ field: 'a', name: 'A' }), createField({ field: 'b', name: 'B' })],
					primaryKey: 1,
					nonEditable: true,
					comparison: { side: 'incoming', fields: new Set(['a']), selectedFields: ['a'], onToggleField },
				},
				global,
			});

			const boxes = wrapper.findAll('[data-comparison-checkbox]');
			expect(boxes).toHaveLength(1);
			expect(boxes[0]!.attributes('data-state')).toBe('checked');
			await boxes[0]!.trigger('click');
			expect(onToggleField).toHaveBeenCalledWith('a');

			await wrapper.setProps({
				comparison: { side: 'base', fields: new Set(['a']), selectedFields: [], onToggleField: null },
			});

			expect(wrapper.findAll('[data-comparison-checkbox]')).toHaveLength(0);
			expect(wrapper.find('[data-field="a"]').classes()).toContain('bg-warning-50');
			expect(wrapper.find('[data-field="b"]').classes()).not.toContain('bg-warning-50');
		});

		it('shows hidden fields that differ', () => {
			const hidden = createField({ field: 'h', name: 'H', meta: { ...createField().meta!, field: 'h', hidden: true } });

			const wrapper = mount(VForm, {
				props: {
					fields: [hidden],
					primaryKey: 1,
					comparison: { side: 'incoming', fields: new Set(['h']), selectedFields: [], onToggleField: null },
				},
				global,
			});

			expect(wrapper.findAllComponents(FormField).map((c) => c.props('field').field)).toEqual(['h']);
		});

		it('a nested group form reads the comparison of its parent form', () => {
			const Parent = defineComponent({
				setup() {
					provide(
						FORM_COMPARISON,
						computed(() => ({
							side: 'incoming' as const,
							fields: new Set(['inner']),
							selectedFields: [],
							onToggleField: null,
							showDifferencesOnly: true,
						})),
					);

					const fields = [
						createField({ field: 'inner', meta: { ...createField().meta!, field: 'inner', group: 'g' } }),
						createField({ field: 'other', meta: { ...createField().meta!, field: 'other', group: 'g' } }),
					];

					return () => h(VForm, { fields, primaryKey: 1, group: 'g' });
				},
			});

			const wrapper = mount(Parent, { global });

			expect(wrapper.findAllComponents(FormField).map((c) => c.props('field').field)).toEqual(['inner']);
		});
	});

	describe('apply function', () => {
		it('preserves grouped readonly field values during nested form updates', async () => {
			const checkboxField = createField({
				field: 'checkbox',
				name: 'Checkbox',
				type: 'boolean',
				meta: {
					...createField().meta!,
					field: 'checkbox',
					special: ['cast-boolean'],
				},
			});

			const groupedInputField = createField({
				field: 'grouped_input',
				name: 'Grouped Input',
				meta: {
					...createField().meta!,
					field: 'grouped_input',
					readonly: true,
					group: 'my_group',
				},
			});

			const wrapper = mount(VForm, {
				props: {
					fields: [checkboxField, groupedInputField],
					modelValue: { checkbox: false, grouped_input: 'preserved value' },
					primaryKey: '+',
				},
				global,
			});

			const vm = wrapper.vm as unknown as {
				apply: (updates: Record<string, unknown>) => void;
			};

			vm.apply({ checkbox: true, grouped_input: 'preserved value' });

			await nextTick();

			const emitted = wrapper.emitted('update:modelValue');
			expect(emitted).toBeTruthy();
			expect(emitted?.[0]?.[0]).toEqual({ checkbox: true, grouped_input: 'preserved value' });
		});

		it('filters out keys that are not actual form fields', async () => {
			const inputField = createField({
				field: 'input',
				name: 'Input',
			});

			const wrapper = mount(VForm, {
				props: {
					fields: [inputField],
					modelValue: { input: 'value' },
					primaryKey: '+',
				},
				global,
			});

			const vm = wrapper.vm as unknown as {
				apply: (updates: Record<string, unknown>) => void;
			};

			vm.apply({ input: 'new value', key: 'should be ignored' });

			await nextTick();

			const emitted = wrapper.emitted('update:modelValue');
			expect(emitted).toBeTruthy();
			expect(emitted?.[0]?.[0]).toEqual({ input: 'new value' });
		});

		it('preserves meta keys starting with $', async () => {
			const inputField = createField({
				field: 'input',
				name: 'Input',
			});

			const wrapper = mount(VForm, {
				props: {
					fields: [inputField],
					modelValue: { input: 'value' },
					primaryKey: '+',
				},
				global,
			});

			const vm = wrapper.vm as unknown as {
				apply: (updates: Record<string, unknown>) => void;
			};

			vm.apply({ input: 'new value', $type: 'created' });

			await nextTick();

			const emitted = wrapper.emitted('update:modelValue');
			expect(emitted).toBeTruthy();
			expect(emitted?.[0]?.[0]).toEqual({ input: 'new value', $type: 'created' });
		});

		it('filters out top-level readonly field updates', async () => {
			const editableField = createField({
				field: 'editable',
				name: 'Editable',
			});

			const readonlyField = createField({
				field: 'readonly_field',
				name: 'Readonly Field',
				meta: {
					...createField().meta!,
					field: 'readonly_field',
					readonly: true,
				},
			});

			const wrapper = mount(VForm, {
				props: {
					fields: [editableField, readonlyField],
					modelValue: { editable: 'old', readonly_field: 'should not change' },
					primaryKey: '+',
				},
				global,
			});

			const vm = wrapper.vm as unknown as {
				apply: (updates: Record<string, unknown>) => void;
			};

			vm.apply({ editable: 'new', readonly_field: 'CHANGED' });

			await nextTick();

			const emitted = wrapper.emitted('update:modelValue');
			expect(emitted).toBeTruthy();
			expect(emitted?.[0]?.[0]).toEqual({ editable: 'new' });
		});

		it('allows hidden field updates (hidden is not readonly)', async () => {
			const visibleField = createField({
				field: 'visible',
				name: 'Visible',
			});

			const hiddenField = createField({
				field: 'hidden_field',
				name: 'Hidden Field',
				meta: {
					...createField().meta!,
					field: 'hidden_field',
					hidden: true,
				},
			});

			const wrapper = mount(VForm, {
				props: {
					fields: [visibleField, hiddenField],
					modelValue: { visible: 'old', hidden_field: 'secret' },
					primaryKey: '+',
				},
				global,
			});

			const vm = wrapper.vm as unknown as {
				apply: (updates: Record<string, unknown>) => void;
			};

			vm.apply({ visible: 'new', hidden_field: 'updated' });

			await nextTick();

			const emitted = wrapper.emitted('update:modelValue');
			expect(emitted).toBeTruthy();
			expect(emitted?.[0]?.[0]).toEqual({ visible: 'new', hidden_field: 'updated' });
		});

		it('filters out conditionally readonly field updates (not in a group)', async () => {
			const toggleField = createField({
				field: 'toggle',
				name: 'Toggle',
				type: 'boolean',
				meta: {
					...createField().meta!,
					field: 'toggle',
				},
			});

			const conditionalField = createField({
				field: 'conditional',
				name: 'Conditional',
				meta: {
					...createField().meta!,
					field: 'conditional',
					conditions: [
						{
							name: 'Make readonly',
							rule: { toggle: { _eq: true } },
							readonly: true,
							hidden: false,
							options: {},
						},
					],
				},
			});

			const wrapper = mount(VForm, {
				props: {
					fields: [toggleField, conditionalField],
					modelValue: { toggle: true, conditional: 'original' },
					primaryKey: '+',
				},
				global,
			});

			const vm = wrapper.vm as unknown as {
				apply: (updates: Record<string, unknown>) => void;
			};

			vm.apply({ toggle: true, conditional: 'CHANGED' });

			await nextTick();

			const emitted = wrapper.emitted('update:modelValue');
			expect(emitted).toBeTruthy();
			expect(emitted?.[0]?.[0]).toEqual({ toggle: true });
		});

		it('preserves grouped field values even when conditionally readonly', async () => {
			const toggleField = createField({
				field: 'toggle',
				name: 'Toggle',
				type: 'boolean',
				meta: {
					...createField().meta!,
					field: 'toggle',
				},
			});

			const groupedConditionalField = createField({
				field: 'grouped_conditional',
				name: 'Grouped Conditional',
				meta: {
					...createField().meta!,
					field: 'grouped_conditional',
					group: 'my_group',
					conditions: [
						{
							name: 'Make readonly',
							rule: { toggle: { _eq: true } },
							readonly: true,
							hidden: false,
							options: {},
						},
					],
				},
			});

			const wrapper = mount(VForm, {
				props: {
					fields: [toggleField, groupedConditionalField],
					modelValue: { toggle: true, grouped_conditional: 'preserved value' },
					primaryKey: '+',
				},
				global,
			});

			const vm = wrapper.vm as unknown as {
				apply: (updates: Record<string, unknown>) => void;
			};

			vm.apply({ toggle: true, grouped_conditional: 'preserved value' });

			await nextTick();

			const emitted = wrapper.emitted('update:modelValue');
			expect(emitted).toBeTruthy();
			expect(emitted?.[0]?.[0]).toEqual({ toggle: true, grouped_conditional: 'preserved value' });
		});

		it('allows editable field updates', async () => {
			const editableField = createField({
				field: 'editable',
				name: 'Editable',
				meta: {
					...createField().meta!,
					field: 'editable',
					readonly: false,
				},
			});

			const wrapper = mount(VForm, {
				props: {
					fields: [editableField],
					modelValue: { editable: 'old' },
					primaryKey: '+',
				},
				global,
			});

			const vm = wrapper.vm as unknown as {
				apply: (updates: Record<string, unknown>) => void;
			};

			vm.apply({ editable: 'new' });

			await nextTick();

			const emitted = wrapper.emitted('update:modelValue');
			expect(emitted).toBeTruthy();
			expect(emitted?.[0]?.[0]).toEqual({ editable: 'new' });
		});

		it('preserves conditionally readonly field values when nested form passes through unchanged values', async () => {
			const toggleField = createField({
				field: 'toggle',
				name: 'Toggle',
				type: 'boolean',
				meta: {
					...createField().meta!,
					field: 'toggle',
				},
			});

			const conditionalReadonlyField = createField({
				field: 'conditional_readonly',
				name: 'Conditional Readonly',
				meta: {
					...createField().meta!,
					field: 'conditional_readonly',
					conditions: [
						{
							name: 'Make readonly',
							rule: { toggle: { _eq: true } },
							readonly: true,
							hidden: false,
							options: {},
						},
					],
				},
			});

			const groupedField = createField({
				field: 'grouped_field',
				name: 'Grouped Field',
				meta: {
					...createField().meta!,
					field: 'grouped_field',
					group: 'my_group',
				},
			});

			const wrapper = mount(VForm, {
				props: {
					fields: [toggleField, conditionalReadonlyField, groupedField],
					modelValue: { toggle: true, conditional_readonly: 'preserved', grouped_field: 'old' },
					primaryKey: '+',
				},
				global,
			});

			const vm = wrapper.vm as unknown as {
				apply: (updates: Record<string, unknown>) => void;
			};

			vm.apply({ toggle: true, conditional_readonly: 'preserved', grouped_field: 'new' });

			await nextTick();

			const emitted = wrapper.emitted('update:modelValue');
			expect(emitted).toBeTruthy();
			expect(emitted?.[0]?.[0]).toEqual({ toggle: true, conditional_readonly: 'preserved', grouped_field: 'new' });
		});
	});
});
