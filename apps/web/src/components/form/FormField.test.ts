// Ported from directus/app/src/components/v-form/components/form-field.test.ts
// Backoffice: no outlet elements or directive stubs (Reka portals, utils/markdown.ts); the registry is mocked with
// the fake interfaces of test-interfaces.ts.
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import FormField from './FormField.vue';

vi.mock('../../interfaces/index.ts', async () => (await import('./test-interfaces.ts')).registryMock);

beforeEach(() => {
	setActivePinia(createPinia());
});

// Backoffice: typed loosely, as the Directus test (DeepPartial fields).
const baseField: any = {
	field: 'test',
	name: 'Test Field',
	collection: 'test_collection',
	meta: {
		width: 'full' as const,
		readonly: false,
		hideLabel: false,
		special: [],
		note: '',
		validation_message: '',
		validation: undefined,
	},
	schema: {
		default_value: undefined,
	},
};

const global = {
	plugins: [i18n],
};

describe('FormField', () => {
	it('should show FormFieldLabel in batch mode if field.meta.special does not include "no-data"', () => {
		const wrapper = mount(FormField, {
			props: {
				field: { ...baseField, hideLabel: true, meta: { ...baseField.meta, special: [] } },
				batchMode: true,
				batchActive: true,
			},
			global,
		});

		// Label should be visible
		expect(wrapper.findComponent({ name: 'FormFieldLabel' }).exists()).toBe(true);
	});

	it('should hide FormFieldLabel in batch mode if field.meta.special includes "no-data"', () => {
		const wrapper = mount(FormField, {
			props: {
				field: { ...baseField, hideLabel: true, meta: { ...baseField.meta, special: ['no-data'] } },
				batchMode: true,
				batchActive: true,
			},
			global,
		});

		// Label should be hidden
		expect(wrapper.findComponent({ name: 'FormFieldLabel' }).exists()).toBe(false);
	});

	it('should hide FormFieldLabel if field.hideLabel is true and not in batch mode', () => {
		const wrapper = mount(FormField, {
			props: {
				field: { ...baseField, hideLabel: true },
				batchMode: false,
			},
			global,
		});

		expect(wrapper.findComponent({ name: 'FormFieldLabel' }).exists()).toBe(false);
	});

	// Backoffice (T093, axe "label"): a hidden label stays as an sr-only label for data fields, not for no-data ones.
	it('keeps an sr-only label linked to the control when the label of a data field is hidden', () => {
		const wrapper = mount(FormField, { props: { field: { ...baseField, hideLabel: true } }, global });
		const label = wrapper.get('label.sr-only');
		const fieldInterface = wrapper.findComponent({ name: 'FormFieldInterface' });

		expect(label.text()).toBe('Test Field');
		expect(label.attributes('for')).toBe(fieldInterface.props('inputId'));
		expect(fieldInterface.props('labelId')).toBe(label.attributes('id'));

		const group = mount(FormField, {
			props: { field: { ...baseField, hideLabel: true, meta: { ...baseField.meta, special: ['no-data'] } } },
			global,
		});
		expect(group.find('label.sr-only').exists()).toBe(false);
	});

	describe('isNonEditable', () => {
		it('should pass non-editable=false when neither prop nor meta is set', () => {
			const wrapper = mount(FormField, {
				props: {
					field: baseField,
				},
				global,
			});

			const fieldInterface = wrapper.findComponent({ name: 'FormFieldInterface' });
			expect(fieldInterface.props('nonEditable')).toBe(false);
		});

		it('should pass non-editable=true when nonEditable prop is true', () => {
			const wrapper = mount(FormField, {
				props: {
					field: baseField,
					nonEditable: true,
				},
				global,
			});

			const fieldInterface = wrapper.findComponent({ name: 'FormFieldInterface' });
			expect(fieldInterface.props('nonEditable')).toBe(true);
		});

		it('should pass non-editable=true when field.meta.non_editable is true', () => {
			const wrapper = mount(FormField, {
				props: {
					field: { ...baseField, meta: { ...baseField.meta, non_editable: true } },
				},
				global,
			});

			const fieldInterface = wrapper.findComponent({ name: 'FormFieldInterface' });
			expect(fieldInterface.props('nonEditable')).toBe(true);
		});

		it('should pass non-editable=false when field.meta.readonly is true but non_editable is not set', () => {
			const wrapper = mount(FormField, {
				props: {
					field: { ...baseField, meta: { ...baseField.meta, readonly: true } },
				},
				global,
			});

			const fieldInterface = wrapper.findComponent({ name: 'FormFieldInterface' });
			expect(fieldInterface.props('nonEditable')).toBe(false);
		});
	});
});
