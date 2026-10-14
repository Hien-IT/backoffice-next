// Test-only helpers of the group interface tests (group-accordion, group-detail, group-raw, group-tabs): the bo_groups
// fixture fields mounted in BoForm. Each test file mocks the registry itself (vi.mock is hoisted per file).
import formatTitle from '@directus/format-title';
import type { Field, ValidationError } from '@directus/types';
import { mount, type VueWrapper } from '@vue/test-utils';
import BoForm from '../../components/form/BoForm.vue';
import { getFieldsInGroup } from '../../components/form/utils/get-fields-in-group.ts';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';

export const global = { plugins: [i18n] };

const allFields = fieldsOf('bo_groups').map((field) => ({ ...field, name: formatTitle(field.field) })) as Field[];

/** A bo_groups group field and every field nested in it; `options` replaces the group options when given. */
export function tree(
	root: string,
	options?: Record<string, unknown> | null,
	metaOverrides: Record<string, object> = {},
) {
	const rootField = structuredClone(allFields.find((field) => field.field === root)!);
	if (options !== undefined) rootField.meta!.options = options;

	return [
		rootField,
		...getFieldsInGroup(root, allFields).map((field) => ({
			...field,
			meta: { ...field.meta!, ...metaOverrides[field.field] },
		})),
	] as Field[];
}

/** BoForm on the fixture item 1, with v-model wired back to the props. */
export function mountForm(fields: Field[], props: Record<string, unknown> = {}) {
	const wrapper: VueWrapper<any> = mount(BoForm, {
		props: {
			fields,
			initialValues: itemOf('bo_groups', 1),
			modelValue: {},
			primaryKey: 1,
			'onUpdate:modelValue': (value: Record<string, unknown>) => wrapper.setProps({ modelValue: value }),
			...props,
		},
		global,
	});

	return wrapper;
}

export const inputs = (wrapper: VueWrapper<any>) =>
	wrapper.findAll('input').map((input) => (input.element as HTMLInputElement).value);

export const error = (field: string): ValidationError =>
	({ code: 'FAILED_VALIDATION', collection: 'bo_groups', field, type: 'required', hidden: false, group: null }) as any;
