// Backoffice (spec 025, FR-026, US4): the formats of an import or export permission: none checked is every format
// (`options` null), the checked ones go to `options.formats` in the order of the action.
import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import BoCheckbox from '../../../../components/BoCheckbox.vue';
import { i18n } from '../../../../lang/index.ts';
import FormatsTab from './FormatsTab.vue';

const row = (action: string, formats?: string[]) =>
	({
		policy: 'p1',
		collection: 'bo_std',
		action,
		permissions: null,
		validation: null,
		presets: null,
		fields: ['*'],
		options: formats ? { formats } : null,
	}) as never;

function render(permission: never) {
	return mount(FormatsTab, { props: { permission }, global: { plugins: [i18n] } });
}

const labels = (wrapper: ReturnType<typeof render>) =>
	wrapper.findAll('label').map((label: { text(): string }) => label.text());
const checked = (wrapper: ReturnType<typeof render>) =>
	wrapper.findAllComponents(BoCheckbox).map((box: { props(key: 'modelValue'): unknown }) => box.props('modelValue'));
const last = (wrapper: ReturnType<typeof render>) => (wrapper.emitted('update:permission')!.at(-1)![0] as any).options;

describe('FormatsTab', () => {
	test('the formats of the action, each a labelled checkbox, with the hint as legend', () => {
		const wrapper = render(row('export'));

		expect(labels(wrapper)).toEqual(['CSV', 'CSV Excel (UTF-8)', 'JSON', 'XML', 'YAML']);
		// Each label is linked to its checkbox button.
		const ids = wrapper.findAll('[role="checkbox"]').map((box) => box.attributes('id'));
		expect(wrapper.findAll('label').map((label) => label.attributes('for'))).toEqual(ids);
		expect(wrapper.find('legend').text()).toBe(i18n.global.t('bo_formats_hint'));
		expect(checked(wrapper)).toEqual([false, false, false, false, false]);
		expect(render(row('import')).findAllComponents(BoCheckbox)).toHaveLength(2);
	});

	test('checking adds the format in the order of the action; unchecking the last one sets options to null', async () => {
		const wrapper = render(row('export', ['json']));
		expect(checked(wrapper)).toEqual([false, false, true, false, false]);

		wrapper.findAllComponents(BoCheckbox)[0]!.vm.$emit('update:modelValue', true);
		expect(last(wrapper)).toEqual({ formats: ['csv', 'json'] });

		wrapper.findAllComponents(BoCheckbox)[2]!.vm.$emit('update:modelValue', false);
		expect(last(wrapper)).toBeNull();
	});
});
