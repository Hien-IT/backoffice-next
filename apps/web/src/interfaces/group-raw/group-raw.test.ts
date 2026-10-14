// Ported from directus/app/src/interfaces/group-raw/group-raw.test.ts
// Backoffice: BoForm is mounted for real (no stub); the registry is the fake one of the form tests plus group-raw;
// the second half mounts the bo_groups fixture (contracts/tests.md §5).
import type { Field } from '@directus/types';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BoForm from '../../components/form/BoForm.vue';
import { global, inputs, mountForm, tree } from './group-test-utils.ts';
import GroupRaw from './GroupRaw.vue';
import groupRaw from './index.ts';

const registry = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock('../index.ts', async () => {
	const { FAKE_INTERFACES } = await import('../../components/form/test-interfaces.ts');
	const getInterface = (id?: string | null) => (id ? (registry[id] ?? FAKE_INTERFACES[id]) : undefined);
	return { getInterface, getInterfaces: () => [], sortInterfaces: (list: unknown[]) => list };
});

Object.assign(registry, { [groupRaw.id]: groupRaw });

beforeEach(() => {
	setActivePinia(createPinia());
});

const baseProps = {
	field: { meta: { field: 'my_group' } } as Field,
	fields: [] as Field[],
	values: {},
	initialValues: {},
	primaryKey: '1',
};

describe('group-raw', () => {
	it('forwards version prop to inner VForm', () => {
		const version = { id: 'abc', key: 'draft', collection: 'articles', item: '1' };

		const wrapper = mount(GroupRaw, {
			props: { ...baseProps, version: version as any },
			global,
		});

		const form = wrapper.findComponent(BoForm);
		expect(form.props('version')).toEqual(version);
	});
});

describe('group-raw on the bo_groups fixture', () => {
	it('renders the children as-is (label, value), with no frame and no input on mount', () => {
		const wrapper = mountForm(tree('raw'));
		const group = wrapper.get('[data-group-raw]');

		expect(group.findAll('label').map((label) => label.text())).toEqual(['Raw Text']);
		expect(inputs(wrapper)).toEqual(['Raw']);
		expect(group.find('h3').exists()).toBe(false);
		expect(group.classes()).toEqual(expect.arrayContaining(['col-start-1', 'col-span-2']));
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});

	it('an edit comes back through apply in the Directus shape; disabled reaches the children', async () => {
		const wrapper = mountForm(tree('raw'));

		await wrapper.get('input').setValue('Changed');
		await flushPromises();
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ raw_text: 'Changed' }]);

		const disabled = mountForm(tree('raw'), { disabled: true });
		expect(disabled.get('input').attributes('disabled')).toBeDefined();
	});

	it('the child input is linked to its label inside the group (FORM_FIELD_A11Y)', () => {
		const wrapper = mountForm(tree('raw'));
		const label = wrapper.get('[data-group-raw] label');

		expect(label.attributes('for')).toBe(wrapper.get('input').attributes('id'));
	});
});
